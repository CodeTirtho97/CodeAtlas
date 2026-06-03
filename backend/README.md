# Backend Development Guide

## Setup

### Prerequisites
- Python 3.11+
- pip or poetry
- PostgreSQL (via Docker)
- Qdrant (via Docker)

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Running Locally

### With Docker Compose
```bash
docker-compose up backend
```

### Without Docker (using external DB)
```bash
# Set environment variables
export DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/codeatlas
export QDRANT_URL=http://localhost:6333
export GOOGLE_API_KEY=...
export GITHUB_CLIENT_ID=...
export GITHUB_CLIENT_SECRET=...
export JWT_SECRET=dev_secret_key

# Run server
uvicorn app.main:app --reload
```

## Project Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI app entry point
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py            # Authentication (GitHub OAuth)
│   │       ├── repos.py           # Repository management
│   │       └── query.py           # Q&A queries
│   ├── core/
│   │   ├── config.py              # Pydantic settings
│   │   ├── database.py            # SQLAlchemy async engine
│   │   └── qdrant.py              # Qdrant async client
│   ├── models/
│   │   ├── db/                    # SQLAlchemy ORM models
│   │   │   ├── base.py            # Base model
│   │   │   ├── user.py
│   │   │   ├── repository.py
│   │   │   ├── file.py
│   │   │   ├── chunk.py
│   │   │   ├── question.py
│   │   │   └── ingestion_job.py
│   │   └── schemas/               # Pydantic request/response schemas
│   │       ├── auth.py
│   │       ├── repository.py
│   │       └── query.py
│   └── services/                  # Business logic (Phase 2+)
│       ├── ingestion/
│       ├── search/
│       ├── generation/
│       └── analysis/
├── alembic/                       # Database migrations (Phase 2+)
├── tests/                         # Test suite
├── requirements.txt
├── .env
├── .env.example
├── Dockerfile
└── README.md
```

## Code Style

### Python
- **Formatter:** Black
- **Linter:** Pylint
- **Type checker:** MyPy
- **Line length:** 100 characters

```bash
# Format code
black app

# Run linter
pylint app

# Type check
mypy app
```

### Naming Conventions
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions: `snake_case`
- Constants: `UPPER_SNAKE_CASE`

## Testing

### Unit Tests
```bash
pytest tests/unit -v
```

### Integration Tests
```bash
pytest tests/integration -v
```

### All Tests with Coverage
```bash
pytest --cov=app tests/
```

### Test Structure
```
tests/
├── unit/
│   ├── test_auth.py
│   ├── test_repos.py
│   └── test_models.py
└── integration/
    ├── test_auth_flow.py
    ├── test_ingestion_pipeline.py
    └── test_query_pipeline.py
```

## Database

### Models
All SQLAlchemy models are in `app/models/db/`. Base model provides:
- `id` (UUID primary key)
- `created_at` (datetime)
- `updated_at` (datetime)

### Migrations (Phase 2+)
Alembic migrations track schema changes:

```bash
# Auto-generate migration
alembic revision --autogenerate -m "Add new column"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Running Migrations
```bash
# Up
python -m alembic upgrade head

# Down
python -m alembic downgrade -1
```

## API Documentation

Auto-generated from FastAPI docstrings:
- **Swagger UI:** http://localhost:8000/api/docs
- **ReDoc:** http://localhost:8000/api/redoc

### Endpoint Template
```python
@router.post("/path", response_model=ResponseSchema, status_code=200)
async def endpoint_name(
    request: RequestSchema,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user_dependency),
) -> ResponseSchema:
    """One-line description.
    
    More detailed explanation if needed.
    """
    # Implementation
    pass
```

## Authentication

### JWT Token
- **Algorithm:** HS256
- **Expiry:** 7 days
- **Secret:** `JWT_SECRET` env var

### Token Payload
```python
{
    "user_id": "uuid",
    "github_username": "string",
    "iat": timestamp,
    "exp": timestamp
}
```

## External APIs

### Google AI (Gemini + Embeddings)
- **Key:** `GOOGLE_API_KEY` env var
- **Endpoint:** https://generativelanguage.googleapis.com/
- **Libraries:** `google-generativeai`

### GitHub OAuth
- **Endpoints:** 
  - Authorization: https://github.com/login/oauth/authorize
  - Token: https://github.com/login/oauth/access_token
  - User: https://api.github.com/user
- **Library:** `httpx` (async HTTP client)

## Adding a New API Endpoint

1. Create route file in `app/api/routes/`
2. Define Pydantic schemas in `app/models/schemas/`
3. Implement handler with proper error handling
4. Register router in `app/main.py`

Example:
```python
# app/api/routes/example.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session

router = APIRouter(prefix="/example", tags=["example"])

@router.get("")
async def list_examples(session: AsyncSession = Depends(get_session)):
    """List all examples."""
    return {"items": []}

# app/main.py
from app.api.routes import example
app.include_router(example.router)
```

## Adding a New Service

Services go in `app/services/` and encapsulate business logic:

```python
# app/services/ingestion/pipeline.py
class IngestionPipeline:
    async def run(self, job_id: str, github_url: str) -> None:
        # Orchestrate ingestion steps
        pass
```

## Environment Variables

Required vars (validated on startup):
- `DATABASE_URL`
- `QDRANT_URL`
- `GOOGLE_API_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `JWT_SECRET`
- `FRONTEND_URL`

Optional:
- `LOG_LEVEL` (default: INFO)
- `QDRANT_API_KEY` (for cloud Qdrant)

## Debugging

### Enable verbose logging
```python
# app/core/config.py
LOG_LEVEL = "DEBUG"
```

### FastAPI debug mode
```python
# app/main.py
app = FastAPI(debug=True)
```

### Inspect database queries
```python
# app/core/database.py
engine = create_async_engine(..., echo=True)  # SQL logging
```

## Performance Tips

- Use async/await (always)
- Batch API calls (embeddings, etc.)
- Index frequently-queried columns
- Use connection pooling
- Cache frequently-accessed data

## Phase 2 TODOs

- [ ] Implement `services/ingestion/` pipeline
- [ ] Add Alembic migrations
- [ ] Implement hybrid search in Qdrant
- [ ] Add comprehensive test suite
- [ ] Implement caching layer
- [ ] Add monitoring/logging

---

See `Project_Spec.md` for requirements and `../README.md` for project overview.
