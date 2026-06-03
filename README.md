# CodeAtlas

> **Turn any GitHub repository into a searchable knowledge graph.**

<img width="1437" height="720" alt="image" src="https://github.com/user-attachments/assets/6465918e-711c-4ec2-b637-fe614959a62e" />

CodeAtlas is an open-source, AI-powered repository intelligence platform that helps developers understand unfamiliar codebases fast — using RAG, semantic code search, multi-turn chat, and architecture-aware reasoning.

Instead of reading docs manually or asking teammates, CodeAtlas constructs a structured knowledge base from any public GitHub repository and lets you ask questions like:

- *"How does authentication work?"*
- *"What breaks if I modify PaymentService?"*
- *"Where should a new developer start?"*

---

## Features

- **Semantic Code Search** — Hybrid vector + BM25 keyword search across your entire repository
- **Multi-Turn Chat** — Persistent chat sessions with full conversation history and cited answers
- **Natural Language Q&A** — Ask architecture, flow, and dependency questions in plain English
- **Auto-Generated Summary** — Purpose, tech stack, architecture, and entry points — generated on ingest
- **Developer Onboarding Guide** — Step-by-step guide with files to read first and core workflows
- **API Endpoint Discovery** — Automatically extract all routes from source code (no LLM)
- **File Dependency Graph** — See what each file imports and what imports it
- **Cited Answers** — Every answer links back to the exact file, function, and line range it came from
- **Multi-Language Support** — Full AST parsing for Python, JavaScript, TypeScript, Java, Go; fallback chunking for all others

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, Python 3.11, SQLAlchemy (async) |
| Auth | GitHub OAuth (Authlib) + JWT |
| Relational DB | PostgreSQL 16 |
| Vector DB | Qdrant (dense + BM25 hybrid search) |
| Embeddings | Google text-embedding-004 (3072-dim) |
| LLM | Gemini API (Google AI Studio) |
| Code Parsing | Tree-sitter (AST-level semantic chunking) |
| Dependency Analysis | NetworkX |
| Containerization | Docker + Docker Compose |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Architecture

```
Browser (React + TypeScript + Tailwind)
         │
         │  HTTPS (JWT in Authorization header)
         ▼
FastAPI Backend
         │
    ┌────┴─────────────────────────────┐
    │                                  │
    ▼                                  ▼
PostgreSQL                          Qdrant
(users, repos,                  (code embeddings,
 chunks, chat)                   hybrid search)
    │                                  │
    └────────────┬─────────────────────┘
                 │
         ┌───────┴────────┐
         ▼                ▼
   Gemini API      text-embedding-004
  (answer gen)     (vector indexing)
         │
         ▼
   Ingestion Pipeline
    GitPython → Tree-sitter → NetworkX
```

---

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker | 24+ | Required for all services |
| Docker Compose | v2+ | Bundled with Docker Desktop |
| Git | Any | To clone the repo |
| GitHub OAuth App | — | For authentication |
| Google AI Studio API key | — | For Gemini + Embeddings (free tier) |

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/codeatlas.git
cd codeatlas
```

### Step 2 — Create a GitHub OAuth App

1. Go to [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. Fill in:
   - **Application name:** `CodeAtlas`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/callback`
3. Click **Register application**
4. Copy the **Client ID** and generate a **Client Secret**

### Step 3 — Get a Google AI Studio API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API key**
3. Copy the key (used for both Gemini LLM and text-embedding-004 — same key)

### Step 4 — Configure Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
GOOGLE_API_KEY=your_google_api_key_here
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
JWT_SECRET=a_random_string_at_least_32_characters_long
FRONTEND_URL=http://localhost:3000
```

Generate a secure `JWT_SECRET`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

```bash
# Frontend
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_GITHUB_CLIENT_ID=your_github_client_id
```

### Step 5 — Start Everything

```bash
docker-compose up
```

This starts 4 services:

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | React app with hot reload |
| Backend | http://localhost:8000 | FastAPI with hot reload |
| PostgreSQL | localhost:5432 | Database |
| Qdrant | http://localhost:6333 | Vector database |

### Step 6 — Verify the Setup

```bash
# Backend health check
curl http://localhost:8000/health

