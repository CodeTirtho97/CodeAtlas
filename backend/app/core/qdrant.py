from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, SparseVectorParams, SparseIndexParams
from app.core.config import settings


async def get_qdrant_client() -> AsyncQdrantClient:
    """Get Qdrant client instance."""
    return AsyncQdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)


async def init_qdrant():
    """Initialize Qdrant collection for code chunks."""
    client = await get_qdrant_client()

    collection_name = "code_chunks"

    try:
        # Check if collection exists
        await client.get_collection(collection_name)
    except Exception:
        # Collection doesn't exist, create it
        await client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            sparse_vectors_config={
                "text": SparseVectorParams(
                    index=SparseIndexParams(on_disk=True),
                )
            },
        )

        # Create payload indexes
        await client.create_payload_index(
            collection_name=collection_name,
            field_name="repository_id",
            field_schema="integer",
        )
        await client.create_payload_index(
            collection_name=collection_name,
            field_name="chunk_type",
            field_schema="keyword",
        )
        await client.create_payload_index(
            collection_name=collection_name,
            field_name="language",
            field_schema="keyword",
        )

    return client
