"""Embedding service using Google text-embedding-004.

Converts code chunks into 768-dimensional vectors for semantic search.
Handles batching, rate limiting, and retry with exponential backoff.

Uses google-genai (the current SDK, replacing the deprecated google-generativeai).
"""
import logging
import random
import time
from typing import List, Optional, Tuple

from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.services.ingestion.chunk import Chunk

log = logging.getLogger(__name__)

EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIMS  = 768
BATCH_SIZE      = 100   # Google API max per call

# Retry / backoff
MAX_RETRIES  = 5
BASE_DELAY   = 1.0   # seconds
DELAY_FACTOR = 2.0
MAX_DELAY    = 60.0
JITTER       = 1.0   # ± random seconds added to each delay


# ─── Public API ──────────────────────────────────────────────────────────────

def embed_chunks(chunks: List[Chunk]) -> List[Tuple[Chunk, List[float]]]:
    """Generate RETRIEVAL_DOCUMENT embeddings for a list of code chunks.

    Batches into groups of BATCH_SIZE, retries on rate limits, and skips
    any batch that fails after MAX_RETRIES attempts.

    Returns:
        List of (chunk, embedding_vector) tuples for successful chunks only.
    """
    client = _make_client()
    results: List[Tuple[Chunk, List[float]]] = []
    batches = _make_batches(chunks, BATCH_SIZE)

    for idx, batch in enumerate(batches):
        log.debug(
            "Embedding batch %d/%d (%d chunks)",
            idx + 1, len(batches), len(batch),
        )
        texts = [_prepare_text(c) for c in batch]
        embeddings = _embed_with_retry(
            client, texts, task_type="RETRIEVAL_DOCUMENT"
        )

        if embeddings is None:
            log.warning(
                "Batch %d failed after %d retries — skipping %d chunks",
                idx + 1, MAX_RETRIES, len(batch),
            )
            continue

        results.extend(zip(batch, embeddings))

    log.info(
        "Embedded %d/%d chunks successfully",
        len(results), len(chunks),
    )
    return results


def embed_query(query: str) -> List[float]:
    """Generate a RETRIEVAL_QUERY embedding for a search query.

    Returns:
        768-dimensional embedding vector.

    Raises:
        RuntimeError: if embedding fails after MAX_RETRIES attempts.
    """
    client = _make_client()
    result = _embed_with_retry(client, [query], task_type="RETRIEVAL_QUERY")

    if result is None:
        raise RuntimeError(
            f"Failed to embed query after {MAX_RETRIES} retries."
        )

    return result[0]


# ─── Internals ───────────────────────────────────────────────────────────────

def _make_client() -> genai.Client:
    """Create a configured Google GenAI client."""
    return genai.Client(api_key=settings.GOOGLE_API_KEY)


def _prepare_text(chunk: Chunk) -> str:
    """Build the text fed to the embedding model.

    Prepends a short metadata line so the model has context about
    what kind of code it is embedding.
    """
    parts = [chunk.language, chunk.chunk_type]
    if chunk.function_name:
        parts.append(chunk.function_name)
    elif chunk.class_name:
        parts.append(chunk.class_name)
    parts.append(chunk.file_path)

    header = " | ".join(parts)
    # Truncate chunk_text to avoid exceeding token limits (approx 8k tokens)
    body = chunk.chunk_text[:8000]
    return f"[{header}]\n{body}"


def _embed_with_retry(
    client: genai.Client,
    texts: List[str],
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> Optional[List[List[float]]]:
    """Call embed_content with exponential backoff on rate-limit errors.

    Returns the list of embedding vectors, or None if all retries fail.
    """
    delay = BASE_DELAY

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config=genai_types.EmbedContentConfig(task_type=task_type),
            )
            return [list(e.values) for e in response.embeddings]

        except Exception as exc:
            exc_name = type(exc).__name__
            is_rate_limit = (
                "ResourceExhausted" in exc_name
                or "429" in str(exc)
                or "quota" in str(exc).lower()
            )

            if attempt == MAX_RETRIES:
                log.error(
                    "Embedding failed on attempt %d/%d (%s): %s",
                    attempt, MAX_RETRIES, exc_name, exc,
                )
                return None

            if is_rate_limit:
                log.warning(
                    "Rate limit hit (attempt %d/%d) — waiting %.1fs",
                    attempt, MAX_RETRIES, delay,
                )
            else:
                log.warning(
                    "Embedding error on attempt %d/%d (%s): %s — retrying in %.1fs",
                    attempt, MAX_RETRIES, exc_name, exc, delay,
                )

            jitter = random.uniform(-JITTER, JITTER)
            time.sleep(max(0.0, delay + jitter))
            delay = min(delay * DELAY_FACTOR, MAX_DELAY)

    return None  # unreachable, satisfies type checker


def _make_batches(items: list, size: int) -> List[list]:
    """Split a list into consecutive chunks of at most `size` items."""
    return [items[i: i + size] for i in range(0, len(items), size)]