# Qdrant health check
curl http://localhost:6333/health

# Open the app
open http://localhost:3000   # macOS
start http://localhost:3000  # Windows
```

---

## Usage

### 1. Sign In

Click **Sign in with GitHub** on the landing page. You'll be redirected to GitHub's OAuth consent screen and then back.

### 2. Analyze a Repository

Paste a public GitHub URL and click **Analyze**:

```
https://github.com/fastapi/fastapi
```

The ingestion pipeline runs in the background. A progress bar tracks each stage:

1. Cloning the repository
2. Filtering files (excludes vendor, build artifacts, etc.)
3. Parsing code (Tree-sitter AST)
4. Generating embeddings (text-embedding-004)
5. Storing vectors in Qdrant + metadata in PostgreSQL
6. Building the dependency graph (NetworkX)
7. Extracting API endpoints (Tree-sitter, no LLM)
8. Generating repository summary (Gemini)
9. Generating the onboarding guide (Gemini)

### 3. Explore the Dashboard

Once complete, the dashboard provides five tabs:

- **Overview** — Purpose, tech stack, architecture, and entry points
- **Ask AI** — Multi-turn chat with full session history and cited sources
- **Guide** — Step-by-step learning path and core workflows for new developers
- **API Map** — All discovered HTTP endpoints, filterable by method and path
- **Dependencies** — File-level import/export graph with hub detection

### 4. Ask Questions

Start a chat session and type any question about the repository:

```
How does authentication work?
What is the request flow for a POST /login?
Which files interact with UserService?
Where should a new developer start?
```

Answers include cited sources with exact file, function, and line range:

```
Sources:
  ► auth/service.py — authenticate_user()   [L42–67]
  ► middleware/jwt.py — verify_token()      [L17–31]
  ► db/models.py — User                    [L5–28]
