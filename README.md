# CodeAtlas

**AI-Powered Repository Intelligence Platform**

Turn any GitHub repository into a searchable knowledge graph using RAG, semantic search, and architecture-aware reasoning.

---

## Phase 1: Foundation (Complete ✅)

### What's Been Set Up

#### Backend (FastAPI)
- ✅ FastAPI application with async support
- ✅ SQLAlchemy ORM models (User, Repository, File, Chunk, Question, IngestionJob)
- ✅ Pydantic schemas for API contracts
- ✅ GitHub OAuth authentication flow
- ✅ Qdrant vector database initialization
- ✅ CORS and security headers middleware
- ✅ API routes (stubbed for future phases):
  - `/auth/login` — GitHub OAuth initiation
  - `/auth/callback` — GitHub OAuth token exchange
  - `/repos` — repository management
  - `/query` — Q&A endpoint
  - `/health` — health check

#### Frontend (React + TypeScript)
- ✅ React with Vite for fast dev server
- ✅ TypeScript for type safety
- ✅ React Router for page navigation
- ✅ Context API for authentication state
- ✅ Axios HTTP client with JWT injection
- ✅ Tailwind CSS for styling
- ✅ Pages:
  - Landing page with GitHub OAuth login
  - OAuth callback handler
  - Dashboard placeholder
  - Health check integration

#### Infrastructure
- ✅ Docker Compose with 4 services:
  - PostgreSQL 16 (port 5432)
  - Qdrant vector DB (port 6333)
  - FastAPI backend (port 8000, hot reload)
  - React frontend (port 3000, hot reload)
- ✅ Environment variable templates
- ✅ Health checks for all services

---

## Quick Start (Development)

### Prerequisites
- Docker & Docker Compose
- Git

### Steps

1. **Clone the repository** (already done)
   ```bash
   cd d:\ML_PROJECTS\CodeAtlas
   ```

2. **Configure GitHub OAuth** (required for authentication)
   - Go to https://github.com/settings/developers → OAuth Apps → New OAuth App
   - Set:
     - **Application name:** CodeAtlas
     - **Homepage URL:** http://localhost:3000
     - **Authorization callback URL:** http://localhost:3000/callback
   - Get `Client ID` and `Client Secret`

3. **Update environment variables**
   ```bash
   # backend/.env
   GITHUB_CLIENT_ID=<your_client_id>
   GITHUB_CLIENT_SECRET=<your_client_secret>
   
   # frontend/.env
   VITE_GITHUB_CLIENT_ID=<your_client_id>
   ```

4. **Start services**
   ```bash
   docker-compose up
   ```

5. **Verify services are healthy**
   - PostgreSQL: `localhost:5432`
   - Qdrant: `http://localhost:6333/health`
   - Backend: `http://localhost:8000/health`
   - Frontend: `http://localhost:3000`

6. **Test OAuth flow**
   - Open http://localhost:3000
   - Click "Sign in with GitHub"
   - You'll be redirected to GitHub, then back to the app

---

## Project Structure

```
codeatlas/
├── backend/
│   ├── app/
│   │   ├── main.py                        # FastAPI entry point
│   │   ├── api/routes/
│   │   │   ├── auth.py                    # GitHub OAuth
│   │   │   ├── repos.py                   # Repository endpoints
│   │   │   └── query.py                   # Q&A endpoints
│   │   ├── core/
│   │   │   ├── config.py                  # Settings
│   │   │   ├── database.py                # SQLAlchemy setup
│   │   │   └── qdrant.py                  # Qdrant client
│   │   └── models/
│   │       ├── db/                        # ORM models
│   │       └── schemas/                   # Pydantic schemas
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── main.tsx                       # Vite entry point
│   │   ├── App.tsx                        # Router setup
│   │   ├── api/client.ts                  # Axios instance
│   │   ├── context/AuthContext.tsx        # Auth state
│   │   └── pages/
│   │       ├── LandingPage.tsx
│   │       ├── CallbackPage.tsx
│   │       └── DashboardPage.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env
├── docker-compose.yml
├── Project_Spec.md                        # Complete specification
└── README.md
```

---

## Next Steps (Phase 2)

The ingestion pipeline will be implemented in Phase 2:

- Repository cloning (GitPython)
- Code parsing (Tree-sitter)
- Chunk creation (semantic units)
- Embedding generation (Google text-embedding-004)
- Vector storage (Qdrant)
- Database persistence

See `Project_Spec.md` for detailed requirements.

---

## Development Commands

### Backend

```bash
# Run linter
cd backend
pylint app

# Run type checker
mypy app

# Run tests (when available)
pytest

# Format code
black app
```

### Frontend

```bash
# Run linter
cd frontend
npm run lint

# Build for production
npm run build

# Run tests (when available)
npm run test
```

---

## Database Migrations (Alembic)

Migrations will be added in Phase 2 when the ingestion pipeline is implemented.

For now, SQLAlchemy creates tables automatically on startup via `init_db()`.

---

## API Documentation

Once running, access interactive API docs at:
- **Swagger UI:** http://localhost:8000/api/docs
- **ReDoc:** http://localhost:8000/api/redoc

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild images
docker-compose build --no-cache
```

### Port already in use
```bash
# Find and kill process on port
netstat -ano | findstr :<port>
taskkill /PID <PID> /F
```

### Database connection error
```bash
# Wait for PostgreSQL to be ready
docker-compose logs postgres
```

---

## Architecture Diagram

```
Frontend (React + TypeScript + Tailwind)
    ↓ (Axios HTTP client)
Backend (FastAPI + SQLAlchemy)
    ↓
PostgreSQL (databases) + Qdrant (vectors)
    ↓
Google APIs (Gemini, Embeddings)
    ↓
GitHub OAuth
```

---

## Contributing

See `backend/README.md` and `frontend/README.md` for development guidelines.

---

## License

MIT

---

## Phase Milestones

- ✅ **Phase 1:** Foundation (3 days) — Completed
- ⏳ **Phase 2:** Ingestion Pipeline (5 days) — Next
- ⏳ **Phase 3:** Intelligence Layer (4 days) — Following
- ⏳ **Phase 4:** Frontend (5 days) — Following
- ⏳ **Phase 5:** Deployment (3 days) — Final

---

For detailed specifications, see `Project_Spec.md`.
