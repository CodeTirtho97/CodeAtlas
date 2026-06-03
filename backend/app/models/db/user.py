from sqlalchemy import Column, String, Integer, DateTime, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.db.base import BaseModel


class User(BaseModel):
    """User model for GitHub OAuth users."""

    __tablename__ = "users"

    github_id = Column(Integer, unique=True, nullable=False, index=True)
    github_username = Column(String, nullable=False)
    email = Column(String, nullable=False)

    # Rate limiting
    repos_analyzed_today = Column(Integer, default=0)
    last_reset_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    repositories = relationship("Repository", back_populates="user", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.github_username}>"