```

Chat sessions are persistent — return to any session to continue the conversation. Each session supports up to **15 questions**; create multiple sessions per repository as needed.

---

## Project Structure

```
codeatlas/
├── backend/
│   ├── app/
│   │   ├── main.py                        # FastAPI entry point + middleware
│   │   ├── api/routes/
│   │   │   ├── auth.py                    # GitHub OAuth login/callback/me
│   │   │   ├── repos.py                   # Ingest, list, get, delete repos
│   │   │   ├── query.py                   # Single-turn Q&A (deprecated)
│   │   │   └── chat.py                    # Multi-turn chat sessions + Q&A
│   │   ├── core/
│   │   │   ├── config.py                  # Pydantic settings (validated env vars)
│   │   │   ├── database.py                # Async SQLAlchemy engine + session
│   │   │   └── qdrant.py                  # Qdrant client + collection init
│   │   ├── models/
│   │   │   ├── db/                        # SQLAlchemy ORM models
│   │   │   │   ├── base.py                # BaseModel (id, created_at, updated_at)
│   │   │   │   ├── user.py                # GitHub user + rate limiting
│   │   │   │   ├── repository.py          # Repo metadata + summary/guide JSON
│   │   │   │   ├── file.py                # Source file metadata
│   │   │   │   ├── chunk.py               # Code chunks (semantic units)
│   │   │   │   ├── question.py            # Single-turn Q&A history (deprecated)
│   │   │   │   ├── ingestion_job.py       # Ingestion job progress tracking
│   │   │   │   ├── chat_session.py        # Chat session
│   │   │   │   └── chat_message.py        # Chat messages
│   │   │   └── schemas/                   # Pydantic request/response schemas
│   │   │       ├── auth.py
│   │   │       ├── repository.py
│   │   │       ├── query.py
│   │   │       └── chat.py
│   │   └── services/
│   │       ├── ingestion/                 # Clone → parse → embed → store
│   │       │   ├── pipeline.py            # 12-step async orchestrator
│   │       │   ├── cloner.py              # GitPython repo clone
│   │       │   ├── file_filter.py         # Exclude vendor/build artifacts
│   │       │   ├── parser.py              # AST parsing dispatcher
│   │       │   ├── parsers/               # Per-language Tree-sitter parsers
│   │       │   │   ├── python_parser.py   # FastAPI/Flask routes
│   │       │   │   ├── js_parser.py       # Express routes
│   │       │   │   ├── ts_parser.py       # TypeScript + typed exports
│   │       │   │   ├── java_parser.py     # Spring @RestController
│   │       │   │   ├── go_parser.py       # chi/gin patterns
│   │       │   │   └── fallback_parser.py # Line-based chunking
│   │       │   ├── embedder.py            # Google text-embedding-004 calls
│   │       │   └── store.py               # Qdrant + PostgreSQL persistence
│   │       ├── search/
│   │       │   ├── retriever.py           # Hybrid search (dense + BM25 RRF)
│   │       │   └── sparse.py              # BM25-like tokenizer
│   │       ├── generation/
│   │       │   ├── qa.py                  # LLM Q&A with context + chat history
│   │       │   ├── summarizer.py          # Purpose, stack, architecture
│   │       │   └── onboarding.py          # Step-by-step learning guide
│   │       └── analysis/
│   │           ├── api_extractor.py       # HTTP endpoint discovery
│   │           └── dependency_graph.py    # Import graph via NetworkX
│   ├── tests/
│   │   ├── unit/                          # Unit tests
│   │   ├── integration/                   # Integration tests (require services)
│   │   └── benchmarks/                   # Retrieval performance benchmarks
│   ├── alembic/                           # DB migration scripts
│   ├── pyproject.toml                     # Dependencies + tool config
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                        # Router + ProtectedRoute wrapper
│   │   ├── api/
│   │   │   ├── client.ts                  # Axios instance with JWT injection
│   │   │   ├── repos.ts                   # Repository CRUD + ingestion
│   │   │   ├── query.ts                   # Single-turn Q&A (deprecated)
│   │   │   └── chat.ts                    # Chat sessions + multi-turn Q&A
│   │   ├── context/
│   │   │   └── AuthContext.tsx            # Auth state (Context API + useAuth hook)
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx            # Unauthenticated homepage + repo list
│   │   │   ├── CallbackPage.tsx           # GitHub OAuth redirect handler
│   │   │   ├── DashboardPage.tsx          # 5-tab repository dashboard
│   │   │   ├── IngestionPage.tsx          # Real-time ingestion progress
│   │   │   └── ArchitecturePage.tsx       # Architecture explanation
│   │   ├── components/
│   │   │   ├── Header.tsx                 # Top nav (logo, user menu, logout)
│   │   │   ├── Badge.tsx                  # Tech stack badge renderer
│   │   │   └── Spinner.tsx                # Loading spinner
│   │   ├── hooks/                         # Custom React hooks
│   │   └── types/
│   │       └── index.ts                   # TypeScript interface definitions
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml
└── README.md
```

---

## Development

### Backend — Local Setup (without Docker)

```bash
cd backend

# Install uv (fast Python package manager)
pip install uv

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate   # macOS/Linux
.venv\Scripts\activate      # Windows

# Install all dependencies (including dev)
uv pip install -e ".[dev]"

# Run the development server
uvicorn app.main:app --reload
```

### Frontend — Local Setup (without Docker)

```bash
cd frontend

npm install
npm run dev
```

### Running Tests

```bash
# Backend unit tests
cd backend
pytest tests/unit -v

# With coverage report
pytest --cov=app --cov-report=html

# Integration tests (requires PostgreSQL + Qdrant running)
pytest tests/integration -v -m integration

# Performance benchmarks
pytest tests/benchmarks -v

# Frontend
cd frontend
npm run test
```

### Code Quality

```bash
# Backend — format, lint, type-check
cd backend
black app
pylint app
mypy app

# Frontend — lint
cd frontend
npm run lint
```

### Useful Docker Commands

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild after dependency changes
docker-compose build --no-cache

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access the database directly
docker-compose exec postgres psql -U codeatlas -d codeatlas_dev

# Stop all services
docker-compose down

# Stop and remove volumes (wipes database and vector store)
docker-compose down -v
```

---

## API Reference

Interactive API documentation is available at:

