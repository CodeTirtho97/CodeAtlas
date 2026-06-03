from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance, VectorParams, SparseVectorParams, SparseIndexParams,
    TextIndexParams, TokenizerType,
)
from app.core.config import settings

COLLECTION = "code_chunks"


async def get_qdrant_client() -> AsyncQdrantClient:
    """Create a Qdrant async client from settings."""
    return AsyncQdrantClient(
        url=settings.QDRANT_URL,
        api_key=settings.QDRANT_API_KEY or None,
    )


async def init_qdrant() -> AsyncQdrantClient:
    """Ensure the code_chunks collection exists with correct schema."""
    client = await get_qdrant_client()

    try:
        await client.get_collection(COLLECTION)
        return client  # already exists
    except Exception:
        pass  # create it below

    await client.create_collection(
        collection_name=COLLECTION,
        # Named dense vector — "" is the default, "text" is sparse
        vectors_config={
            "": VectorParams(size=3072, distance=Distance.COSINE),
        },
        sparse_vectors_config={
            "text": SparseVectorParams(
                index=SparseIndexParams(on_disk=True),
            ),
        },
    )

    # Payload indexes for fast filtering
    await client.create_payload_index(
        collection_name=COLLECTION,
        field_name="repository_id",
        field_schema="keyword",       # UUID strings
    )
    await client.create_payload_index(
        collection_name=COLLECTION,
        field_name="chunk_type",
        field_schema="keyword",
    )
    await client.create_payload_index(
        collection_name=COLLECTION,
        field_name="language",
        field_schema="keyword",
    )

    return client
