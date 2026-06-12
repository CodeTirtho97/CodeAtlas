"""One-shot match justifications for Code Search results.

Single batched LLM call per search: takes the query plus all hit previews and
returns one short "why this file matched" line per hit. Groq only — Gemini
quota is reserved for Ask AI answers; if GROQ_API_KEY is not set, search
simply ships without justifications.

Fail-soft by design — on timeout, rate limit, or parse failure it returns
None and the search response simply ships without justifications.
"""
import asyncio
import json
import logging
from typing import List, Optional, TYPE_CHECKING

from groq import AsyncGroq

from app.core.config import settings

if TYPE_CHECKING:
    from app.services.search.retriever import SearchResult

log = logging.getLogger(__name__)

GROQ_MODEL      = "llama-3.3-70b-versatile"
EXPLAIN_TIMEOUT = 6.0
MAX_REASON_LEN  = 220

_EXPLAIN_PROMPT = """\
A developer searched a codebase for: "{query}"

Below are the code chunks the search returned. For EACH chunk, write one short
sentence (max 20 words) explaining why it is relevant to the search — name the
specific function, route, or behaviour that connects it to the query.
If a chunk seems only loosely related, say what it actually contains instead of
overselling the match.

Chunks:
{chunks}

Return ONLY a JSON array of strings, one per chunk, in the same order.
"""


async def explain_hits(query: str, results: List["SearchResult"]) -> Optional[List[str]]:
    """Return one short justification per result, or None on any failure."""
    if not results or not settings.GROQ_API_KEY:
        return None

    prompt = _EXPLAIN_PROMPT.format(query=query, chunks=_format_chunks(results))

    try:
        reasons = await asyncio.wait_for(_call_llm(prompt), timeout=EXPLAIN_TIMEOUT)
    except asyncio.TimeoutError:
        log.warning("Search explain timed out after %.1fs — shipping without reasons", EXPLAIN_TIMEOUT)
        return None
    except Exception as exc:
        log.warning("Search explain failed: %s — shipping without reasons", exc)
        return None

    if not reasons:
        return None

    # Pad / trim so callers can zip safely
    reasons = [str(r).strip()[:MAX_REASON_LEN] for r in reasons[: len(results)]]
    reasons += [""] * (len(results) - len(reasons))
    return reasons


async def _call_llm(prompt: str) -> Optional[List[str]]:
    try:
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        return _parse_reasons((response.choices[0].message.content or "").strip())
    except Exception as exc:
        log.warning("Groq explain call failed: %s", exc)
        return None


def _parse_reasons(text: str) -> Optional[List[str]]:
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, list):
        return [str(r) for r in parsed]
    if isinstance(parsed, dict):
        # json_object mode sometimes wraps arrays, e.g. {"reasons": [...]}
        inner = next((v for v in parsed.values() if isinstance(v, list)), None)
        return [str(r) for r in inner] if inner else None
    return None


def _format_chunks(results: List["SearchResult"]) -> str:
    parts = []
    for i, r in enumerate(results, 1):
        name    = r.function_name or r.class_name or "module"
        loc     = f"L{r.line_start}-{r.line_end}" if r.line_start else ""
        header  = f"[{i}] {r.file_path} — {name} {loc}"
        preview = (r.chunk_preview or "")[:400]
        parts.append(f"{header}\n```{r.language}\n{preview}\n```")
    return "\n\n".join(parts)
