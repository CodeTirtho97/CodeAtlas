import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_session
from app.core.qdrant import get_qdrant_client
from app.models.db.question import Question
from app.models.db.repository import Repository
from app.models.db.user import User
from app.models.schemas import QueryRequest, QueryResponse, SourceCitation
from app.api.routes.auth import get_current_user_dependency
from app.services.generation.qa import answer_question, stream_answer_question
from app.services.search.explain import explain_hits
from app.services.search.retriever import search as retrieval_search

router = APIRouter(prefix="/query", tags=["queries"])


class CodeSearchRequest(BaseModel):
    repository_id: uuid.UUID
    query: str
    top_k: int = 10


class CodeSearchHit(BaseModel):
    file_path: str
    chunk_type: str
    language: str
    function_name: Optional[str]
    class_name: Optional[str]
    line_start: Optional[int]
    line_end: Optional[int]
    architectural_role: Optional[str]
    chunk_preview: str
    score: float
    reason: Optional[str] = None  # one-line "why this matched" (absent if LLM unavailable)


class CodeSearchResponse(BaseModel):
    query: str
    results: List[CodeSearchHit]


@router.post("/search", response_model=CodeSearchResponse)
async def search_code(
    request: CodeSearchRequest,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> CodeSearchResponse:
    """Retrieval-only semantic code search — hybrid search without LLM generation.

    Costs one embedding call; no generation quota is consumed, so it is safe
    to call freely from the Explore tab.
    """
    query = request.query.strip()
    if len(query) < 3:
        raise HTTPException(status_code=400, detail="Query too short (min 3 chars).")
    if len(query) > 300:
        raise HTTPException(status_code=400, detail="Query too long (max 300 chars).")

    repo = await _get_indexed_repo(session, str(request.repository_id), current_user.id)

    qdrant_client = await get_qdrant_client()
    results = await retrieval_search(
        client=qdrant_client,
        query=query,
        repository_id=str(repo.id),
        top_k=20,  # over-fetch, then re-rank and trim below
        rerank=False,  # keep it instant + free: pure RRF order, no LLM rerank
    )

    # Down-weight prose chunks (READMEs, HTML, docs) so actual implementations
    # outrank documentation that merely mentions the query terms.
    _PROSE_PENALTY = 0.6
    _PROSE_TYPES = {"raw", "doc"}

    def _adjusted(r) -> float:
        return r.score * (_PROSE_PENALTY if (r.chunk_type or "").lower() in _PROSE_TYPES else 1.0)

    ranked = sorted(results, key=_adjusted, reverse=True)
    top = ranked[: max(1, min(request.top_k, 20))]

    # One batched LLM call for per-hit justifications; fail-soft → reasons may be None
    reasons = await explain_hits(query, top)

    return CodeSearchResponse(
        query=query,
        results=[
            CodeSearchHit(
                file_path=r.file_path,
                chunk_type=r.chunk_type,
                language=r.language,
                function_name=r.function_name,
                class_name=r.class_name,
                line_start=r.line_start,
                line_end=r.line_end,
                architectural_role=r.architectural_role,
                chunk_preview=r.chunk_preview,
                score=_adjusted(r),  # adjusted so the UI's relevance cutoff matches this order
                reason=(reasons[i] or None) if reasons else None,
            )
            for i, r in enumerate(top)
        ],
    )


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


@router.post("/stream")
async def submit_query_stream(
    request: QueryRequest,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Stream a natural language answer as Server-Sent Events.

    Events (each is `data: <json>\\n\\n`):
      {"type": "sources", "sources": [...]}   — emitted first; retrieve metadata
      {"type": "token",   "content": "..."}   — streamed answer text chunks
      {"type": "done"}                        — terminal event

    The client should consume the event stream until it receives "done".
    """
    question = request.question.strip()
    if len(question) < 10:
        raise HTTPException(status_code=400, detail="Question too short (min 10 chars).")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question too long (max 1000 chars).")

    repo = await _get_indexed_repo(session, str(request.repository_id), current_user.id)
    qdrant_client = await get_qdrant_client()

    async def event_generator():
        async for event in stream_answer_question(
            client=qdrant_client,
            question=question,
            repository_id=str(repo.id),
            repo_name=repo.name,
        ):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable Nginx buffering
            "Connection": "keep-alive",
        },
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
