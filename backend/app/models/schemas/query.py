from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class SourceCitation(BaseModel):
    file_path: str
    function_name: Optional[str] = None
    class_name: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    chunk_type: Optional[str] = None


class QueryRequest(BaseModel):
    repository_id: UUID
    question: str

    class Config:
        json_schema_extra = {
            "example": {
                "repository_id": "123e4567-e89b-12d3-a456-426614174000",
                "question": "How does authentication work?",
            }
        }


class QueryResponse(BaseModel):
    question_id: UUID
    question: str
    answer: str
    sources: List[SourceCitation]
    created_at: datetime

    class Config:
        from_attributes = True
