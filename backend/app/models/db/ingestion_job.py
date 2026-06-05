from sqlalchemy import Column, String, Integer, UUID, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class IngestionJob(BaseModel):
    """Ingestion job tracking model."""

    __tablename__ = "ingestion_jobs"

    repository_id = Column(
        UUID, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status = Column(String, default="pending")  # pending, running, completed, failed, cancelled
    progress_pct = Column(Integer, default=0)
    progress_message = Column(String, default="Initializing...")
    error = Column(Text, nullable=True)
    cancelled = Column(Boolean, default=False, nullable=False)

    # Relationships
    repository = relationship("Repository", back_populates="ingestion_jobs")

    def __repr__(self):
        return f"<IngestionJob {self.id} {self.status}>"
