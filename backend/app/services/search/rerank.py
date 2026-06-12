"""LLM-based reranker applied after Reciprocal Rank Fusion.

Takes the RRF-fused top-K results and re-scores them by direct relevance to
the query. Provider priority: Groq (if GROQ_API_KEY set) → Gemini.
Falls back to RRF order on any failure or timeout.
"""
import asyncio
import json
import logging
from typing import List, Optional, TYPE_CHECKING

from google import genai
from google.genai import types as genai_types
from groq import AsyncGroq

from app.core.config import settings

if TYPE_CHECKING:
    from app.services.search.retriever import SearchResult

log = logging.getLogger(__name__)

GEMINI_MODEL   = "gemini-2.0-flash"
GROQ_MODEL     = "llama-3.3-70b-versatile"
RERANK_TIMEOUT = 8.0

_RERANK_PROMPT = """\
You are evaluating code chunks for relevance to a developer's question.

Score each chunk 0-10:
  10 = directly implements or defines what the question asks about
   5 = partially relevant (related concepts, nearby code)
   0 = not relevant

Question: {query}

Chunks:
{chunks}

Return ONLY a JSON array of integers in the same order as the chunks, e.g. [8, 3, 7, ...]
"""


async def rerank(
    query: str,
    results: List["SearchResult"],
) -> List["SearchResult"]:
    if len(results) < 3:
        return results

    chunks_text = _format_chunks(results)
    prompt      = _RERANK_PROMPT.format(query=query, chunks=chunks_text)

    try:
        scores = await asyncio.wait_for(
            _call_llm_rerank(prompt, len(results)),
            timeout=RERANK_TIMEOUT,
        )
    except asyncio.TimeoutError:
        log.warning("Reranker timed out after %.1fs — using RRF order", RERANK_TIMEOUT)
        return results
    except Exception as exc:
        log.warning("Reranker failed: %s — using RRF order", exc)
        return results

    if not scores:
        return results

    paired = list(zip(results, scores + [0] * max(0, len(results) - len(scores))))
    paired.sort(key=lambda x: x[1], reverse=True)
    reranked = [r for r, _ in paired]
    log.debug("Reranker re-ordered %d results for query %r", len(reranked), query[:60])
    return reranked


async def _call_llm_rerank(prompt: str, expected_count: int) -> Optional[List[int]]:
    """Try Groq first, fall back to Gemini."""
    if settings.GROQ_API_KEY:
        result = await _call_groq_rerank(prompt, expected_count)
        if result is not None:
            return result
        log.warning("Groq reranker failed — falling back to Gemini")

    return await _call_gemini_rerank(prompt, expected_count)


async def _call_groq_rerank(prompt: str, expected_count: int) -> Optional[List[int]]:
    try:
        client   = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        text = (response.choices[0].message.content or "").strip()
        # Groq json_object mode wraps arrays as {"scores": [...]} sometimes
        parsed = json.loads(text)
        if isinstance(parsed, list):
            scores = parsed
        elif isinstance(parsed, dict):
            # take the first list value found
            scores = next((v for v in parsed.values() if isinstance(v, list)), None)
            if scores is None:
                return None
        else:
            return None
        return [max(0, min(10, int(s))) for s in scores[:expected_count]]
    except Exception as exc:
        log.warning("Groq rerank call failed: %s", exc)
        return None


async def _call_gemini_rerank(prompt: str, expected_count: int) -> Optional[List[int]]:
    try:
        client   = genai.Client(api_key=settings.GOOGLE_API_KEY)
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )
        text = (response.text or "").strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text  = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            return None
        return [max(0, min(10, int(s))) for s in parsed[:expected_count]]
    except Exception as exc:
        log.warning("Gemini rerank call failed: %s", exc)
        return None


def _format_chunks(results: List["SearchResult"]) -> str:
    parts = []
    for i, r in enumerate(results, 1):
        name    = r.function_name or r.class_name or "module"
        loc     = f"L{r.line_start}-{r.line_end}" if r.line_start else ""
        header  = f"[{i}] {r.file_path} — {name} {loc}"
        preview = (r.chunk_preview or "")[:500]
        parts.append(f"{header}\n```{r.language}\n{preview}\n```")
    return "\n\n".join(parts)
