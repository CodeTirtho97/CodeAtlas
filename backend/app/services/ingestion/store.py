"""Storage layer — writes chunks to Qdrant (vectors) and PostgreSQL (metadata).

Called once per ingestion after embeddings are generated.
"""
import logging
import uuid
from typing import Dict, List, Tuple

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, PointStruct
from app.services.search.sparse import to_sparse_vector
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ingestion.chunk import Chunk
from app.services.ingestion.file_filter import FileInfo
from app.models.db.file import File
from app.models.db.chunk import Chunk as ChunkModel

log = logging.getLogger(__name__)

COLLECTION = "code_chunks"
QDRANT_BATCH = 100


# ─── Qdrant ──────────────────────────────────────────────────────────────────

async def store_in_qdrant(
    client: AsyncQdrantClient,
    chunks_with_embeddings: List[Tuple[Chunk, List[float]]],
    repository_id: str,
) -> Dict[str, str]:
    """Upsert chunk vectors into Qdrant.

    Returns a mapping of chunk identity key → qdrant_point_id,
    used to link PostgreSQL Chunk records back to Qdrant points.
    """
    point_id_map: Dict[str, str] = {}
    points: List[PointStruct] = []

    for chunk, embedding in chunks_with_embeddings:
        point_id = str(uuid.uuid4())
        key = _chunk_key(chunk)
        point_id_map[key] = point_id

        sparse_vec = to_sparse_vector(chunk.chunk_text)

        points.append(PointStruct(
            id=point_id,
            vector={
                "": embedding,           # default (unnamed) dense vector
                "text": sparse_vec,      # named sparse vector for BM25-like search
            },
            payload={
                "repository_id": str(repository_id),
                "chunk_type": chunk.chunk_type,
                "language": chunk.language,
                "language_tier": chunk.language_tier,
                "file_path": chunk.file_path,
                "function_name": chunk.function_name,
                "class_name": chunk.class_name,
                "line_start": chunk.line_start,
                "line_end": chunk.line_end,
                "architectural_role": chunk.architectural_role,
                # Store a short preview for citation display
                "chunk_preview": chunk.chunk_text[:1500],
            },
        ))

    # Batch upsert
    for i in range(0, len(points), QDRANT_BATCH):
        batch = points[i: i + QDRANT_BATCH]
        await client.upsert(collection_name=COLLECTION, points=batch, wait=True)

    log.info("Stored %d vectors in Qdrant for repository %s", len(points), repository_id)
    return point_id_map


async def delete_from_qdrant(client: AsyncQdrantClient, repository_id: str) -> None:
    """Remove all Qdrant vectors for a repository (called on repo deletion)."""
    await client.delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="repository_id",
                    match=MatchValue(value=str(repository_id)),
                )
            ]
        ),
        wait=True,
    )
    log.info("Deleted Qdrant vectors for repository %s", repository_id)


# ─── PostgreSQL ──────────────────────────────────────────────────────────────

async def store_in_postgres(
    session: AsyncSession,
    chunks: List[Chunk],
    files: List[FileInfo],
    repository_id: str,
    point_id_map: Dict[str, str],
) -> None:
    """Persist File and Chunk records to PostgreSQL.

    Uses the point_id_map from store_in_qdrant to link each Chunk
    record to its Qdrant point ID.
    """
    # Build a map from relative_path → File DB record
    file_record_map: Dict[str, File] = {}
    file_objects = []

    for fi in files:
        file_obj = File(
            id=uuid.uuid4(),
            repository_id=repository_id,
            path=fi.relative_path,
            language=fi.language,
            language_tier=fi.language_tier,
        )
        file_objects.append(file_obj)
        file_record_map[fi.relative_path] = file_obj

    session.add_all(file_objects)
    await session.flush()  # assign IDs before inserting chunks

    # Insert Chunk records
    chunk_objects = []
    for chunk in chunks:
        file_record = file_record_map.get(chunk.file_path)
        if not file_record:
            continue  # file was filtered out — skip

        qdrant_point_id = point_id_map.get(_chunk_key(chunk))

        chunk_objects.append(ChunkModel(
            id=uuid.uuid4(),
            repository_id=repository_id,
            file_id=file_record.id,
            chunk_text=None,  # evicted — full text is in Qdrant payload (chunk_preview)
            chunk_type=chunk.chunk_type,
            language=chunk.language,
            language_tier=chunk.language_tier,
            architectural_role=chunk.architectural_role,
            function_name=chunk.function_name,
            class_name=chunk.class_name,
            line_start=chunk.line_start,
            line_end=chunk.line_end,
            qdrant_point_id=qdrant_point_id,
        ))

    session.add_all(chunk_objects)
    await session.commit()

    log.info(
        "Stored %d files and %d chunks in PostgreSQL for repository %s",
        len(file_objects), len(chunk_objects), repository_id,
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _chunk_key(chunk: Chunk) -> str:
    """Stable identity key for matching a Chunk to its Qdrant point ID."""
    return f"{chunk.file_path}:{chunk.line_start}:{chunk.line_end}:{chunk.chunk_type}"
