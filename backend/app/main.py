import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="tree_sitter")

from datetime import datetime, timedelta

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import update
from app.core.config import settings
from app.core.database import init_db, close_db, get_session, AsyncSessionLocal
from app.core.qdrant import init_qdrant
from app.models.db.ingestion_job import IngestionJob
from app.models.db.repository import Repository
from app.api.routes import auth, repos, query, chat, impact, eval

# Initialize FastAPI app
app = FastAPI(
    title="CodeAtlas API",
    description="AI-powered repository intelligence platform",
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Security headers middleware
_DOCS_PATHS = {"/api/docs", "/api/redoc", "/openapi.json"}

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    if request.url.path in _DOCS_PATHS:
        # Swagger/ReDoc load assets from cdn.jsdelivr.net — allow it
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https://cdn.jsdelivr.net;"
        )
    else:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'"

    return response


# Include routers
app.include_router(auth.router)
app.include_router(repos.router)
app.include_router(query.router)
app.include_router(chat.router)
app.include_router(impact.router)
app.include_router(eval.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "services": {
            "database": "ok",
            "qdrant": "ok",
            "gemini_api": "ok",
        },
    }


@app.on_event("startup")
async def startup_event():
    """Initialize database and Qdrant on startup."""
    try:
        await init_db()
        await init_qdrant()
        await _recover_stale_jobs()
    except Exception as e:
        print(f"Startup error: {e}")
        raise


async def _recover_stale_jobs() -> None:
    """Mark jobs stuck in 'running' for >30 min as failed (server was restarted mid-ingestion)."""
    stale_cutoff = datetime.utcnow() - timedelta(minutes=30)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            update(IngestionJob)
            .where(IngestionJob.status == "running")
            .where(IngestionJob.updated_at < stale_cutoff)
            .values(
                status="failed",
                progress_pct=0,
                progress_message="Ingestion failed",
                error="Job was interrupted by a server restart. Please re-index the repository.",
            )
            .returning(IngestionJob.repository_id)
        )
        stale_repo_ids = [row[0] for row in result.fetchall()]
        if stale_repo_ids:
            await session.execute(
                update(Repository)
                .where(Repository.id.in_(stale_repo_ids))
                .values(status="failed")
            )
            print(f"Recovered {len(stale_repo_ids)} stale ingestion job(s) on startup.")
        await session.commit()


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connections on shutdown."""
    await close_db()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to CodeAtlas API",
        "docs": "/api/docs",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
