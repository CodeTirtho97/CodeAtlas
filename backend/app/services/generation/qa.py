"""Question-Answering pipeline.

Flow:
  1. Embed query (RETRIEVAL_QUERY)
  2. Hybrid search → top-K chunks with metadata
  3. Build context string from retrieved chunks
  4. LLM prompt → answer (streaming or JSON)
  5. Return answer text + source citations

Provider: Gemini 2.0 Flash (primary). If Gemini returns 429 or any API error,
automatically falls back to Groq (llama-3.3-70b-versatile) when GROQ_API_KEY is set.
A `provider_switch` SSE event is emitted before Groq tokens begin so the UI can
show a toast notification.
"""
import asyncio
import json
import logging
import re
from typing import AsyncGenerator, List, Optional

from google import genai
from google.genai import types as genai_types
from groq import AsyncGroq
from qdrant_client import AsyncQdrantClient

from app.core.config import settings
from app.services.search.retriever import SearchResult, search

log = logging.getLogger(__name__)

GEMINI_MODEL  = "gemini-2.0-flash"
GROQ_MODEL    = "llama-3.3-70b-versatile"
DEFAULT_TOP_K = 10

# ─── Client singletons ────────────────────────────────────────────────────────

_gemini_client: Optional[genai.Client] = None
_groq_client:   Optional[AsyncGroq]    = None


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _gemini_client


def _get_groq_client() -> Optional[AsyncGroq]:
    global _groq_client
    if not settings.GROQ_API_KEY:
        return None
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client


# ─── Prompts ──────────────────────────────────────────────────────────────────

_QA_PROMPT = """\
You are an expert on the {repo_name} codebase.

Answer the developer's question using ONLY the code context provided below.
Be specific: reference the exact functions, classes, and files from the context.

After your explanation, list every source chunk you actually used.

Return a JSON object with exactly these fields:
{{
  "answer": "<full natural-language explanation, markdown allowed>",
  "sources": [
    {{
      "file_path": "<exact file path from context>",
      "function_name": "<function or null>",
      "class_name": "<class or null>",
      "line_start": <number or null>,
      "line_end": <number or null>
    }}
  ]
}}

Only include sources you actually referenced in the answer.
If the context does not contain enough information, say so in the answer field.

---
Question: {question}

---
Code Context:
{context}

Return ONLY the JSON object.
"""

_QA_PROMPT_WITH_HISTORY = """\
You are an expert on the {repo_name} codebase.

You are having a conversation with a developer. Below is the conversation history,
followed by the current question and code context.

Use the history to understand context and provide coherent follow-up answers.
Answer using ONLY the code context provided below.
Be specific: reference exact functions, classes, and files.

After your explanation, list every source chunk you actually used.

Return a JSON object with exactly these fields:
{{
  "answer": "<full natural-language explanation, markdown allowed>",
  "sources": [
    {{
      "file_path": "<exact file path from context>",
      "function_name": "<function or null>",
      "class_name": "<class or null>",
      "line_start": <number or null>,
      "line_end": <number or null>
    }}
  ]
}}

Only include sources you actually referenced in the answer.
If the context does not contain enough information, say so in the answer field.

---
CONVERSATION HISTORY:
{history}

---
CURRENT QUESTION: {question}

---
CODE CONTEXT:
{context}

Return ONLY the JSON object.
"""

_QA_STREAM_PROMPT = """\
You are an expert on the {repo_name} codebase.

Answer the developer's question using ONLY the code context provided below.
Be specific: reference the exact functions, classes, and files from the context.
Markdown is allowed.
When your answer draws directly from a specific chunk, place a compact inline citation [N] \
right after the relevant phrase (N = the chunk number from the context). \
Use citations sparingly — only when they pinpoint an exact function, class, or code block. \
Do not cite every sentence; cite only where it genuinely helps the reader locate the code.

---
Question: {question}

---
Code Context:
{context}
"""

_QA_STREAM_PROMPT_WITH_HISTORY = """\
You are an expert on the {repo_name} codebase.

You are having a conversation with a developer. Use the history to provide coherent follow-up answers.
Answer using ONLY the code context provided below.
Be specific: reference exact functions, classes, and files. Markdown is allowed.
When your answer draws directly from a specific chunk, place a compact inline citation [N] \
right after the relevant phrase (N = the chunk number from the context). \
Use citations sparingly — only when they pinpoint an exact function, class, or code block.

---
CONVERSATION HISTORY:
{history}

---
CURRENT QUESTION: {question}

---
CODE CONTEXT:
{context}
"""


# ─── Public API ───────────────────────────────────────────────────────────────

