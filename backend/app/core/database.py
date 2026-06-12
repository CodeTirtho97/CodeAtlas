from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

import ssl as _ssl

_ssl_ctx = _ssl.create_default_context()

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    poolclass=NullPool,
    connect_args={
        "ssl": _ssl_ctx,
        "server_settings": {"jit": "off"},
    },
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_session() -> AsyncSession:
    """Get database session for dependency injection."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Initialize database (create tables)."""
    from app.models.db.base import Base
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # chunk_text is evicted after embedding — allow NULL on existing DBs
        try:
            await conn.execute(text(
                "ALTER TABLE chunks ALTER COLUMN chunk_text DROP NOT NULL"
            ))
        except Exception:
            pass  # Already nullable, or table doesn't exist yet

        # indexed_commit_sha added for incremental re-indexing support
        try:
            await conn.execute(text(
                "ALTER TABLE repositories ADD COLUMN IF NOT EXISTS indexed_commit_sha VARCHAR"
            ))
        except Exception:
            pass


async def close_db():
    """Close database connections."""
    await engine.dispose()
