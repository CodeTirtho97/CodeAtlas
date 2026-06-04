"""Hybrid search retriever using Qdrant.

Performs dense vector search + sparse BM25-like keyword search in parallel,
then merges results using Reciprocal Rank Fusion (RRF).

Architecture:
  1. Embed query → 3072-dim dense vector  (RETRIEVAL_QUERY task type, gemini-embedding-001)
  2. Hash-tokenise query → sparse vector  (vocabulary-free BM25-like, see sparse.py)
  3. Qdrant prefetch: dense top-20 + sparse top-20, independently
  4. Qdrant RRF fusion → final top-K
  5. Return structured SearchResult objects with full chunk metadata

Why hybrid?
  Dense search handles semantic intent ("how is login handled?").
  Sparse search handles exact identifiers (JWT_SECRET, AuthService, verify_token).
  RRF ensures a result that is strong in either signal ranks highly in the final list.
"""
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Filter, FieldCondition, MatchValue,
)

from app.core.qdrant import COLLECTION
from app.services.ingestion.embedder import embed_query
from app.services.search.sparse import to_sparse_vector

log = logging.getLogger(__name__)

# Candidates fetched per signal before RRF merge
PREFETCH_LIMIT = 20
# Final results returned to the caller
DEFAULT_TOP_K = 10
# RRF smoothing constant
RRF_K = 60


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
    chunk_preview: str       # first 300 chars of chunk text


async def search(
    client: AsyncQdrantClient,
    query: str,
    repository_id: str,
    top_k: int = DEFAULT_TOP_K,
) -> List[SearchResult]:
    """Run hybrid search for a query over one repository.

    Two candidate sets are retrieved independently then merged:
      - Dense prefetch  : semantic similarity via 3072-dim embeddings
      - Sparse prefetch : exact-token matching via feature-hashed TF vectors

    Qdrant's built-in RRF fusion combines both sets into the final ranking.

    Args:
        client:        Qdrant async client
        query:         Natural language question
        repository_id: UUID string of the repository to search within
        top_k:         Number of results to return after RRF fusion

    Returns:
        List of SearchResult ordered by RRF score (best first).
    """
    # 1. Build both query representations
    dense_vector = embed_query(query)
    sparse_vector = to_sparse_vector(query)

    # 2. Repository-scoped filter — enforces multi-tenant isolation
    repo_filter = Filter(
        must=[
            FieldCondition(
                key="repository_id",
                match=MatchValue(value=str(repository_id)),
            )
        ]
    )

    # 3. Two independent searches + manual RRF fusion.
    #    Using the stable client.search() API (works across all server versions)
    #    instead of query_points+Prefetch which requires qdrant-server >=1.10.
    dense_hits, sparse_hits = await _search_dense_sparse(
        client, dense_vector, sparse_vector, repo_filter
    )

    # 4. Merge with Reciprocal Rank Fusion then truncate to top_k
    results = _rrf_merge(dense_hits, sparse_hits, top_k)

    # 5. Convert Qdrant scored points to structured SearchResult objects
    hits = []
    for point in results:
        p = point.payload or {}
        hits.append(SearchResult(
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
        ))

    log.debug(
        "Hybrid search (dense+sparse RRF) for %r in repo %s → %d results",
        query[:60], repository_id, len(hits),
    )
    return hits


async def _search_dense_sparse(
    client: AsyncQdrantClient,
    dense_vector: List[float],
    sparse_vector,
    repo_filter: Filter,
) -> Tuple[list, list]:
    """Run dense and sparse searches in parallel via query_points, return both hit lists."""
    import asyncio

    dense_task = client.query_points(
        collection_name=COLLECTION,
        query=dense_vector,
        using="",
        query_filter=repo_filter,
        limit=PREFETCH_LIMIT,
        with_payload=True,
    )
    sparse_task = client.query_points(
        collection_name=COLLECTION,
        query=sparse_vector,
        using="text",
        query_filter=repo_filter,
        limit=PREFETCH_LIMIT,
        with_payload=True,
    )
    dense_result, sparse_result = await asyncio.gather(dense_task, sparse_task)
    return dense_result.points, sparse_result.points


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
