import re
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.core.database import get_session
from app.models.db.repository import Repository
from app.models.db.ingestion_job import IngestionJob
from app.models.db.chunk import Chunk as ChunkModel
from app.models.db.user import User
from app.models.schemas import (
    RepositoryListResponse,
    RepositoryResponse,
    IngestRepoRequest,
    IngestionJobResponse,
    RepositoryDeleteResponse,
)
from app.api.routes.auth import get_current_user_dependency
from app.services.ingestion import pipeline
from app.core.qdrant import get_qdrant_client
from app.services.ingestion.store import delete_from_qdrant

router = APIRouter(prefix="/repos", tags=["repositories"])

# Per-user limits (from Project_Spec.md)
MAX_REPOS_STORED  = 3
MAX_REPOS_PER_DAY = 3
MAX_CHUNKS_TOTAL  = 100_000

_GITHUB_URL_RE = re.compile(
    r"^https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+/?$"
)


@router.get("", response_model=RepositoryListResponse)
async def list_repos(
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> RepositoryListResponse:
    """List user's repositories."""
    result = await session.execute(
        select(Repository).where(Repository.user_id == current_user.id)
    )
    repos = result.scalars().all()
    return RepositoryListResponse(repositories=[_repo_to_response(r) for r in repos])


@router.get("/ingest/{job_id}/status")
async def get_ingestion_status(
    job_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """Poll ingestion job status."""
    result = await session.execute(
        select(IngestionJob).where(IngestionJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")

    # Verify ownership
    repo_result = await session.execute(
        select(Repository).where(
            (Repository.id == job.repository_id)
            & (Repository.user_id == current_user.id)
        )
    )
    if not repo_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "job_id": str(job.id),
        "status": job.status,
        "progress_pct": job.progress_pct,
        "progress_message": job.progress_message,
        "error": job.error,
        "cancelled": job.cancelled,
    }


@router.post("/ingest", response_model=IngestionJobResponse, status_code=202)
async def ingest_repo(
    request: IngestRepoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> IngestionJobResponse:
    """Submit a GitHub repository for ingestion."""
    # ── Validate URL ─────────────────────────────────────────────────────────
    github_url = request.github_url.rstrip("/")
    if not _GITHUB_URL_RE.match(github_url):
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub URL. Expected: https://github.com/owner/repo",
        )

    # ── Rate limit checks ────────────────────────────────────────────────────
    await _reset_daily_counter_if_needed(session, current_user)

    repo_count = await _count_user_repos(session, current_user.id)
    if repo_count >= MAX_REPOS_STORED:
        raise HTTPException(
            status_code=409,
            detail=f"You have reached the {MAX_REPOS_STORED}-repository limit. "
                   "Delete a repository to add a new one.",
        )

    if current_user.repos_analyzed_today >= MAX_REPOS_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {MAX_REPOS_PER_DAY} ingestions reached. "
                   "Resets at midnight UTC.",
        )

    total_chunks = await _count_user_chunks(session, current_user.id)
    if total_chunks >= MAX_CHUNKS_TOTAL:
        raise HTTPException(
            status_code=409,
            detail=f"Chunk limit ({MAX_CHUNKS_TOTAL:,}) reached. "
                   "Delete a repository to free space.",
        )

    # ── Check for duplicate URL ──────────────────────────────────────────────
    existing = await session.execute(
        select(Repository).where(
            (Repository.user_id == current_user.id)
            & (Repository.github_url == github_url)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="This repository is already indexed.",
        )

    # ── Create DB records ────────────────────────────────────────────────────
    repo_name = github_url.split("/")[-1]
    repo = Repository(
        id=uuid.uuid4(),
        user_id=current_user.id,
        github_url=github_url,
        name=repo_name,
        status="pending",
        chunk_count=0,
    )
    session.add(repo)
    await session.flush()

    job = IngestionJob(
        id=uuid.uuid4(),
        repository_id=repo.id,
        status="pending",
        progress_pct=0,
        progress_message="Queued...",
    )
    session.add(job)

    # Increment daily counter
    current_user.repos_analyzed_today += 1
    await session.commit()

    # ── Fire pipeline in background ──────────────────────────────────────────
    background_tasks.add_task(
        pipeline.run,
        job_id=str(job.id),
        repository_id=str(repo.id),
        github_url=github_url,
    )

    return IngestionJobResponse(
        job_id=job.id,
        repository_id=repo.id,
        status="pending",
        github_url=github_url,
    )


@router.post("/ingest/{job_id}/cancel")
async def cancel_ingestion(
    job_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """Cancel a running ingestion job and delete the repository record."""
    result = await session.execute(
        select(IngestionJob).where(IngestionJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")

    # Verify ownership
    repo_result = await session.execute(
        select(Repository).where(
            (Repository.id == job.repository_id)
            & (Repository.user_id == current_user.id)
        )
    )
    repo = repo_result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=403, detail="Forbidden")

    if job.status in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="Job already finished — cannot cancel.")

    # Set the cancellation flag so the pipeline aborts at its next checkpoint
    job.cancelled = True
    job.status = "cancelled"
    job.progress_message = "Cancelling…"
    await session.commit()

    # Delete vectors from Qdrant (best-effort — may not exist yet)
    try:
        qdrant_client = await get_qdrant_client()
        await delete_from_qdrant(qdrant_client, str(repo.id))
    except Exception:
        pass

    # Delete the repo record so the user's slot is freed immediately
    await session.delete(repo)
    await session.commit()

    return {"message": "Ingestion cancelled"}


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repo(
    repo_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> RepositoryResponse:
    """Get single repository details including dashboard content."""
    repo = await _get_repo_or_404(session, repo_id, current_user.id)
    return _repo_to_response(repo)


@router.delete("/{repo_id}", response_model=RepositoryDeleteResponse)
async def delete_repo(
    repo_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> RepositoryDeleteResponse:
    """Delete a repository — removes vectors from Qdrant and records from DB."""
    repo = await _get_repo_or_404(session, repo_id, current_user.id)

    # Delete vectors from Qdrant first
    try:
        qdrant_client = await get_qdrant_client()
        await delete_from_qdrant(qdrant_client, str(repo.id))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "Qdrant delete failed for repo %s: %s", repo_id, exc
        )

    await session.delete(repo)
    await session.commit()

    return RepositoryDeleteResponse(message="Repository deleted successfully")


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_repo_or_404(
    session: AsyncSession, repo_id: str, user_id
) -> Repository:
    result = await session.execute(
        select(Repository).where(
            (Repository.id == repo_id) & (Repository.user_id == user_id)
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


async def _count_user_repos(session: AsyncSession, user_id) -> int:
    result = await session.execute(
        select(func.count()).where(Repository.user_id == user_id)
    )
    return result.scalar() or 0


async def _count_user_chunks(session: AsyncSession, user_id) -> int:
    result = await session.execute(
        select(func.count(ChunkModel.id))
        .join(Repository, ChunkModel.repository_id == Repository.id)
        .where(Repository.user_id == user_id)
    )
    return result.scalar() or 0


async def _reset_daily_counter_if_needed(
    session: AsyncSession, user: User
) -> None:
    """Reset repos_analyzed_today if last reset was on a different UTC date."""
    now = datetime.utcnow()
    last_reset = user.last_reset_at

    if last_reset is None or last_reset.date() < now.date():
        user.repos_analyzed_today = 0
        user.last_reset_at = now
        await session.flush()


def _repo_to_response(repo: Repository) -> RepositoryResponse:
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
