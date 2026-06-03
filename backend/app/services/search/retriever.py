"""Hybrid search retriever using Qdrant.

Performs dense vector search + sparse BM25-like keyword search in parallel,
then merges results using Reciprocal Rank Fusion (RRF).

Architecture:
  1. Embed query → 768-dim dense vector   (RETRIEVAL_QUERY task type)
  2. Hash-tokenise query → sparse vector  (vocabulary-free BM25-like)
  3. Qdrant prefetch: dense top-20 + sparse top-20, independently
  4. Qdrant RRF fusion → final top-K
  5. Return structured SearchResult objects with full chunk metadata
"""
import logging
from dataclasses import dataclass
from typing import List, Optional

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Filter, FieldCondition, MatchValue,
    Prefetch, Fusion,
)

from app.core.qdrant import COLLECTION
from app.services.ingestion.embedder import embed_query
from app.services.search.sparse import to_sparse_vector

log = logging.getLogger(__name__)

# Candidates fetched per signal before RRF merge
PREFETCH_LIMIT = 20
# Final results returned to the caller
DEFAULT_TOP_K = 10


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

    Args:
        client:        Qdrant async client
        query:         Natural language question
        repository_id: UUID string of the repository to search within
        top_k:         Number of results to return after RRF fusion

    Returns:
        List of SearchResult ordered by RRF score (best first).
    """
    # 1. Embed query for dense retrieval
    dense_vector = embed_query(query)

    # 2. Hash-tokenise query for sparse retrieval
    sparse_vector = to_sparse_vector(query)

    # 3. Filter: restrict to this repository only
    repo_filter = Filter(
        must=[
            FieldCondition(
                key="repository_id",
                match=MatchValue(value=str(repository_id)),
            )
        ]
    )

    # 4. Hybrid search: parallel prefetch + RRF fusion
    results = await client.query_points(
        collection_name=COLLECTION,
        prefetch=[
            # Dense: semantic similarity
            Prefetch(
                query=dense_vector,
                using="",            # default named dense vector
                limit=PREFETCH_LIMIT,
                filter=repo_filter,
            ),
            # Sparse: keyword / BM25-like
            Prefetch(
                query=sparse_vector,
                using="text",        # named sparse vector
                limit=PREFETCH_LIMIT,
                filter=repo_filter,
            ),
        ],
        query=Fusion.RRF,            # Reciprocal Rank Fusion
        limit=top_k,
        with_payload=True,
        query_filter=repo_filter,
    )

    # 5. Map to SearchResult objects
    hits = []
    for point in results.points:
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
        "Hybrid search for %r in repo %s → %d results",
        query[:60], repository_id, len(hits),
    )
    return hits
