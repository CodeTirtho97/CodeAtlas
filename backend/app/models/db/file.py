from sqlalchemy import Column, String, UUID, ForeignKey
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class File(BaseModel):
    """File model."""

    __tablename__ = "files"

    repository_id = Column(
        UUID, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path = Column(String, nullable=False)
    language = Column(String)
    language_tier = Column(String)  # 1 or 2

    # Relationships
    repository = relationship("Repository", back_populates="files")
    chunks = relationship("Chunk", back_populates="file", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<File {self.path}>"
