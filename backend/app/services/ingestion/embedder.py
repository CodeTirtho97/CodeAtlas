"""Embedding service using Google text-embedding-004 via direct REST API.

Bypasses the google-genai SDK's model resolution logic (which constructs
incorrect URLs for embed_content in v2.x) and calls the Gemini REST
endpoint directly via httpx.

API reference:
  POST https://generativelanguage.googleapis.com/v1beta/models/
       text-embedding-004:batchEmbedContents?key=API_KEY
"""
import logging
import random
import time
from typing import List, Optional, Tuple

import httpx

from app.core.config import settings
from app.services.ingestion.chunk import Chunk

log = logging.getLogger(__name__)

_EMBED_MODEL = "models/gemini-embedding-001"
_BASE_URL = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models/gemini-embedding-001:batchEmbedContents"
)
EMBEDDING_DIMS   = 3072  # gemini-embedding-001 output dimension
BATCH_SIZE       = 50    # reduced to stay under per-minute quota
INTER_BATCH_DELAY = 0.5  # seconds between successful batches

MAX_RETRIES       = 4
BASE_DELAY        = 2.0
DELAY_FACTOR      = 2.0
MAX_DELAY         = 30.0
JITTER            = 0.5
RATE_LIMIT_DELAY  = 15.0  # wait on 429 before retrying


# ─── Public API ──────────────────────────────────────────────────────────────

def embed_chunks(chunks: List[Chunk]) -> List[Tuple[Chunk, List[float]]]:
    """Generate RETRIEVAL_DOCUMENT embeddings for a list of code chunks.

    Raises RuntimeError if every batch fails (no embeddings produced at all),
    so callers get the actual failure reason rather than a silent empty list.
    """
    results: List[Tuple[Chunk, List[float]]] = []
    batches = [chunks[i: i + BATCH_SIZE] for i in range(0, len(chunks), BATCH_SIZE)]
    last_error: Optional[str] = None

    for idx, batch in enumerate(batches):
        log.debug("Embedding batch %d/%d (%d chunks)", idx + 1, len(batches), len(batch))
        texts = [_prepare_text(c) for c in batch]
        embeddings, error = _embed_with_retry(texts, task_type="RETRIEVAL_DOCUMENT")

        if embeddings is None:
            last_error = error
            log.warning(
                "Batch %d/%d failed after %d retries — skipping %d chunks. Reason: %s",
                idx + 1, len(batches), MAX_RETRIES, len(batch), error,
            )
            continue

        results.extend(zip(batch, embeddings))

        # Pace between batches to avoid hitting per-minute quota
        if idx < len(batches) - 1:
            time.sleep(INTER_BATCH_DELAY)

    if not results:
        hint = ""
        if last_error and "429" in last_error:
            hint = " Your Google AI API quota is exhausted. Check https://ai.dev/rate-limit and retry later or upgrade your plan."
        elif last_error and ("403" in last_error or "401" in last_error):
            hint = " Check that GOOGLE_API_KEY is valid and has the Generative Language API enabled."
        raise RuntimeError(
            f"Embedding API returned no results for any batch. "
            f"Last error: {last_error or 'unknown'}.{hint}"
        )

    log.info("Embedded %d/%d chunks successfully", len(results), len(chunks))
    return results


def embed_query(query: str) -> List[float]:
    """Generate a RETRIEVAL_QUERY embedding for a search query."""
    embeddings, error = _embed_with_retry([query], task_type="RETRIEVAL_QUERY")
    if embeddings is None:
        raise RuntimeError(f"Failed to embed query after {MAX_RETRIES} retries. {error or ''}")
    return embeddings[0]


# ─── Internals ───────────────────────────────────────────────────────────────

def _prepare_text(chunk: Chunk) -> str:
    parts = [chunk.language, chunk.chunk_type]
    if chunk.function_name:
        parts.append(chunk.function_name)
    elif chunk.class_name:
        parts.append(chunk.class_name)
    parts.append(chunk.file_path)
    header = " | ".join(parts)
    body = chunk.chunk_text[:8000]
    return f"[{header}]\n{body}"


def _embed_with_retry(
    texts: List[str],
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> Tuple[Optional[List[List[float]]], Optional[str]]:
    """Call batchEmbedContents REST endpoint with exponential backoff.

    Returns (embeddings, None) on success or (None, error_message) on failure.
    """
    delay = BASE_DELAY
    last_error: Optional[str] = None

    payload = {
        "requests": [
            {
                "model": _EMBED_MODEL,
                "content": {"parts": [{"text": t}]},
                "taskType": task_type,
            }
            for t in texts
        ]
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    _BASE_URL,
                    headers={
                        "x-goog-api-key": settings.GOOGLE_API_KEY,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

            if resp.status_code == 200:
                data = resp.json()
                embeddings = data.get("embeddings")
                if not embeddings:
                    last_error = "API returned 200 but 'embeddings' field is empty or missing"
                    log.error("Embedding API returned empty embeddings field: %s", data)
                    return None, last_error
                return [e["values"] for e in embeddings], None

            err_body = resp.text[:600]
            last_error = f"HTTP {resp.status_code}: {err_body}"
            is_rate_limit = resp.status_code == 429

            if attempt == MAX_RETRIES:
                log.error("Embedding failed after %d attempts — %s", MAX_RETRIES, last_error)
                return None, last_error

            if is_rate_limit:
                # Respect Retry-After header if present, otherwise use RATE_LIMIT_DELAY
                retry_after = resp.headers.get("Retry-After")
                wait = float(retry_after) if retry_after else RATE_LIMIT_DELAY
                log.warning(
                    "Rate limit / quota hit (attempt %d/%d) — waiting %.0fs before retry",
                    attempt, MAX_RETRIES, wait,
                )
                time.sleep(wait)
                continue  # skip normal jitter sleep below
            else:
                log.warning(
                    "Embedding error attempt %d/%d — %s — retrying in %.1fs",
                    attempt, MAX_RETRIES, last_error, delay,
                )

        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            if attempt == MAX_RETRIES:
                log.error("Embedding failed after %d attempts — %s", MAX_RETRIES, last_error)
                return None, last_error
            log.warning(
                "Embedding exception attempt %d/%d — %s — retrying in %.1fs",
                attempt, MAX_RETRIES, last_error, delay,
            )

        jitter = random.uniform(-JITTER, JITTER)
        time.sleep(max(0.0, delay + jitter))
        delay = min(delay * DELAY_FACTOR, MAX_DELAY)

    return None, last_error
