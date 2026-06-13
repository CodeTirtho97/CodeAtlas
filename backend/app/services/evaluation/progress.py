"""In-memory progress registry for eval runs.

An eval run is ephemeral and at most one is in flight per repository at a time,
so a process-local dict is enough — no DB table / migration needed. The final
report is still persisted on the Repository row (`eval_report_json`); this only
tracks the live run so the UI can show stepped progress while it works.

Lifecycle: start() → update()×N → finish() | fail(). The frontend polls get()
via GET /repos/{id}/eval/status and stops once status is "completed"/"failed".
"""
import time
from typing import Dict, Optional, TypedDict


class EvalProgress(TypedDict):
    status: str          # "running" | "completed" | "failed"
    progress_pct: int    # 0–100, monotonically increasing
    step: str            # "questions" | "retrieval" | "ablation" | "generation" | "done" | "error"
    message: str
    error: Optional[str]
    updated_at: float


_jobs: Dict[str, EvalProgress] = {}


def start(repo_id: str) -> None:
    _jobs[repo_id] = {
        "status": "running",
        "progress_pct": 0,
        "step": "questions",
        "message": "Building question set…",
        "error": None,
        "updated_at": time.time(),
    }


def update(repo_id: str, *, pct: int, step: str, message: str) -> None:
    job = _jobs.get(repo_id)
    if job is None:
        return
    # Clamp and keep pct monotonic so the bar never jumps backward between phases.
    job["progress_pct"] = max(job["progress_pct"], min(pct, 99))
    job["step"] = step
    job["message"] = message
    job["updated_at"] = time.time()


def finish(repo_id: str) -> None:
    job = _jobs.get(repo_id)
    if job is None:
        return
    job.update(
        status="completed", progress_pct=100, step="done",
        message="Done", updated_at=time.time(),
    )


def fail(repo_id: str, error: str) -> None:
    _jobs[repo_id] = {
        "status": "failed",
        "progress_pct": (_jobs.get(repo_id) or {}).get("progress_pct", 0),
        "step": "error",
        "message": "Evaluation failed",
        "error": error,
        "updated_at": time.time(),
    }


def is_running(repo_id: str) -> bool:
    job = _jobs.get(repo_id)
    return bool(job and job["status"] == "running")


def get(repo_id: str) -> Optional[EvalProgress]:
    return _jobs.get(repo_id)


def clear(repo_id: str) -> None:
    _jobs.pop(repo_id, None)