- **Swagger UI:** http://localhost:8000/api/docs
- **ReDoc:** http://localhost:8000/api/redoc

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `GET` | `/auth/login` | Initiate GitHub OAuth flow |
| `POST` | `/auth/callback` | Exchange OAuth code for JWT |
| `POST` | `/auth/logout` | Logout (clears client token) |
| `GET` | `/auth/me` | Get current authenticated user |

### Repositories

| Method | Path | Description |
|---|---|---|
| `GET` | `/repos` | List user's repositories |
| `GET` | `/repos/{id}` | Get repository details + dashboard data |
| `POST` | `/repos/ingest` | Submit repository for ingestion |
| `GET` | `/repos/ingest/{job_id}/status` | Poll ingestion progress |
| `DELETE` | `/repos/{id}` | Delete repository + vectors |

### Chat (Multi-Turn Q&A)

| Method | Path | Description |
|---|---|---|
| `POST` | `/chat/sessions` | Create a new chat session |
| `GET` | `/chat/sessions` | List sessions for a repository (`?repository_id=...`) |
| `GET` | `/chat/sessions/{session_id}/messages` | Get all messages in a session |
| `POST` | `/chat/sessions/{session_id}/ask` | Ask a question in a session |
| `DELETE` | `/chat/sessions/{session_id}` | Delete a chat session |

### Single-Turn Q&A (deprecated)

| Method | Path | Description |
|---|---|---|
| `POST` | `/query` | Submit a standalone Q&A question |
| `GET` | `/query/{id}` | Retrieve a previous answer |

---

