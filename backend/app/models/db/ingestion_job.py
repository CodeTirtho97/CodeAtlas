from sqlalchemy import Column, String, Integer, UUID, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class IngestionJob(BaseModel):
    """Ingestion job tracking model."""

    __tablename__ = "ingestion_jobs"

    repository_id = Column(
        UUID, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status = Column(String, default="pending")  # pending, running, completed, failed
    progress_pct = Column(Integer, default=0)
    progress_message = Column(String, default="Initializing...")
    error = Column(Text, nullable=True)

    # Relationships
    repository = relationship("Repository", back_populates="ingestion_jobs")

    def __repr__(self):
        return f"<IngestionJob {self.id} {self.status}>"
