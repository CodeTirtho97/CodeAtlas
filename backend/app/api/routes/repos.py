from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_session
from app.models.db import Repository, IngestionJob, User
from app.models.schemas import (
    RepositoryListResponse,
    RepositoryResponse,
    IngestRepoRequest,
    IngestionJobResponse,
    RepositoryDeleteResponse,
)
from app.api.routes.auth import get_current_user_dependency

router = APIRouter(prefix="/repos", tags=["repositories"])


@router.get("", response_model=RepositoryListResponse)
async def list_repos(
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
) -> RepositoryListResponse:
    """List user's repositories."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    result = await session.execute(
        select(Repository).where(Repository.user_id == current_user.id)
    )
    repos = result.scalars().all()

    return RepositoryListResponse(
        repositories=[
            RepositoryResponse(
                id=repo.id,
                name=repo.name,
                github_url=repo.github_url,
                status=repo.status,
                chunk_count=repo.chunk_count,
                created_at=repo.created_at,
                summary=repo.summary_json,
                onboarding=repo.onboarding_json,
                api_endpoints=repo.api_endpoints_json,
                dependencies=repo.dependency_json,
            )
            for repo in repos
        ]
    )


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repo(
    repo_id: str,
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
) -> RepositoryResponse:
    """Get single repository details."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    result = await session.execute(
        select(Repository).where(
            (Repository.id == repo_id) & (Repository.user_id == current_user.id)
        )
    )
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    return RepositoryResponse(
        id=repo.id,
        name=repo.name,
        github_url=repo.github_url,
        status=repo.status,
        chunk_count=repo.chunk_count,
        created_at=repo.created_at,
        summary=repo.summary_json,
        onboarding=repo.onboarding_json,
        api_endpoints=repo.api_endpoints_json,
        dependencies=repo.dependency_json,
    )


@router.post("/ingest", response_model=IngestionJobResponse, status_code=202)
async def ingest_repo(
    request: IngestRepoRequest,
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
) -> IngestionJobResponse:
    """Submit repository for ingestion."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    # TODO: Implement actual ingestion logic
    raise HTTPException(
        status_code=501,
        detail="Ingestion pipeline not yet implemented. Coming in Phase 2.",
    )


@router.get("/ingest/{job_id}/status")
async def get_ingestion_status(
    job_id: str,
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
):
    """Poll ingestion job status."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    result = await session.execute(
        select(IngestionJob).where(IngestionJob.id == job_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")

    return {
        "job_id": str(job.id),
        "status": job.status,
        "progress_pct": job.progress_pct,
        "progress_message": job.progress_message,
        "error": job.error,
    }


@router.delete("/{repo_id}", response_model=RepositoryDeleteResponse)
async def delete_repo(
    repo_id: str,
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
) -> RepositoryDeleteResponse:
    """Delete repository."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    result = await session.execute(
        select(Repository).where(
            (Repository.id == repo_id) & (Repository.user_id == current_user.id)
        )
    )
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    await session.delete(repo)
    await session.commit()

    return RepositoryDeleteResponse(message="Repository deleted successfully")