## Configuration Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `QDRANT_URL` | Yes | Qdrant server URL |
| `QDRANT_API_KEY` | No | Qdrant Cloud API key (leave blank for local) |
| `GOOGLE_API_KEY` | Yes | Google AI Studio key (Gemini + Embeddings) |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App Client Secret |
| `JWT_SECRET` | Yes | Random secret for signing JWTs (min 32 chars) |
| `FRONTEND_URL` | Yes | Frontend URL for CORS + OAuth redirect |
| `LOG_LEVEL` | No | Logging level (`INFO`, `DEBUG`, `WARNING`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL |
| `VITE_GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID |

---

## Per-User Limits

| Limit | Value | Notes |
|---|---|---|
| Repositories stored | 3 | Delete one to add another |
| Repositories analyzed per day | 3 | Resets at midnight UTC |
| Max files per repository | 10,000 | Larger repos are rejected |
| Total chunks per user | 100,000 | Hard limit before ingestion |
| Chat questions per session | 15 | Create a new session to continue |
| Chat questions per day | 30 | Resets at midnight UTC |

---

## Roadmap

### Phase 1 — Foundation ✅ Complete
- Docker Compose infrastructure
- FastAPI backend skeleton
- GitHub OAuth authentication
- SQLAlchemy models and Qdrant setup
- React + TypeScript frontend scaffold

### Phase 2 — Ingestion Pipeline ✅ Complete
- Repository cloning (GitPython)
- Code parsing (Tree-sitter — Python, JS, TS, Java, Go)
- Semantic chunking (function / class / endpoint level)
- Embedding generation (Google text-embedding-004)
- Hybrid vector + BM25 storage (Qdrant)
- Auto-generated repository summary and onboarding guide
- API endpoint discovery (no LLM — pure Tree-sitter)
- File dependency graph (NetworkX)

### Phase 3 — Intelligence Layer ✅ Complete
- Hybrid search (dense + BM25 with RRF fusion)
- Multi-turn chat sessions with persistent history
- Natural language Q&A with citations
- Gemini integration for generation

### Phase 4 — Full Frontend ✅ Complete
- 5-tab dashboard (Overview, Ask AI, Guide, API Map, Dependencies)
- Real-time ingestion progress bar with live polling
- Chat interface with session sidebar, typing indicator, and collapsible citations
- Repository management (list, add, delete)

### Phase 5 — Deployment ⏳ Planned
- Vercel (frontend)
- Railway (backend)
- Neon (PostgreSQL)
- Qdrant Cloud

### V2 — Future
- Dependency graph visualization (React Flow)
- Impact analysis ("what breaks if X changes?")
- Private repository support
- Incremental re-indexing (diff-based)
- Repository health insights
- Multi-turn chat history search

---

## Language Support

### Tier 1 — Full AST Parsing (Tree-sitter)
Extracts functions, classes, methods, and endpoints with full metadata.

| Language | Extensions | Endpoint Detection |
|---|---|---|
| Python | `.py` | FastAPI/Flask route decorators |
| JavaScript | `.js`, `.jsx` | Express `router.get/post` patterns |
| TypeScript | `.ts`, `.tsx` | Express + typed exports |
| Java | `.java` | `@RestController`, `@GetMapping` annotations |
| Go | `.go` | `http.HandleFunc`, chi/gin router patterns |

### Tier 2 — Raw Fallback Chunking
All other languages chunked by line count (100 lines max), stored as `chunk_type: raw`.

### Always Skipped
`node_modules/`, `vendor/`, `.git/`, `dist/`, `build/`, `__pycache__/`, `migrations/`, `*.min.js`, `*.min.css`, `*-lock.json`, `*.lock`, binary files.

---

## Contributing

Contributions are welcome! Here's how to get started.

### 1. Fork and Clone

```bash
git clone https://github.com/your-username/codeatlas.git
cd codeatlas
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 3. Set Up Development Environment

Follow the [Getting Started](#getting-started) guide above.

### 4. Make Your Changes

- Write code following the existing patterns
- Add tests for new functionality
- Keep commits small and focused

### 5. Code Quality Checks

```bash
# Backend
cd backend
black app         # format
pylint app        # lint
mypy app          # type check
pytest            # tests

# Frontend
cd frontend
npm run lint      # lint
npm run test      # tests
```

### 6. Submit a Pull Request

- Fill out the PR template
- Describe what changed and why
- Reference any related issues

### Areas Looking for Contributions

- Additional language parsers (Rust, Ruby, C++)
- Test coverage improvements
- Frontend accessibility (WCAG 2.1 AA)
- Documentation improvements
- Performance optimizations
- Bug fixes

### Code Style

**Backend (Python):**
- Formatter: [Black](https://github.com/psf/black) (`line-length = 100`)
- Linter: [Pylint](https://pylint.org/)
- Type checker: [MyPy](https://mypy-lang.org/)
- Docstrings: Google style (only where non-obvious)

**Frontend (TypeScript/React):**
- Formatter: Prettier
- Linter: ESLint
- Strict TypeScript mode enabled

---

## Troubleshooting

### "Missing or invalid required setting" on backend startup

Ensure all required env vars are set in `backend/.env`. The app validates them at startup.

```bash
cat backend/.env
```

### Docker container fails to start

```bash
# Check logs
docker-compose logs backend
docker-compose logs postgres

# Rebuild fresh
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### GitHub OAuth callback fails

- Verify the callback URL in your GitHub OAuth App matches exactly: `http://localhost:3000/callback`
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `backend/.env`
- Ensure `FRONTEND_URL=http://localhost:3000` is set in `backend/.env`

### Port already in use

```bash
# macOS/Linux
lsof -i :8000    # Find what's using the port
kill -9 <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Qdrant collection error on startup

```bash
# Reset Qdrant data
docker-compose down -v
docker-compose up
```

### Ingestion stuck or failed

```bash
# Check backend logs for the error
docker-compose logs -f backend

# Verify your GOOGLE_API_KEY is valid and has available quota
# Google AI Studio free tier is generous but may throttle on large repos
```

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) — Async Python web framework
- [Qdrant](https://qdrant.tech/) — Vector database with built-in BM25
- [Tree-sitter](https://tree-sitter.github.io/) — Language-agnostic code parser
- [Google AI Studio](https://aistudio.google.com/) — Free tier LLM and embeddings
- [Vite](https://vitejs.dev/) — Frontend build tool
- [uv](https://docs.astral.sh/uv/) — Fast Python package manager
- [NetworkX](https://networkx.org/) — Graph analysis library

---

## Support

- **Bug reports:** [Open an issue](https://github.com/your-username/codeatlas/issues)
- **Feature requests:** [Open a discussion](https://github.com/your-username/codeatlas/discussions)
- **Security vulnerabilities:** Email directly (do not open a public issue)

---

*Built with the goal of making every codebase as easy to understand as a well-documented library.*
