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
from typing import List, Optional, Set

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
    delete_files_from_qdrant,
    delete_files_from_postgres,
)
from app.services.analysis.dependency_graph import build_dependency_graph
from app.services.analysis.api_extractor import extract_endpoints
from app.services.generation.summarizer import generate_summary
from app.services.generation.onboarding import generate_onboarding_guide

log = logging.getLogger(__name__)


class PipelineCancelledError(Exception):
    """Raised when the pipeline detects a user-requested cancellation."""


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
        except PipelineCancelledError:
            log.info("Pipeline cancelled by user for job %s", job_id)
        except ClonerError as exc:
            log.warning("Clone failed for job %s: %s", job_id, exc)
            await _fail_job(session, job_id, _friendly_clone_error(str(exc)))
        except ValueError as exc:
            log.error("Pipeline validation error for job %s: %s", job_id, exc)
            await _fail_job(session, job_id, str(exc))
        except RuntimeError as exc:
            log.error("Pipeline runtime error for job %s: %s", job_id, exc)
            await _fail_job(session, job_id, _friendly_runtime_error(str(exc)))
        except Exception as exc:
            log.error("Pipeline failed for job %s: %s", job_id, exc, exc_info=True)
            await _fail_job(session, job_id, "Something went wrong on our end. Please try again.")
        finally:
            cleanup_repo(job_id)


# ─── Pipeline Steps ───────────────────────────────────────────────────────────

def _friendly_clone_error(raw: str) -> str:
    r = raw.lower()
    if "not found" in r or "404" in r or "repository not found" in r:
        return "Repository not found. Make sure it's public and the URL is correct."
    if "authentication" in r or "403" in r or "permission" in r or "access denied" in r:
        return "Access denied. Only public repositories are supported."
    if "timeout" in r or "timed out" in r:
        return "Cloning timed out. The repository may be too large or GitHub is slow right now. Try again."
    if "invalid" in r or "bad url" in r:
        return "Invalid repository URL. Please check the URL and try again."
    return "Could not clone the repository. Check that it's public and try again."


def _friendly_runtime_error(raw: str) -> str:
    r = raw.lower()
    if "embed" in r or "embedding" in r or "google" in r or "api key" in r:
        return "The AI embedding service is temporarily unavailable. Please try again in a few minutes."
    if "qdrant" in r or "vector" in r:
        return "The vector database is temporarily unavailable. Please try again shortly."
    if "gemini" in r or "summary" in r or "onboarding" in r:
        return "The AI summarisation service is temporarily unavailable. Please try again in a few minutes."
    return "Something went wrong during indexing. Please try again."


