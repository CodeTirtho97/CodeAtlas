from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


class IngestRepoRequest(BaseModel):
    github_url: str


class IngestionJobResponse(BaseModel):
    job_id: UUID
    repository_id: UUID
    status: str
    github_url: str


class IngestionStatusResponse(BaseModel):
    job_id: UUID
    status: str  # pending, running, completed, failed
    progress_pct: int
    progress_message: str
    error: Optional[str] = None


class RepositoryBase(BaseModel):
    name: str
    github_url: str
    status: str
    chunk_count: int


class RepositoryResponse(RepositoryBase):
    id: UUID
    created_at: datetime
    summary: Optional[dict] = None
    onboarding: Optional[dict] = None
    api_endpoints: Optional[List[dict]] = None
    dependencies: Optional[dict] = None

    class Config:
        from_attributes = True


class RepositoryListResponse(BaseModel):
    repositories: List[RepositoryResponse]


class RepositoryDeleteResponse(BaseModel):
    message: str = "Repository deleted successfully"
