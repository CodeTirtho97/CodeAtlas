from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Cookie, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from jose import jwt
import httpx
from pydantic import BaseModel
from app.core.config import settings
from app.core.database import get_session
from app.models.db import User
from app.models.schemas import UserResponse, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


class CallbackRequest(BaseModel):
    code: str


def _cookie_kwargs(expire: bool = False) -> dict:
    """Return Set-Cookie attributes that match the deployment environment.

    Dev  (HTTP localhost)  → SameSite=Lax,  Secure=False
    Prod (HTTPS)           → SameSite=None, Secure=True   (cross-origin safe)
    """
    is_https = settings.FRONTEND_URL.startswith("https://")
    return {
        "httponly": True,
        "secure": is_https,
        "samesite": "none" if is_https else "lax",
        "max_age": 0 if expire else settings.JWT_EXPIRY_DAYS * 24 * 60 * 60,
        "path": "/",
    }


@router.get("/login")
async def login():
    """Initiate GitHub OAuth login flow."""
    github_auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={settings.GITHUB_CLIENT_ID}&"
        f"redirect_uri={settings.FRONTEND_URL}/callback&"
        f"scope=user:email&"
        f"allow_signup=true"
    )
    return {"auth_url": github_auth_url}


@router.post("/callback")
async def callback(
    body: CallbackRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Handle GitHub OAuth callback — exchanges code for JWT set as httpOnly cookie."""
    code = body.code

    async with httpx.AsyncClient() as client:
        # 1. Exchange code for GitHub access token
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")

        token_data = token_response.json()
        github_token = token_data.get("access_token")
        if not github_token:
            raise HTTPException(status_code=400, detail="No access token returned by GitHub")

        auth_header = {"Authorization": f"token {github_token}"}

        # 2. Fetch user profile
        user_response = await client.get("https://api.github.com/user", headers=auth_header)
        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch GitHub user profile")

        github_user = user_response.json()
        github_id = github_user.get("id")
        github_username = github_user.get("login")
        email = github_user.get("email")  # may be None for private accounts

        # 3. Fallback: fetch primary email from /user/emails if profile email is private
        if not email:
            emails_response = await client.get("https://api.github.com/user/emails", headers=auth_header)
            if emails_response.status_code == 200:
                emails = emails_response.json()
                primary = next((e["email"] for e in emails if e.get("primary") and e.get("verified")), None)
                email = primary or next((e["email"] for e in emails if e.get("verified")), None)

    if not all([github_id, github_username, email]):
        raise HTTPException(status_code=400, detail="Could not retrieve required user data from GitHub")

    # Upsert user in database
    result = await session.execute(
        select(User).where(User.github_id == github_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            github_id=github_id,
            github_username=github_username,
            email=email,
            last_reset_at=datetime.utcnow(),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        user.email = email
        user.github_username = github_username
        await session.commit()

    # Generate JWT token
    payload = {
        "user_id": str(user.id),
        "github_username": user.github_username,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=settings.JWT_EXPIRY_DAYS),
    }
    jwt_token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    # Set token as httpOnly cookie — never exposed to JavaScript
    response.set_cookie(key="access_token", value=jwt_token, **_cookie_kwargs())

    return {
        "user": UserResponse(
            id=user.id,
            github_username=user.github_username,
            email=user.email,
            github_id=user.github_id,
        )
    }


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie server-side."""
    response.delete_cookie(key="access_token", **_cookie_kwargs(expire=True))
    return {"message": "Logged out successfully"}


async def get_current_user_dependency(
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency: authenticate via httpOnly cookie or Bearer header fallback."""
    token = access_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(get_current_user_dependency),
) -> UserResponse:
    """Get current logged-in user."""
    return UserResponse(
        id=current_user.id,
        github_username=current_user.github_username,
        email=current_user.email,
        github_id=current_user.github_id,
    )
