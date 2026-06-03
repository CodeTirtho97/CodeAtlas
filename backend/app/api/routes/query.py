from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_session
from app.models.db import Question, Repository, User
from app.models.schemas import QueryRequest, QueryResponse
from app.api.routes.auth import get_current_user_dependency

router = APIRouter(prefix="/query", tags=["queries"])


@router.post("", response_model=QueryResponse)
async def submit_query(
    request: QueryRequest,
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
) -> QueryResponse:
    """Submit a question about a repository."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    # Verify repo exists and belongs to user
    result = await session.execute(
        select(Repository).where(
            (Repository.id == request.repository_id) & (Repository.user_id == current_user.id)
        )
    )
    repo = result.scalar_one_or_none()

    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # TODO: Implement actual Q&A pipeline
    raise HTTPException(
        status_code=501,
        detail="Q&A pipeline not yet implemented. Coming in Phase 3.",
    )


@router.get("/{question_id}", response_model=QueryResponse)
async def get_question(
    question_id: str,
    session: AsyncSession = Depends(get_session),
    authorization: str = Header(None),
) -> QueryResponse:
    """Retrieve previous question and answer."""
    current_user: User = await get_current_user_dependency(
        token=authorization.replace("Bearer ", "") if authorization else None,
        session=session,
    )

    result = await session.execute(
        select(Question).where(
            (Question.id == question_id) & (Question.user_id == current_user.id)
        )
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # TODO: Build sources from related chunks
    return QueryResponse(
        question_id=question.id,
        question=question.question,
        answer=question.answer or "",
        sources=[],
        created_at=question.created_at,
    )
