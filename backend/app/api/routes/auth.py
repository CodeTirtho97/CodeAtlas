from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from jose import jwt
import httpx
from app.core.config import settings
from app.core.database import get_session
from app.models.db import User
from app.models.schemas import LoginResponse, UserResponse, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


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
async def callback(code: str, session: AsyncSession = Depends(get_session)):
    """Handle GitHub OAuth callback."""
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
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
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token in response")

    # Get user info from GitHub
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"},
        )

    if user_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get user info from GitHub")

    github_user = user_response.json()
    github_id = github_user.get("id")
    github_username = github_user.get("login")
    email = github_user.get("email")

    if not all([github_id, github_username, email]):
        raise HTTPException(status_code=400, detail="Incomplete user data from GitHub")

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
        # Update email and username in case they changed
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

    user_response = UserResponse(
        id=user.id,
        github_username=user.github_username,
        email=user.email,
        github_id=user.github_id,
    )

    return LoginResponse(access_token=jwt_token, user=user_response)


@router.post("/logout")
async def logout():
    """Logout endpoint (client-side token deletion)."""
    return {"message": "Logged out successfully"}


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


async def get_current_user_dependency(
    token: str = None, session: AsyncSession = Depends(get_session)
) -> User:
    """Dependency to get current user from JWT token."""
    if not token:
        raise HTTPException(status_code=403, detail="No token provided")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=403, detail="Invalid token")

        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return user
    except jwt.JWTError:
        raise HTTPException(status_code=403, detail="Invalid token")
