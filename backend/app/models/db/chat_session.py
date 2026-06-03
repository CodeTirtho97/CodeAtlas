from sqlalchemy import Column, String, Integer, UUID, ForeignKey
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class ChatSession(BaseModel):
    """Chat session for a repository."""
    __tablename__ = "chat_sessions"

    repository_id = Column(UUID, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(60), nullable=False)
    message_count = Column(Integer, default=0)

    # Relationships
    repository = relationship("Repository", back_populates="chat_sessions")
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ChatSession {self.title}>"
