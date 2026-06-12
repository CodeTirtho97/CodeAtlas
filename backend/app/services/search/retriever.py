"""Hybrid search retriever using Qdrant.

Performs dense vector search + sparse BM25-like keyword search in parallel,
then merges results using Reciprocal Rank Fusion (RRF).

Architecture:
  1. Embed query → 3072-dim dense vector  (RETRIEVAL_QUERY, gemini-embedding-001)
  2. Hash-tokenise query → sparse vector  (vocabulary-free BM25-like, see sparse.py)
  3. Dense search top-PREFETCH_LIMIT + sparse search top-PREFETCH_LIMIT, in parallel
  4. Manual RRF fusion → final top-K
  5. Return structured SearchResult objects with full chunk metadata

SearchMode controls which signals are used — useful for ablation studies:
  HYBRID      — both dense + sparse (default, production path)
  DENSE_ONLY  — skip sparse; tests whether semantic embeddings alone suffice
  SPARSE_ONLY — skip dense; tests keyword-only retrieval
"""
import asyncio
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Filter, FieldCondition, MatchValue,
)

from app.core.qdrant import COLLECTION
from app.services.ingestion.embedder import embed_query
from app.services.search.sparse import to_sparse_vector

log = logging.getLogger(__name__)

PREFETCH_LIMIT = 20
DEFAULT_TOP_K = 10
RRF_K = 60


class SearchMode(str, Enum):
    HYBRID      = "hybrid"
    DENSE_ONLY  = "dense"
    SPARSE_ONLY = "sparse"


@dataclass
class SearchResult:
    """A single search result with full citation metadata."""
    point_id: str
    score: float
    file_path: str
    chunk_type: str
    language: str
    function_name: Optional[str]
    class_name: Optional[str]
    line_start: Optional[int]
    line_end: Optional[int]
    architectural_role: Optional[str]
    chunk_preview: str


async def search(
    client: AsyncQdrantClient,
    query: str,
    repository_id: str,
    top_k: int = DEFAULT_TOP_K,
    mode: SearchMode = SearchMode.HYBRID,
    rerank: bool = False,
) -> List[SearchResult]:
    """Run search for a query over one repository.

    Args:
        client:        Qdrant async client
        query:         Natural language question
        repository_id: UUID string of the repository to search within
        top_k:         Number of results to return after fusion
        mode:          SearchMode controlling which signals to use
        rerank:        If True, run a Gemini reranking pass after RRF.
                       Only applied for HYBRID mode; ignored for single-signal
                       modes. Falls back to RRF order on timeout or error.

    Returns:
        List of SearchResult ordered by score (best first).
    """
    repo_filter = Filter(
        must=[
            FieldCondition(
                key="repository_id",
                match=MatchValue(value=str(repository_id)),
            )
        ]
    )

    # embed_query is synchronous; run in thread to avoid blocking the event loop.
    dense_vector = await asyncio.to_thread(embed_query, query)
    sparse_vector = to_sparse_vector(query)

    dense_hits: list = []
    sparse_hits: list = []

    if mode in (SearchMode.HYBRID, SearchMode.DENSE_ONLY):
        dense_result = await client.query_points(
            collection_name=COLLECTION,
            query=dense_vector,
            using="",
            query_filter=repo_filter,
            limit=PREFETCH_LIMIT,
            with_payload=True,
        )
        dense_hits = dense_result.points

    if mode in (SearchMode.HYBRID, SearchMode.SPARSE_ONLY):
        sparse_result = await client.query_points(
            collection_name=COLLECTION,
            query=sparse_vector,
            using="text",
            query_filter=repo_filter,
            limit=PREFETCH_LIMIT,
            with_payload=True,
        )
        sparse_hits = sparse_result.points

    # For single-mode, skip RRF — just return the one hit list directly.
    if mode == SearchMode.DENSE_ONLY:
        raw = dense_hits[:top_k]
    elif mode == SearchMode.SPARSE_ONLY:
        raw = sparse_hits[:top_k]
    else:
        raw = _rrf_merge(dense_hits, sparse_hits, top_k)

    hits = [_point_to_result(p) for p in raw]

    # Optional LLM reranking — only meaningful after RRF blends two signals.
    if rerank and mode == SearchMode.HYBRID and hits:
        from app.services.search.rerank import rerank as _llm_rerank
        hits = await _llm_rerank(query, hits)

    log.debug(
        "Search mode=%s rerank=%s for %r in repo %s → %d results",
        mode.value, rerank, query[:60], repository_id, len(hits),
    )
    return hits


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _point_to_result(point) -> SearchResult:
    p = point.payload or {}
    return SearchResult(
        point_id=str(point.id),
        score=point.score,
        file_path=p.get("file_path", ""),
        chunk_type=p.get("chunk_type", ""),
        language=p.get("language", ""),
        function_name=p.get("function_name"),
        class_name=p.get("class_name"),
        line_start=p.get("line_start"),
        line_end=p.get("line_end"),
        architectural_role=p.get("architectural_role"),
        chunk_preview=p.get("chunk_preview", ""),
    )


def _rrf_merge(dense_hits: list, sparse_hits: list, top_k: int) -> list:
    """Reciprocal Rank Fusion of two ranked hit lists."""
    scores: Dict[str, float] = {}
    by_id: Dict[str, object] = {}

    for rank, point in enumerate(dense_hits, start=1):
        pid = str(point.id)
        scores[pid] = scores.get(pid, 0.0) + 1.0 / (RRF_K + rank)
        by_id[pid] = point

    for rank, point in enumerate(sparse_hits, start=1):
        pid = str(point.id)
        scores[pid] = scores.get(pid, 0.0) + 1.0 / (RRF_K + rank)
        by_id[pid] = point

    ranked = sorted(scores.keys(), key=lambda pid: scores[pid], reverse=True)
    return [by_id[pid] for pid in ranked[:top_k]]