async def answer_question(
    client: AsyncQdrantClient,
    question: str,
    repository_id: str,
    repo_name: str,
    top_k: int = DEFAULT_TOP_K,
    groq_first: bool = False,
) -> dict:
    """Answer a question over the repo.

    groq_first: when True, generate with Groq before Gemini. Used by
    latency/quota-sensitive callers (the eval citation pass) to sidestep
    Gemini's rate-limit backoff.
    """
    results = await search(client, question, repository_id, top_k=top_k, rerank=True)
    if not results:
        return {
            "answer": (
                "I couldn't find relevant context for this question "
                "in the indexed repository. Try rephrasing or ask about "
                "a specific file or function."
            ),
            "sources": [],
        }

    context = _build_context(results)
    prompt  = _QA_PROMPT.format(repo_name=repo_name, question=question, context=context)

    raw = await _call_llm(prompt, groq_first=groq_first)
    if raw is None:
        return {"answer": "Unable to generate an answer at this time. Please try again.", "sources": []}

    return {"answer": raw.get("answer", ""), "sources": _enrich_sources(raw.get("sources", []), results)}


async def answer_with_history(
    client: AsyncQdrantClient,
    question: str,
    repository_id: str,
    repo_name: str,
    history: List[dict],
    top_k: int = DEFAULT_TOP_K,
) -> dict:
    results = await search(client, question, repository_id, top_k=top_k, rerank=True)
    if not results:
        return {
            "answer": (
                "I couldn't find relevant context for this question "
                "in the indexed repository. Try rephrasing or ask about "
                "a specific file or function."
            ),
            "sources": [],
        }

    context      = _build_context(results)
    history_text = "\n".join(
        f"{'Developer' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in history
    ) if history else ""

    prompt = _QA_PROMPT_WITH_HISTORY.format(
        repo_name=repo_name,
        history=history_text,
        question=question,
        context=context,
    )

    raw = await _call_llm(prompt)
    if raw is None:
        return {"answer": "Unable to generate an answer at this time. Please try again.", "sources": []}

    return {"answer": raw.get("answer", ""), "sources": _enrich_sources(raw.get("sources", []), results)}


async def stream_answer_question(
    client: AsyncQdrantClient,
    question: str,
    repository_id: str,
    repo_name: str,
    top_k: int = DEFAULT_TOP_K,
) -> AsyncGenerator[str, None]:
    results = await search(client, question, repository_id, top_k=top_k, rerank=True)
    if not results:
        _no_ctx = "I couldn't find relevant context for this question in the indexed repository. Try rephrasing or ask about a specific file or function."
        yield f'data: {json.dumps({"type": "token", "content": _no_ctx})}\n\n'
        yield 'data: {"type": "done"}\n\n'
        return

    yield f'data: {json.dumps({"type": "sources", "sources": _sources_payload(results)})}\n\n'

    prompt = _QA_STREAM_PROMPT.format(
        repo_name=repo_name, question=question, context=_build_context(results)
    )
    async for evt in _stream_tokens(prompt):
        yield evt

    yield 'data: {"type": "done"}\n\n'


async def stream_answer_with_history(
    client: AsyncQdrantClient,
    question: str,
    repository_id: str,
    repo_name: str,
    history: List[dict],
    top_k: int = DEFAULT_TOP_K,
) -> AsyncGenerator[str, None]:
    results = await search(client, question, repository_id, top_k=top_k, rerank=True)
    if not results:
        _no_ctx = "I couldn't find relevant context for this question in the indexed repository. Try rephrasing or ask about a specific file or function."
        yield f'data: {json.dumps({"type": "token", "content": _no_ctx})}\n\n'
        yield 'data: {"type": "done"}\n\n'
        return

    yield f'data: {json.dumps({"type": "sources", "sources": _sources_payload(results)})}\n\n'

    context = _build_context(results)
    if history:
        history_text = "\n".join(
            f"{'Developer' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in history
        )
        prompt = _QA_STREAM_PROMPT_WITH_HISTORY.format(
            repo_name=repo_name, history=history_text, question=question, context=context
        )
    else:
        prompt = _QA_STREAM_PROMPT.format(
            repo_name=repo_name, question=question, context=context
        )

    async for evt in _stream_tokens(prompt):
        yield evt

    yield 'data: {"type": "done"}\n\n'


# ─── LLM dispatch ─────────────────────────────────────────────────────────────

async def _call_llm(prompt: str, groq_first: bool = False) -> Optional[dict]:
    """Non-streaming JSON answer. Default: Gemini primary, Groq fallback.

    groq_first=True flips the order so latency/quota-sensitive callers avoid
    Gemini's rate-limit retry/backoff entirely when Groq is configured.
    """
    if groq_first:
        groq = _get_groq_client()
        if groq:
            result = await _call_groq(groq, prompt)
            if result is not None:
                return result
            log.info("Groq-first Q&A failed — falling back to Gemini")
        return await _call_gemini(prompt)

    result = await _call_gemini(prompt)
    if result is not None:
        return result

    groq = _get_groq_client()
    if groq:
        log.info("Falling back to Groq for non-streaming Q&A")
        return await _call_groq(groq, prompt)

    return None


