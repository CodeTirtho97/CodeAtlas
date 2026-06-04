import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_session
from app.core.qdrant import get_qdrant_client
from app.models.db.question import Question
from app.models.db.repository import Repository
from app.models.db.user import User
from app.models.schemas import QueryRequest, QueryResponse, SourceCitation
from app.api.routes.auth import get_current_user_dependency
from app.services.generation.qa import answer_question

router = APIRouter(prefix="/query", tags=["queries"])


@router.post("", response_model=QueryResponse)
async def submit_query(
    request: QueryRequest,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> QueryResponse:
    """Submit a natural language question about a repository."""

    # Validate question length
    question = request.question.strip()
    if len(question) < 10:
        raise HTTPException(status_code=400, detail="Question too short (min 10 chars).")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question too long (max 1000 chars).")

    # Verify repository belongs to user and is indexed
    repo = await _get_indexed_repo(session, str(request.repository_id), current_user.id)

    # Run Q&A pipeline
    qdrant_client = await get_qdrant_client()
    result = await answer_question(
        client=qdrant_client,
        question=question,
        repository_id=str(repo.id),
        repo_name=repo.name,
    )

    # Persist question + answer
    question_record = Question(
        id=uuid.uuid4(),
        repository_id=repo.id,
        user_id=current_user.id,
        question=question,
        answer=result["answer"],
    )
    session.add(question_record)
    await session.commit()

    sources = [
        SourceCitation(
            file_path=s["file_path"],
            function_name=s.get("function_name"),
            class_name=s.get("class_name"),
            line_start=s.get("line_start"),
            line_end=s.get("line_end"),
            chunk_type=s.get("chunk_type") or "function",
        )
        for s in result["sources"]
    ]

    return QueryResponse(
        question_id=question_record.id,
        question=question,
        answer=result["answer"],
        sources=sources,
        created_at=question_record.created_at or datetime.utcnow(),
    )


@router.get("/{question_id}", response_model=QueryResponse)
async def get_question(
    question_id: str,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> QueryResponse:
    """Retrieve a previous question and answer by ID."""

    result = await session.execute(
        select(Question).where(
            (Question.id == question_id) & (Question.user_id == current_user.id)
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    return QueryResponse(
        question_id=question.id,
        question=question.question,
        answer=question.answer or "",
        sources=[],
        created_at=question.created_at or datetime.utcnow(),
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_indexed_repo(
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
    if repo.status != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Repository is not ready (status: {repo.status}). "
                   "Wait for ingestion to complete before querying.",
        )
    return repo