async def _check_cancelled(session: AsyncSession, job_id: str) -> None:
    """Raise PipelineCancelledError if the job has been flagged for cancellation."""
    result = await session.execute(
        select(IngestionJob).where(IngestionJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if job and job.cancelled:
        raise PipelineCancelledError()


def _get_head_sha(clone_dir: Path) -> Optional[str]:
    """Return the HEAD commit SHA of the cloned repository."""
    try:
        from git import Repo as GitRepo
        return GitRepo(str(clone_dir)).head.commit.hexsha
    except Exception:
        return None


def _get_changed_files(clone_dir: Path, old_sha: str) -> Optional[Set[str]]:
    """Return the set of relative file paths changed between old_sha and HEAD.

    Returns None if the diff cannot be computed (e.g. old_sha no longer in history).
    """
    try:
        from git import Repo as GitRepo
        repo = GitRepo(str(clone_dir))
        old_commit = repo.commit(old_sha)
        diff = old_commit.diff(repo.head.commit)
        changed: Set[str] = set()
        for item in diff:
            if item.a_path:
                changed.add(item.a_path)
            if item.b_path:
                changed.add(item.b_path)
        return changed
    except Exception as exc:
        log.warning("Could not compute git diff from %s: %s — falling back to full re-index", old_sha, exc)
        return None


async def _run_pipeline(
    session: AsyncSession,
    job_id: str,
    repository_id: str,
    github_url: str,
) -> Path:
    # ── Step 1: Clone ────────────────────────────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=5, msg="Cloning repository...")
    clone_dir = await asyncio.to_thread(clone_repo, github_url, job_id)

    # ── Determine incremental vs full re-index ───────────────────────────────
    head_sha = await asyncio.to_thread(_get_head_sha, clone_dir)
    repo_record = (await session.execute(
        select(Repository).where(Repository.id == repository_id)
    )).scalar_one_or_none()

    old_sha = repo_record.indexed_commit_sha if repo_record else None
    incremental = False
    changed_relative_paths: Optional[Set[str]] = None

    if old_sha and head_sha and old_sha != head_sha:
        changed_relative_paths = await asyncio.to_thread(
            _get_changed_files, clone_dir, old_sha
        )
        if changed_relative_paths is not None:
            incremental = True
            log.info(
                "Job %s: incremental re-index — %d file(s) changed since %s",
                job_id, len(changed_relative_paths), old_sha[:8],
            )

    # ── Step 2: Filter files ─────────────────────────────────────────────────
    await _check_cancelled(session, job_id)
    mode_label = "changed files" if incremental else "files"
    await _update_job(session, job_id, pct=15, msg=f"Filtering {mode_label}...")
    all_files = await asyncio.to_thread(get_filtered_files, clone_dir)

    if not all_files:
        raise ValueError("No indexable code files found. The repository may be empty, documentation-only, or use unsupported languages.")

    # In incremental mode, restrict to files that changed
    if incremental and changed_relative_paths is not None:
        files = [f for f in all_files if f.relative_path in changed_relative_paths]
        if not files:
            log.info("Job %s: no indexable files changed — skipping embed step", job_id)
            await _finalize(
                session,
                job_id=job_id,
                repository_id=repository_id,
                chunk_count=repo_record.chunk_count or 0,
                summary_json=repo_record.summary_json,
                onboarding_json=repo_record.onboarding_json,
                endpoints_json=repo_record.api_endpoints_json,
                dep_json=repo_record.dependency_json,
                new_commit_sha=head_sha,
            )
            return clone_dir
    else:
        files = all_files

    log.info("Job %s: found %d files to index in %s", job_id, len(files), github_url)

    # ── Step 3: Parse code ───────────────────────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=20, msg="Parsing code...")
    chunks = await asyncio.to_thread(parse_all_files, files)

    if not chunks:
        raise ValueError("Couldn't extract any code structures. The files may use an unsupported format or be mostly non-code content.")

    log.info("Job %s: extracted %d chunks", job_id, len(chunks))

    # ── Step 4: Generate embeddings ──────────────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=50, msg="Generating embeddings...")
    chunks_with_embeddings = await asyncio.to_thread(embed_chunks, chunks)

    embedded_count = len(chunks_with_embeddings)
    total_count = len(chunks)
    if embedded_count < total_count:
        skipped = total_count - embedded_count
        log.warning(
            "Job %s: %d/%d chunks failed to embed and were skipped",
            job_id, skipped, total_count,
        )

    # ── Step 5: Store vectors + DB records ───────────────────────────────────
    await _check_cancelled(session, job_id)
    store_msg = (
        f"Storing vectors... ({embedded_count:,}/{total_count:,} chunks indexed)"
        if embedded_count < total_count
        else "Storing vectors..."
    )
    await _update_job(session, job_id, pct=75, msg=store_msg)
    qdrant_client = await get_qdrant_client()

    # In incremental mode, delete stale vectors/records for changed files first
    if incremental:
        changed_paths = [f.relative_path for f in files]
        await delete_files_from_qdrant(qdrant_client, repository_id, changed_paths)
        await delete_files_from_postgres(session, repository_id, changed_paths)

    point_id_map = await store_in_qdrant(
        qdrant_client, chunks_with_embeddings, repository_id
    )
    await store_in_postgres(session, chunks, files, repository_id, point_id_map)

    # For incremental, total chunk count = old total - deleted + new embedded
    if incremental and repo_record:
        from sqlalchemy import func as sql_func
        from app.models.db.chunk import Chunk as ChunkModel
        total_embedded = await session.scalar(
            select(sql_func.count(ChunkModel.id)).where(
                ChunkModel.repository_id == repository_id
            )
        ) or embedded_count
    else:
        total_embedded = embedded_count

    # ── Step 6: Dependency graph ─────────────────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=85, msg="Building dependency graph...")
    dep_json = await asyncio.to_thread(build_dependency_graph, chunks)

    # ── Step 7: API endpoint extraction ──────────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=88, msg="Extracting API endpoints...")
    endpoints_json = extract_endpoints(chunks)

    # ── Step 8: Repository summary (Gemini) ───────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=92, msg="Generating repository summary...")
    summary_json = await asyncio.to_thread(
        generate_summary, github_url, clone_dir
    )

    # ── Step 9: Onboarding guide (Gemini) ─────────────────────────────────────
    await _check_cancelled(session, job_id)
    await _update_job(session, job_id, pct=96, msg="Generating onboarding guide...")
    onboarding_json = await asyncio.to_thread(
        generate_onboarding_guide, summary_json, files, chunks
    )

    # ── Step 10: Persist generated content + mark completed ───────────────────
    await _finalize(
        session,
        job_id=job_id,
        repository_id=repository_id,
        chunk_count=total_embedded,
        summary_json=summary_json,
        onboarding_json=onboarding_json,
        endpoints_json=endpoints_json,
        dep_json=dep_json,
        new_commit_sha=head_sha,
    )

    log.info(
        "Job %s completed (%s): %d chunks indexed, %d endpoints, %d dep edges",
        job_id,
        "incremental" if incremental else "full",
        total_embedded,
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
    new_commit_sha: Optional[str] = None,
) -> None:
    """Update repository with generated content and mark job as completed."""
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
        if new_commit_sha:
            repo.indexed_commit_sha = new_commit_sha

    # Mark job completed
    await _update_job(
        session, job_id,
        status="completed",
        pct=100,
        msg="Ingestion complete!",
    )

    await session.commit()