async def _stream_tokens(prompt: str) -> AsyncGenerator[str, None]:
    """Streaming: Gemini primary. On any Gemini failure, emit provider_switch then
    continue from Groq. Emits generation_error if both providers fail."""
    gemini_client = _get_gemini_client()

    # ── Try Gemini ────────────────────────────────────────────────────────────
    try:
        stream = await gemini_client.aio.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.1),
        )
        async for chunk in stream:
            text = chunk.text
            if text:
                yield f'data: {json.dumps({"type": "token", "content": text})}\n\n'
        return  # Gemini succeeded — done
    except Exception as exc:
        exc_str = str(exc)
        if '429' in exc_str or 'RESOURCE_EXHAUSTED' in exc_str:
            delay = int(_parse_retry_delay(exc))
            log.warning("Gemini streaming rate-limited (retry in %ds) — switching to Groq", delay)
            switch_msg = f"Gemini quota reached — switched to Groq automatically"
        else:
            log.warning("Gemini streaming failed — switching to Groq: %s", exc)
            switch_msg = "Gemini unavailable — switched to Groq automatically"

        groq = _get_groq_client()
        if groq is None:
            # No Groq key configured — surface the original error
            if '429' in exc_str or 'RESOURCE_EXHAUSTED' in exc_str:
                delay = int(_parse_retry_delay(exc))
                msg = f"*Rate limit reached — please wait ~{delay}s and try again.*"
            else:
                msg = "*Unable to complete the answer. Please try again.*"
            yield f'data: {json.dumps({"type": "generation_error", "message": msg})}\n\n'
            return

        # Signal the provider switch so the UI can show a toast
        yield f'data: {json.dumps({"type": "provider_switch", "provider": "groq", "message": switch_msg})}\n\n'

    # ── Groq fallback ─────────────────────────────────────────────────────────
    groq = _get_groq_client()
    try:
        stream = await groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            stream=True,
        )
        async for chunk in stream:
            text = chunk.choices[0].delta.content or ""
            if text:
                yield f'data: {json.dumps({"type": "token", "content": text})}\n\n'
    except Exception as exc:
        log.warning("Groq streaming fallback also failed: %s", exc)
        yield f'data: {json.dumps({"type": "generation_error", "message": "*Unable to complete the answer. Please try again.*"})}\n\n'


# ─── Gemini ────────────────────────────────────────────────────────────────────

def _parse_retry_delay(exc: Exception) -> float:
    m = re.search(r'retry[^0-9]*(\d+(?:\.\d+)?)\s*s', str(exc), re.IGNORECASE)
    return float(m.group(1)) if m else 5.0


async def _call_gemini(prompt: str) -> Optional[dict]:
    client = _get_gemini_client()
    for attempt in range(1, 4):
        try:
            response = await client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            return _parse_json(response.text)
        except Exception as exc:
            exc_str = str(exc)
            if '429' in exc_str or 'RESOURCE_EXHAUSTED' in exc_str:
                delay = _parse_retry_delay(exc)
                log.warning("Gemini Q&A rate-limited (attempt %d/3) — retrying in %.1fs", attempt, delay)
                if attempt < 3:
                    await asyncio.sleep(delay)
            else:
                log.warning("Gemini Q&A attempt %d/3 failed: %s", attempt, exc)
    return None


# ─── Groq ─────────────────────────────────────────────────────────────────────

async def _call_groq(client: AsyncGroq, prompt: str) -> Optional[dict]:
    try:
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        return _parse_json(response.choices[0].message.content)
    except Exception as exc:
        log.warning("Groq Q&A call failed: %s", exc)
        return None


# ─── Context / Source helpers ─────────────────────────────────────────────────

def _build_context(results: List[SearchResult]) -> str:
    parts = []
    for i, r in enumerate(results, 1):
        name   = r.function_name or r.class_name or "module"
        loc    = f"L{r.line_start}-{r.line_end}" if r.line_start else ""
        header = f"[{i}] {r.file_path} — {name}  {loc}"
        parts.append(f"{header}\n```{r.language}\n{r.chunk_preview}\n```")
    return "\n\n".join(parts)


def _sources_payload(results: List[SearchResult]) -> list:
    return [
        {
            "file_path":     r.file_path,
            "function_name": r.function_name,
            "class_name":    r.class_name,
            "line_start":    r.line_start,
            "line_end":      r.line_end,
            "chunk_type":    r.chunk_type,
            "chunk_preview": r.chunk_preview,
        }
        for r in results
    ]


def _enrich_sources(raw_sources: list, search_results: List[SearchResult]) -> List[dict]:
    lookup: dict[str, SearchResult] = {}
    for r in search_results:
        key = f"{r.file_path}:{r.function_name or r.class_name or ''}"
        lookup[key] = r

    enriched, seen = [], set()
    for source in raw_sources:
        fp  = source.get("file_path", "")
        fn  = source.get("function_name") or source.get("class_name") or ""
        key = f"{fp}:{fn}"
        if key in seen:
            continue
        seen.add(key)
        matched = lookup.get(key)
        enriched.append({
            "file_path":     fp,
            "function_name": source.get("function_name"),
            "class_name":    source.get("class_name"),
            "line_start":    source.get("line_start") or (matched.line_start if matched else None),
            "line_end":      source.get("line_end")   or (matched.line_end   if matched else None),
            "chunk_type":    matched.chunk_type    if matched else None,
            "chunk_preview": matched.chunk_preview if matched else None,
        })
    return enriched


def _parse_json(text: str) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text  = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Could not parse LLM JSON: %.200s", text)
        return None
