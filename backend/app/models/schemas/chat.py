from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.models.schemas.query import SourceCitation


class ChatMessageResponse(BaseModel):
    """A single message in a chat session."""
    id: UUID
    session_id: UUID
    role: str  # "user" | "assistant"
    content: str
    sources: Optional[List[SourceCitation]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionResponse(BaseModel):
    """A chat session for a repository."""
    id: UUID
    repository_id: UUID
    title: str
    message_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    """Create a new chat session."""
    repository_id: UUID


class ChatAskRequest(BaseModel):
    """Ask a question in a chat session."""
    question: str


class ChatAskResponse(BaseModel):
    """Response from asking a question in chat."""
    session_id: UUID
    question_message: ChatMessageResponse
    answer_message: ChatMessageResponse
    questions_today: int
    questions_in_session: int
