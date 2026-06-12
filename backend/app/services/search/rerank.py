"""LLM-based reranker (Gemini) applied after Reciprocal Rank Fusion.

Takes the RRF-fused top-K results and re-scores them by direct relevance to
the query. A single batched Gemini call scores all chunks at once; if it
times out or fails the RRF order is preserved unchanged.

Why: RRF blends keyword and semantic signal well but is blind to *query intent*
— e.g. for "how does auth work?" it may surface adjacent helper functions ahead
of the entry-point. The reranker fixes that without rebuilding the index.
"""
import asyncio
import json
import logging
from typing import List, Optional, TYPE_CHECKING

from google import genai
from google.genai import types as genai_types

from app.core.config import settings

if TYPE_CHECKING:
    from app.services.search.retriever import SearchResult

log = logging.getLogger(__name__)

RERANK_MODEL = "gemini-2.5-flash"
RERANK_TIMEOUT = 5.0   # seconds — fall back to RRF order on timeout

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
    """Re-order search results by LLM relevance score.

    Returns the original list unchanged if reranking fails or times out.
    Requires at least 3 results — smaller lists aren't worth the latency.
    """
    if len(results) < 3:
        return results

    chunks_text = _format_chunks(results)
    prompt = _RERANK_PROMPT.format(query=query, chunks=chunks_text)

    try:
        scores = await asyncio.wait_for(
            _call_gemini(prompt, len(results)),
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

    # Pair each result with its score; fill missing scores with 0
    paired = list(zip(results, scores + [0] * max(0, len(results) - len(scores))))
    paired.sort(key=lambda x: x[1], reverse=True)
    reranked = [r for r, _ in paired]

    log.debug("Reranker re-ordered %d results for query %r", len(reranked), query[:60])
    return reranked


def _format_chunks(results: List["SearchResult"]) -> str:
    parts = []
    for i, r in enumerate(results, 1):
        name = r.function_name or r.class_name or "module"
        loc = f"L{r.line_start}-{r.line_end}" if r.line_start else ""
        header = f"[{i}] {r.file_path} — {name} {loc}"
        preview = (r.chunk_preview or "")[:500]
        parts.append(f"{header}\n```{r.language}\n{preview}\n```")
    return "\n\n".join(parts)


async def _call_gemini(prompt: str, expected_count: int) -> Optional[List[int]]:
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    response = await client.aio.models.generate_content(
        model=RERANK_MODEL,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )
    text = (response.text or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

    parsed = json.loads(text)
    if not isinstance(parsed, list):
        return None
    return [max(0, min(10, int(s))) for s in parsed[:expected_count]]
