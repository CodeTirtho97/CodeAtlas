from sqlalchemy import Column, String, UUID, ForeignKey, Text, Table, ARRAY
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel

# Association table for many-to-many relationship between questions and chunks
question_chunk = Table(
    "question_chunk",
    BaseModel.registry.metadata,
    Column("question_id", UUID, ForeignKey("questions.id", ondelete="CASCADE")),
    Column("chunk_id", UUID, ForeignKey("chunks.id", ondelete="CASCADE")),
)


class Question(BaseModel):
    """Question model for Q&A."""

    __tablename__ = "questions"

    repository_id = Column(
        UUID, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)

    # Cache control
    cached_until = Column(String, nullable=True)  # ISO 8601 timestamp

    # Relationships
    repository = relationship("Repository", back_populates="questions")
    user = relationship("User", back_populates="questions")
    chunks = relationship("Chunk", secondary=question_chunk, back_populates="questions")

    def __repr__(self):
        return f"<Question {self.id}>"
