from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.routes.auth import get_current_user_dependency
from app.core.database import get_session
from app.core.qdrant import get_qdrant_client
from app.models.db.repository import Repository
from app.models.db.user import User
from app.services.evaluation.retrieval_eval import run_evaluation

router = APIRouter(prefix="/repos", tags=["evaluation"])


class QuestionResultResponse(BaseModel):
    question: str
    question_type: str = "endpoint"
    endpoint: str = ""
    expected_file: str
    retrieved_files: List[str]
    hit: bool
    rank: Optional[int]
    reciprocal_rank: float
    answer: Optional[str] = None
    citation_hit: bool = False


class AblationResultResponse(BaseModel):
    mode: str
    recall_at_5: float
    mrr: float
    total_questions: int
    passed: int


class PreviousRunSummary(BaseModel):
    """Headline metrics of the run before this one — lets the UI show a trend."""
    recall_at_5: float
    mrr: float
    total_questions: int
    passed: int
    citation_precision: Optional[float] = None
    ran_at: Optional[datetime] = None


class EvalReportResponse(BaseModel):
    recall_at_5: float
    mrr: float
    total_questions: int
    passed: int
    results: List[QuestionResultResponse]
    ablation: List[AblationResultResponse] = []
    citation_precision: Optional[float] = None
    ran_at: Optional[datetime] = None
    previous: Optional[PreviousRunSummary] = None


def _repo_to_response(repo: Repository) -> EvalReportResponse:
    """Build EvalReportResponse from a repo's cached eval_report_json."""
    d = repo.eval_report_json
    prev = d.get("previous")
    return EvalReportResponse(
        recall_at_5=d["recall_at_5"],
        mrr=d["mrr"],
        total_questions=d["total_questions"],
        passed=d["passed"],
        results=[QuestionResultResponse(**r) for r in d["results"]],
        ablation=[AblationResultResponse(**a) for a in d.get("ablation", [])],
        citation_precision=d.get("citation_precision"),
        ran_at=repo.eval_ran_at,
        previous=PreviousRunSummary(**prev) if prev else None,
    )


async def _get_repo(session: AsyncSession, repo_id: str, user_id) -> Repository:
    result = await session.execute(
        select(Repository).where(
            (Repository.id == repo_id) & (Repository.user_id == user_id)
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@router.get("/{repo_id}/eval/result", response_model=Optional[EvalReportResponse])
async def get_cached_eval(
    repo_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """Return the last cached eval result, or null if never run."""
    repo = await _get_repo(session, repo_id, current_user.id)
    if not repo.eval_report_json:
        return None
    return _repo_to_response(repo)


@router.post("/{repo_id}/eval/run", response_model=EvalReportResponse)
async def run_retrieval_eval(
    repo_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> EvalReportResponse:
    """Run a RAG retrieval evaluation and persist the result."""
    repo = await _get_repo(session, repo_id, current_user.id)
    if repo.status != "completed":
        raise HTTPException(status_code=400, detail="Repository indexing not completed")
    if not repo.api_endpoints_json:
        raise HTTPException(
            status_code=400,
            detail="No API endpoints found. Cannot build a golden question set.",
        )

    qdrant_client = await get_qdrant_client()
    report = await run_evaluation(
        repo_id=str(repo.id),
        api_endpoints_json=repo.api_endpoints_json,
        qdrant_client=qdrant_client,
        dependency_json=repo.dependency_json,
    )

    # Snapshot the run being replaced so the UI can show a since-last-run delta
    previous = None
    if repo.eval_report_json:
        old = repo.eval_report_json
        previous = {
            "recall_at_5": old["recall_at_5"],
            "mrr": old["mrr"],
            "total_questions": old["total_questions"],
            "passed": old["passed"],
            "citation_precision": old.get("citation_precision"),
            "ran_at": repo.eval_ran_at.isoformat() if repo.eval_ran_at else None,
        }

    # Persist result so next visit loads instantly
    report_dict = {
        "previous": previous,
        "recall_at_5": report.recall_at_5,
        "mrr": report.mrr,
        "total_questions": report.total_questions,
        "passed": report.passed,
        "citation_precision": report.citation_precision,
        "ablation": [
            {
                "mode": a.mode,
                "recall_at_5": a.recall_at_5,
                "mrr": a.mrr,
                "total_questions": a.total_questions,
                "passed": a.passed,
            }
            for a in report.ablation
        ],
        "results": [
            {
                "question": r.question,
                "question_type": r.question_type,
                "endpoint": r.endpoint,
                "expected_file": r.expected_file,
                "retrieved_files": r.retrieved_files,
                "hit": r.hit,
                "rank": r.rank,
                "reciprocal_rank": r.reciprocal_rank,
                "answer": r.answer,
                "citation_hit": r.citation_hit,
            }
            for r in report.results
        ],
    }
    repo.eval_report_json = report_dict
    repo.eval_ran_at = datetime.utcnow()
    await session.commit()
    await session.refresh(repo)

    return _repo_to_response(repo)
