from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class UserBase(BaseModel):
    github_username: str
    email: EmailStr


class UserCreate(UserBase):
    github_id: int


class UserResponse(UserBase):
    id: UUID
    github_id: int

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    redirect_uri: str
