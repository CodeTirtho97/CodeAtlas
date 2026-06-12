import json as _json

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from uuid import UUID
from datetime import datetime, timezone

from app.core.database import get_session, AsyncSessionLocal
from app.core.qdrant import get_qdrant_client
from app.models.db import ChatSession, ChatMessage, Repository, User
from app.models.schemas import (
    ChatSessionResponse,
    ChatSessionCreate,
    ChatMessageResponse,
    ChatAskRequest,
    ChatAskResponse,
)
from app.api.routes.auth import get_current_user_dependency
from app.services.generation.qa import answer_with_history, stream_answer_with_history

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(
    req: ChatSessionCreate,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """Create a new chat session for a repository."""
    repo_result = await session.execute(
        select(Repository).where(
            (Repository.id == req.repository_id) & (Repository.user_id == current_user.id)
        )
    )
    repo = repo_result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repo.status != "completed":
        raise HTTPException(status_code=400, detail="Repository indexing not completed")

    chat_session = ChatSession(
        repository_id=req.repository_id,
        user_id=current_user.id,
        title="New Chat",
        message_count=0,
    )
    session.add(chat_session)
    await session.commit()
    await session.refresh(chat_session)

    return ChatSessionResponse.from_orm(chat_session)


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    repository_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """List all chat sessions for a repository."""
    result = await session.execute(
        select(ChatSession)
        .where(
            (ChatSession.repository_id == repository_id)
            & (ChatSession.user_id == current_user.id)
        )
        .order_by(ChatSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [ChatSessionResponse.from_orm(s) for s in sessions]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """Delete a chat session and all its messages."""
    result = await session.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    chat_session = result.scalar_one_or_none()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")

    await session.delete(chat_session)
    await session.commit()

    return {"message": "Session deleted"}


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    session_id: UUID,
    current_user: User = Depends(get_current_user_dependency),
    session: AsyncSession = Depends(get_session),
):
    """Get all messages in a chat session."""
    session_result = await session.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    chat_session = session_result.scalar_one_or_none()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages_result = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = messages_result.scalars().all()

    return [
        ChatMessageResponse(
            id=m.id,
            session_id=m.session_id,
            role=m.role,
            content=m.content,
            sources=m.sources_json if m.role == "assistant" else None,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/sessions/{session_id}/ask", response_model=ChatAskResponse)
async def ask_question(
    session_id: UUID,
    req: ChatAskRequest,
    current_user: User = Depends(get_current_user_dependency),
    db_session: AsyncSession = Depends(get_session),
):
    """Ask a question in a chat session (with rate limiting and history)."""
    question = req.question.strip()
    if len(question) < 10 or len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question must be 10-1000 characters")

    session_result = await db_session.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    chat_session = session_result.scalar_one_or_none()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")

    repo_result = await db_session.execute(
        select(Repository).where(Repository.id == chat_session.repository_id)
    )
    repo = repo_result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Rate limiting: messages per session
    session_msg_count = await db_session.scalar(
        select(func.count()).select_from(ChatMessage)
        .where(
            (ChatMessage.session_id == session_id)
            & (ChatMessage.role == "user")
        )
    )
    if session_msg_count >= 15:
        raise HTTPException(status_code=429, detail="Session limit reached (15/15)")

    # Rate limiting: questions per day (UTC midnight, naive datetime to match DB)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_msg_count = await db_session.scalar(
        select(func.count()).select_from(ChatMessage)
        .join(ChatSession)
        .where(
            (ChatMessage.role == "user")
            & (ChatSession.user_id == current_user.id)
            & (ChatMessage.created_at >= today_start)
        )
    )
    if daily_msg_count >= 30:
        raise HTTPException(status_code=429, detail="Daily limit reached (30/day)")

    # Get last 10 messages (5 turns) for context
    prev_messages_result = await db_session.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    prev_messages = list(reversed(prev_messages_result.scalars().all()))

    history = [{"role": m.role, "content": m.content} for m in prev_messages]

    qdrant_client = await get_qdrant_client()
    try:
        qa_result = await answer_with_history(
            qdrant_client,
            question,
            str(chat_session.repository_id),
            repo.name,
            history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QA service error: {str(e)}")

    user_message = ChatMessage(
        session_id=session_id,
        role="user",
        content=question,
        sources_json=None,
    )
    db_session.add(user_message)
    await db_session.flush()

    assistant_message = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=qa_result["answer"],
        sources_json=qa_result.get("sources", []),
    )
    db_session.add(assistant_message)

    chat_session.message_count += 1
    chat_session.updated_at = datetime.utcnow()

    # Auto-title from first question
    if session_msg_count == 0:
        chat_session.title = question[:57] + "…" if len(question) > 57 else question

    await db_session.commit()
    await db_session.refresh(user_message)
    await db_session.refresh(assistant_message)

    new_session_msg_count = await db_session.scalar(
        select(func.count()).select_from(ChatMessage)
        .where(
            (ChatMessage.session_id == session_id)
            & (ChatMessage.role == "user")
        )
    )
    new_daily_count = await db_session.scalar(
        select(func.count()).select_from(ChatMessage)
        .join(ChatSession)
        .where(
            (ChatMessage.role == "user")
            & (ChatSession.user_id == current_user.id)
            & (ChatMessage.created_at >= today_start)
        )
    )

    return ChatAskResponse(
        session_id=session_id,
        question_message=ChatMessageResponse.model_validate({
            "id": user_message.id,
            "session_id": user_message.session_id,
            "role": user_message.role,
            "content": user_message.content,
            "sources": None,
            "created_at": user_message.created_at,
        }),
        answer_message=ChatMessageResponse.model_validate({
            "id": assistant_message.id,
            "session_id": assistant_message.session_id,
            "role": assistant_message.role,
            "content": assistant_message.content,
            "sources": assistant_message.sources_json if isinstance(assistant_message.sources_json, list) else [],
            "created_at": assistant_message.created_at,
        }),
        questions_today=new_daily_count,
        questions_in_session=new_session_msg_count,
    )


@router.post("/sessions/{session_id}/stream")
async def ask_question_stream(
    session_id: UUID,
    req: ChatAskRequest,
    current_user: User = Depends(get_current_user_dependency),
    db_session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Stream a chat answer as Server-Sent Events with rate limiting and session persistence.

    SSE protocol:
      data: {"type": "sources", "sources": [...]}                    — retrieval results (instant)
      data: {"type": "token",   "content": "..."}                    — answer text chunks
      data: {"type": "done",    "user_message_id": "...",
             "message_id": "...", "questions_today": N,
             "questions_in_session": N}                              — terminal event
    """
    question = req.question.strip()
    if len(question) < 10 or len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question must be 10-1000 characters")

    session_result = await db_session.execute(
        select(ChatSession).where(
            (ChatSession.id == session_id) & (ChatSession.user_id == current_user.id)
        )
    )
    chat_session = session_result.scalar_one_or_none()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Session not found")

    repo_result = await db_session.execute(
        select(Repository).where(Repository.id == chat_session.repository_id)
    )
    repo = repo_result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Rate limiting — same thresholds as /ask
    session_msg_count = await db_session.scalar(
        select(func.count()).select_from(ChatMessage)
        .where((ChatMessage.session_id == session_id) & (ChatMessage.role == "user"))
    ) or 0
    if session_msg_count >= 15:
        raise HTTPException(status_code=429, detail="Session limit reached (15/15)")

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    daily_msg_count = await db_session.scalar(
        select(func.count()).select_from(ChatMessage)
        .join(ChatSession)
        .where(
            (ChatMessage.role == "user")
            & (ChatSession.user_id == current_user.id)
            & (ChatMessage.created_at >= today_start)
        )
    ) or 0
    if daily_msg_count >= 30:
        raise HTTPException(status_code=429, detail="Daily limit reached (30/day)")

    # Conversation history
    prev_result = await db_session.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
    )
    history = [{"role": m.role, "content": m.content} for m in reversed(prev_result.scalars().all())]

    # Save user message before stream starts so it persists even on client disconnect
    user_msg = ChatMessage(session_id=session_id, role="user", content=question, sources_json=None)
    db_session.add(user_msg)

    if session_msg_count == 0:
        chat_session.title = question[:57] + "…" if len(question) > 57 else question
    chat_session.message_count += 1
    chat_session.updated_at = datetime.utcnow()

    await db_session.commit()
    await db_session.refresh(user_msg)

    # Snapshot values for generator closure (db_session closes when response starts)
    user_message_id = str(user_msg.id)
    repo_id = str(chat_session.repository_id)
    repo_name = repo.name
    questions_today = daily_msg_count + 1
    questions_in_session = session_msg_count + 1
    qdrant_client = await get_qdrant_client()

    async def generate():
        accumulated_text: list = []
        accumulated_sources: list = []

        async for event_str in stream_answer_with_history(
            client=qdrant_client,
            question=question,
            repository_id=repo_id,
            repo_name=repo_name,
            history=history,
        ):
            # Strip the 'data: ' prefix to parse, re-yield everything except the bare 'done'
            raw = event_str
            if raw.startswith("data: "):
                raw = raw[6:]
            raw = raw.strip()

            try:
                payload = _json.loads(raw)
            except Exception:
                yield event_str
                continue

            evt_type = payload.get("type")
            if evt_type == "token":
                accumulated_text.append(payload.get("content", ""))
                yield event_str
            elif evt_type == "sources":
                accumulated_sources = payload.get("sources", [])
                yield event_str
            elif evt_type == "done":
                # Save assistant message, then emit the richer done event
                full_answer = "".join(accumulated_text)
                async with AsyncSessionLocal() as save_session:
                    assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=full_answer,
                        sources_json=accumulated_sources,
                    )
                    save_session.add(assistant_msg)
                    await save_session.commit()
                    await save_session.refresh(assistant_msg)

                done_event = {
                    "type": "done",
                    "user_message_id": user_message_id,
                    "message_id": str(assistant_msg.id),
                    "questions_today": questions_today,
                    "questions_in_session": questions_in_session,
                }
                yield f"data: {_json.dumps(done_event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
