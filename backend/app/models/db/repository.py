from sqlalchemy import Column, String, Integer, UUID, ForeignKey, JSON, Text, DateTime
from sqlalchemy.orm import relationship
from app.models.db.base import BaseModel


class Repository(BaseModel):
    """Repository model."""

    __tablename__ = "repositories"

    user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    github_url = Column(String, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, running, completed, failed
    chunk_count = Column(Integer, default=0)

    # Auto-generated content
    summary_json = Column(JSON, nullable=True)  # {purpose, stack, architecture, entry_points}
    onboarding_json = Column(JSON, nullable=True)  # {steps, core_workflows, learning_path}
    api_endpoints_json = Column(JSON, nullable=True)  # [{method, path, file_path, function_name}]
    dependency_json = Column(JSON, nullable=True)  # {file: {uses: [], used_by: []}}

    # Cached eval result
    eval_report_json = Column(JSON, nullable=True)  # full EvalReport stored after run
    eval_ran_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="repositories")
    files = relationship("File", back_populates="repository", cascade="all, delete-orphan")
    chunks = relationship("Chunk", back_populates="repository", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="repository", cascade="all, delete-orphan")
    ingestion_jobs = relationship(
        "IngestionJob", back_populates="repository", cascade="all, delete-orphan"
    )
    chat_sessions = relationship("ChatSession", back_populates="repository", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Repository {self.name}>"
