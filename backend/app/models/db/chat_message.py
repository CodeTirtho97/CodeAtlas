from sqlalchemy import Column, String, Text, UUID, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class ChatMessage(BaseModel):
    """Message in a chat session."""
    __tablename__ = "chat_messages"

    session_id = Column(UUID, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources_json = Column(JSON, nullable=True)  # only for assistant messages

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage {self.role}>"
