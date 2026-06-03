from sqlalchemy import Column, String, Integer, UUID, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class Chunk(BaseModel):
    """Code chunk model."""

    __tablename__ = "chunks"

    repository_id = Column(
        UUID, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id = Column(UUID, ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)

    chunk_text = Column(Text, nullable=False)
    chunk_type = Column(String)  # function, class, endpoint, doc, raw
    language = Column(String)
    language_tier = Column(String)  # 1 or 2
    architectural_role = Column(String, nullable=True)  # controller, service, repository, utility

    function_name = Column(String, nullable=True)
    class_name = Column(String, nullable=True)
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)

    qdrant_point_id = Column(String, nullable=True, unique=True, index=True)

    # Relationships
    repository = relationship("Repository", back_populates="chunks")
    file = relationship("File", back_populates="chunks")
    questions = relationship("Question", secondary="question_chunk", back_populates="chunks")

    def __repr__(self):
        return f"<Chunk {self.chunk_type} in {self.file_id}>"
