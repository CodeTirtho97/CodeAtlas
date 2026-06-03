"""Ingestion pipeline orchestrator.

Called by FastAPI BackgroundTasks. Creates its own DB session so it
can outlive the HTTP request that started it.

Progress sequence (matches Project_Spec.md §15 Implementation Plan):
  5%  Cloning repository
 15%  Filtering files
 20%  Parsing code
 50%  Generating embeddings
 75%  Storing vectors + DB records
 85%  Building dependency graph
 88%  Extracting API endpoints
 92%  Generating repository summary
 96%  Generating onboarding guide
100%  Completed
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.core.qdrant import get_qdrant_client
from app.models.db.ingestion_job import IngestionJob
from app.models.db.repository import Repository
from app.services.ingestion.cloner import clone_repo, cleanup_repo, ClonerError
from app.services.ingestion.file_filter import get_filtered_files
from app.services.ingestion.parser import parse_all_files
from app.services.ingestion.embedder import embed_chunks
from app.services.ingestion.store import (
    store_in_qdrant,
    store_in_postgres,
)
from app.services.analysis.dependency_graph import build_dependency_graph
from app.services.analysis.api_extractor import extract_endpoints
from app.services.generation.summarizer import generate_summary
from app.services.generation.onboarding import generate_onboarding_guide

log = logging.getLogger(__name__)


# ─── Entry Point (called by BackgroundTasks) ─────────────────────────────────

async def run(job_id: str, repository_id: str, github_url: str) -> None:
    """Run the full ingestion pipeline for one repository.

    Creates its own DB session — safe to call from BackgroundTasks.
    Always cleans up the temp clone directory, even on failure.
    """
    clone_dir: Optional[Path] = None

    async with AsyncSessionLocal() as session:
        try:
            clone_dir = await _run_pipeline(
                session, job_id, repository_id, github_url
            )
        except ClonerError as exc:
            log.warning("Clone failed for job %s: %s", job_id, exc)
            await _fail_job(session, job_id, str(exc))
        except (ValueError, RuntimeError) as exc:
            # Known pipeline errors — message is already user-readable
            log.error("Pipeline failed for job %s: %s", job_id, exc)
            await _fail_job(session, job_id, str(exc))
        except Exception as exc:
            log.error(
                "Pipeline failed for job %s: %s", job_id, exc, exc_info=True
            )
            await _fail_job(session, job_id, f"Unexpected error: {type(exc).__name__}: {exc}")
        finally:
            cleanup_repo(job_id)


# ─── Pipeline Steps ───────────────────────────────────────────────────────────

async def _run_pipeline(
    session: AsyncSession,
    job_id: str,
    repository_id: str,
    github_url: str,
) -> Path:
    # ── Step 1: Clone ────────────────────────────────────────────────────────
    await _update_job(session, job_id, pct=5, msg="Cloning repository...")
    clone_dir = await asyncio.to_thread(clone_repo, github_url, job_id)

    # ── Step 2: Filter files ─────────────────────────────────────────────────
    await _update_job(session, job_id, pct=15, msg="Filtering files...")
    files = await asyncio.to_thread(get_filtered_files, clone_dir)

    if not files:
        raise ValueError("No indexable files found in this repository.")

    log.info(
        "Job %s: found %d files to index in %s",
        job_id, len(files), github_url,
    )

    # ── Step 3: Parse code ───────────────────────────────────────────────────
    await _update_job(session, job_id, pct=20, msg="Parsing code...")
    chunks = await asyncio.to_thread(parse_all_files, files)

    if not chunks:
        raise ValueError("No chunks extracted from repository files.")

    log.info("Job %s: extracted %d chunks", job_id, len(chunks))

    # ── Step 4: Generate embeddings ──────────────────────────────────────────
    await _update_job(session, job_id, pct=50, msg="Generating embeddings...")
    # embed_chunks raises RuntimeError with the actual API error if all batches fail
    chunks_with_embeddings = await asyncio.to_thread(embed_chunks, chunks)

    # ── Step 5: Store vectors + DB records ───────────────────────────────────
    await _update_job(session, job_id, pct=75, msg="Storing vectors...")
    qdrant_client = await get_qdrant_client()
    point_id_map = await store_in_qdrant(
        qdrant_client, chunks_with_embeddings, repository_id
    )
    await store_in_postgres(session, chunks, files, repository_id, point_id_map)

    # ── Step 6: Dependency graph ─────────────────────────────────────────────
    await _update_job(session, job_id, pct=85, msg="Building dependency graph...")
    dep_json = await asyncio.to_thread(build_dependency_graph, chunks)

    # ── Step 7: API endpoint extraction ──────────────────────────────────────
    await _update_job(session, job_id, pct=88, msg="Extracting API endpoints...")
    endpoints_json = extract_endpoints(chunks)

    # ── Step 8: Repository summary (Gemini) ───────────────────────────────────
    await _update_job(session, job_id, pct=92, msg="Generating repository summary...")
    summary_json = await asyncio.to_thread(
        generate_summary, github_url, clone_dir
    )

    # ── Step 9: Onboarding guide (Gemini) ─────────────────────────────────────
    await _update_job(session, job_id, pct=96, msg="Generating onboarding guide...")
    onboarding_json = await asyncio.to_thread(
        generate_onboarding_guide, summary_json, files, chunks
    )

    # ── Step 10: Persist generated content + mark completed ───────────────────
    await _finalize(
        session,
        job_id=job_id,
        repository_id=repository_id,
        chunk_count=len(chunks),
        summary_json=summary_json,
        onboarding_json=onboarding_json,
        endpoints_json=endpoints_json,
        dep_json=dep_json,
    )

    log.info(
        "Job %s completed: %d chunks, %d endpoints, %d dep edges",
        job_id,
        len(chunks),
        len(endpoints_json),
        len(dep_json),
    )
    return clone_dir


# ─── DB Helpers ───────────────────────────────────────────────────────────────

async def _update_job(
    session: AsyncSession,
    job_id: str,
    pct: int = None,
    msg: str = None,
    status: str = "running",
    error: str = None,
) -> None:
    result = await session.execute(
        select(IngestionJob).where(IngestionJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        return

    job.status = status
    if pct is not None:
        job.progress_pct = pct
    if msg is not None:
        job.progress_message = msg
    if error is not None:
        job.error = error

    await session.commit()


async def _fail_job(
    session: AsyncSession, job_id: str, error: str
) -> None:
    await _update_job(
        session, job_id,
        status="failed",
        pct=0,
        msg="Ingestion failed",
        error=error,
    )
    # Also mark the repository as failed
    result = await session.execute(
        select(IngestionJob).where(IngestionJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if job:
        repo_result = await session.execute(
            select(Repository).where(Repository.id == job.repository_id)
        )
        repo = repo_result.scalar_one_or_none()
        if repo:
            repo.status = "failed"
            await session.commit()


async def _finalize(
    session: AsyncSession,
    job_id: str,
    repository_id: str,
    chunk_count: int,
    summary_json: dict,
    onboarding_json: dict,
    endpoints_json: list,
    dep_json: dict,
) -> None:
    """Update repository with generated content and mark job as completed."""
    # Update repository record
    repo_result = await session.execute(
        select(Repository).where(Repository.id == repository_id)
    )
    repo = repo_result.scalar_one_or_none()
    if repo:
        repo.status = "completed"
        repo.chunk_count = chunk_count
        repo.summary_json = summary_json
        repo.onboarding_json = onboarding_json
        repo.api_endpoints_json = endpoints_json
        repo.dependency_json = dep_json

    # Mark job completed
    await _update_job(
        session, job_id,
        status="completed",
        pct=100,
        msg="Ingestion complete!",
    )

    await session.commit()
