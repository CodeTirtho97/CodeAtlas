# CodeAtlas

> **New codebase? Own it in minutes.**

<img width="1578" height="787" alt="image" src="https://github.com/user-attachments/assets/a533bd9f-6076-41dd-b3a4-6311aa398c77" />


CodeAtlas is an open-source, AI-powered repository intelligence platform. Paste any public GitHub URL and instantly get a guided onboarding path, visual dependency map, full API reference, change impact analysis, and an AI that answers architecture questions cited back to the exact file and line.

Instead of reading docs manually or asking teammates, CodeAtlas constructs a structured knowledge base from any public GitHub repository and lets you ask questions like:

- *"How does authentication work?"*
- *"What breaks if I modify PaymentService?"*
- *"Where should a new developer start?"*

---

## Features

- **Auto Onboarding Guide** — Prioritised reading path, key services, and core workflows generated on ingest
- **API Endpoint Discovery** — Every route and HTTP method extracted via Tree-sitter AST — no LLM, no annotations
- **Interactive Dependency Map** — Visual cluster graph of every import relationship; click any node to focus its connections
- **Change Impact Analysis** — Type any function, class, or file to instantly see every file that depends on it
- **Architecture-Aware Q&A** — Ask anything in plain English; every answer cites the exact file, function, and line range
- **AI Answer Evaluation** — Run a retrieval benchmark (Recall@5 + MRR) to check how accurately the AI finds the right code
- **Hybrid Search** — Dense vector + BM25 sparse search merged with manual Reciprocal Rank Fusion (k=60)
- **Multi-Turn Chat** — Persistent sessions with full conversation history
- **Multi-Language Support** — Full AST parsing for Python, JavaScript, TypeScript, Java, Go; fallback chunking for all others

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Graph Visualisation | @xyflow/react (React Flow), dagre (hierarchical layout) |
| Backend | FastAPI, Python 3.11, SQLAlchemy (async) |
| Auth | GitHub OAuth (Authlib) + JWT |
| Relational DB | PostgreSQL 16 |
| Vector DB | Qdrant (dense + sparse; manual RRF fusion) |
| Embeddings | gemini-embedding-001 (3072-dim) |
| LLM | Gemini 2.0 Flash (Google AI Studio) |
| Code Parsing | Tree-sitter (AST-level semantic chunking) |
| Dependency Analysis | NetworkX (directed import graph, hub detection) |
| Containerisation | Docker + Docker Compose |

---

## Architecture

```
Browser (React + TypeScript + Tailwind)
         │
         │  HTTPS (JWT in Authorization header)
         ▼
FastAPI Backend
         │
    ┌────┴──────────────────────────────────────┐
    │                                           │
    ▼                                           ▼
PostgreSQL                                   Qdrant
(users, repos,                         (dense + sparse vectors,
 chunks, chat, jobs)                    manual RRF retrieval)
    │                                           │
    └──────────────┬────────────────────────────┘
                   │
       ┌───────────┼───────────────┐
       ▼           ▼               ▼
 Gemini API   gemini-         Analysis Services
 (answers)  embedding-001    (NetworkX dep graph,
            (indexing)        Tree-sitter endpoints,
                              Impact analysis,
                              Retrieval eval)
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
git clone https://github.com/CodeTirtho97/CodeAtlas.git
cd CodeAtlas
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
3. Copy the key (used for both Gemini Flash and gemini-embedding-001 — same key)

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
4. Generating embeddings (gemini-embedding-001)
5. Storing vectors in Qdrant + metadata in PostgreSQL
6. Building the dependency graph (NetworkX)
7. Extracting API endpoints (Tree-sitter — no LLM)
8. Generating repository summary (Gemini)
9. Generating the onboarding guide (Gemini)

### 3. Explore the Dashboard

Once complete, the dashboard provides six tabs:

| Tab | What it does |
|---|---|
| **Overview** | Purpose, tech stack, architecture description, entry points, and quick navigation |
| **Understand** | Step-by-step onboarding guide — files to read first and core workflows |
| **Explore** | All discovered API endpoints + interactive dependency map with cluster tabs |
| **Ask AI** | Multi-turn chat with persistent history and cited answers |
| **Impact Area** | Type any function, class, or file — see every file that depends on it |
| **Evaluate** | Run a retrieval benchmark to check AI answer accuracy (Recall@5 + MRR) |

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

### 5. Check Change Impact

Go to the **Impact Area** tab and type any symbol or file path:

```
UserService
auth/service.py
POST /login
```

CodeAtlas traces every file that transitively depends on it — so you know exactly what will break before touching a line.

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
│   │   │   ├── chat.py                    # Multi-turn chat sessions + Q&A
│   │   │   ├── impact.py                  # Change impact analysis endpoint
│   │   │   └── eval.py                    # Retrieval evaluation endpoint
│   │   ├── core/
│   │   │   ├── config.py                  # Pydantic settings (validated env vars)
│   │   │   ├── database.py                # Async SQLAlchemy engine + session
│   │   │   └── qdrant.py                  # Qdrant client + collection init
│   │   ├── models/
│   │   │   ├── db/                        # SQLAlchemy ORM models
│   │   │   │   ├── base.py
│   │   │   │   ├── user.py                # GitHub user + rate limiting
│   │   │   │   ├── repository.py          # Repo metadata + summary/guide JSON
│   │   │   │   ├── chunk.py               # Code chunks (semantic units)
│   │   │   │   ├── ingestion_job.py       # Ingestion job progress tracking
│   │   │   │   ├── chat_session.py
│   │   │   │   └── chat_message.py
│   │   │   └── schemas/                   # Pydantic request/response schemas
│   │   └── services/
│   │       ├── ingestion/                 # Clone → parse → embed → store
│   │       │   ├── pipeline.py            # Async orchestrator
│   │       │   ├── cloner.py              # GitPython repo clone
│   │       │   ├── file_filter.py         # Exclude vendor/build artifacts
│   │       │   ├── parser.py              # AST parsing dispatcher
│   │       │   ├── parsers/               # Per-language Tree-sitter parsers
│   │       │   │   ├── python_parser.py
│   │       │   │   ├── js_parser.py
│   │       │   │   ├── ts_parser.py
│   │       │   │   ├── java_parser.py
│   │       │   │   ├── go_parser.py
│   │       │   │   └── fallback_parser.py
│   │       │   ├── embedder.py            # gemini-embedding-001 calls
│   │       │   └── store.py               # Qdrant + PostgreSQL persistence
│   │       ├── search/
│   │       │   ├── retriever.py           # Hybrid search: 2× query_points + manual RRF
│   │       │   └── sparse.py              # BM25-like feature-hash tokenizer
│   │       ├── generation/
│   │       │   ├── qa.py                  # LLM Q&A with context + chat history
│   │       │   ├── summarizer.py          # Purpose, stack, architecture summary
│   │       │   └── onboarding.py          # Step-by-step learning guide
│   │       ├── analysis/
│   │       │   ├── api_extractor.py       # HTTP endpoint discovery (Tree-sitter)
│   │       │   ├── dependency_graph.py    # Import graph via NetworkX
│   │       │   └── impact.py             # Transitive dependency impact analysis
│   │       └── evaluation/
│   │           └── retrieval_eval.py      # Recall@5 + MRR benchmark runner
│   ├── alembic/                           # DB migration scripts
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                        # Router + ProtectedRoute wrapper
│   │   ├── api/
│   │   │   ├── client.ts                  # Axios instance with JWT injection
│   │   │   ├── repos.ts                   # Repository CRUD + ingestion
│   │   │   └── chat.ts                    # Chat sessions + multi-turn Q&A
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── CallbackPage.tsx
│   │   │   ├── DashboardPage.tsx          # 6-tab repository dashboard
│   │   │   ├── IngestionPage.tsx          # Real-time ingestion progress
│   │   │   └── ArchitecturePage.tsx
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── AppFooter.tsx
│   │       ├── dashboard/
│   │       │   ├── OverviewPanel.tsx
│   │       │   ├── UnderstandPanel.tsx
│   │       │   ├── ExplorePanel.tsx       # API map + dependency graph
│   │       │   ├── DependencyGraph.tsx    # React Flow + dagre cluster graph
│   │       │   ├── AskAIWorkspace.tsx
│   │       │   ├── ImpactWorkbench.tsx    # Change impact analysis UI
│   │       │   └── EvalDashboard.tsx      # Retrieval evaluation UI
│   │       ├── landing/
│   │       │   ├── AnalyzeForm.tsx
│   │       │   ├── RepoCard.tsx
│   │       │   ├── RepoSection.tsx
│   │       │   └── FeaturesGrid.tsx
│   │       └── architecture/
│   │           ├── PipelineSection.tsx
│   │           ├── HybridSearchSection.tsx
│   │           ├── FeaturesUnlockedSection.tsx
│   │           ├── BenchmarksSection.tsx
│   │           └── TechStackSection.tsx
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

# With coverage
pytest --cov=app --cov-report=html

# Integration tests (requires PostgreSQL + Qdrant running)
pytest tests/integration -v -m integration

# Frontend
cd frontend
npm run test
```

### Useful Docker Commands

```bash
docker-compose up                          # Start all services
docker-compose up -d                       # Start in background
docker-compose build --no-cache            # Rebuild after dependency changes
docker-compose logs -f backend             # Stream backend logs
docker-compose exec postgres psql -U codeatlas -d codeatlas_dev
docker-compose down                        # Stop all services
docker-compose down -v                     # Stop and wipe all volumes
```

---

## API Reference

Interactive docs: **http://localhost:8000/api/docs** (Swagger UI)

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `GET` | `/auth/login` | Initiate GitHub OAuth flow |
| `POST` | `/auth/callback` | Exchange OAuth code for JWT |
| `GET` | `/auth/me` | Get current authenticated user |

### Repositories

| Method | Path | Description |
|---|---|---|
| `GET` | `/repos` | List user's repositories |
| `GET` | `/repos/{id}` | Get repository details + dashboard data |
| `POST` | `/repos/ingest` | Submit repository for ingestion |
| `GET` | `/repos/ingest/{job_id}/status` | Poll ingestion progress |
| `DELETE` | `/repos/{id}` | Delete repository + vectors |

### Chat

| Method | Path | Description |
|---|---|---|
| `POST` | `/chat/sessions` | Create a new chat session |
| `GET` | `/chat/sessions` | List sessions for a repository |
| `GET` | `/chat/sessions/{id}/messages` | Get all messages in a session |
| `POST` | `/chat/sessions/{id}/ask` | Ask a question in a session |
| `DELETE` | `/chat/sessions/{id}` | Delete a chat session |

### Analysis

| Method | Path | Description |
|---|---|---|
| `POST` | `/impact/{repo_id}` | Run change impact analysis for a symbol or file |
| `POST` | `/eval/{repo_id}` | Run retrieval evaluation (Recall@5 + MRR) |

---

## Configuration Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `QDRANT_URL` | Yes | Qdrant server URL |
| `QDRANT_API_KEY` | No | Qdrant Cloud API key (leave blank for local) |
| `GOOGLE_API_KEY` | Yes | Google AI Studio key (Gemini + gemini-embedding-001) |
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

### Phase 1 — Foundation ✅
Docker Compose infrastructure, FastAPI backend, GitHub OAuth, SQLAlchemy + Qdrant setup, React + TypeScript scaffold

### Phase 2 — Ingestion Pipeline ✅
Repository cloning, Tree-sitter AST parsing (Python, JS, TS, Java, Go), semantic chunking, gemini-embedding-001 embeddings, hybrid vector + BM25 storage, auto-generated summary and onboarding guide, API endpoint discovery, NetworkX dependency graph

### Phase 3 — Intelligence Layer ✅
Hybrid dense+sparse search with manual RRF fusion (k=60), multi-turn chat with persistent history, cited Q&A, Gemini 2.0 Flash integration

### Phase 4 — Analysis Features ✅
Interactive dependency graph with cluster tabs (React Flow + dagre), change impact analysis, AI answer quality evaluation (Recall@5 + MRR)

### Phase 5 — Full Frontend ✅
6-tab dashboard (Overview, Understand, Explore, Ask AI, Impact Area, Evaluate), real-time ingestion progress, chat interface with session history, repository management

### Phase 6 — Deployment ⏳ Planned
- Vercel (frontend)
- Railway (backend)
- Neon (PostgreSQL)
- Qdrant Cloud

### V2 — Future
- Private repository support (GitHub App installation flow)
- Incremental re-indexing (diff-based — only changed files)
- Multi-turn chat history search
- Repository health insights
- Additional language parsers (Rust, Ruby, C#, C++)

---

## Language Support

### Tier 1 — Full AST Parsing (Tree-sitter)

| Language | Extensions | Endpoint Detection |
|---|---|---|
| Python | `.py` | FastAPI / Flask route decorators |
| JavaScript | `.js`, `.jsx` | Express `router.get/post` patterns |
| TypeScript | `.ts`, `.tsx` | Express + typed exports |
| Java | `.java` | `@RestController`, `@GetMapping` annotations |
| Go | `.go` | `http.HandleFunc`, chi / gin router patterns |

### Tier 2 — Raw Fallback Chunking
All other languages chunked by line count (100 lines max), stored as `chunk_type: raw`.

### Always Skipped
`node_modules/`, `vendor/`, `.git/`, `dist/`, `build/`, `__pycache__/`, `migrations/`, `*.min.js`, `*.min.css`, `*-lock.json`, `*.lock`, binary files.

---

## Troubleshooting

### "Missing or invalid required setting" on backend startup
Ensure all required env vars are set in `backend/.env`. The app validates them at startup.

### Docker container fails to start
```bash
docker-compose logs backend
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### GitHub OAuth callback fails
- Verify callback URL in your GitHub OAuth App matches exactly: `http://localhost:3000/callback`
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `backend/.env`
- Ensure `FRONTEND_URL=http://localhost:3000` is set

### Port already in use
```bash
# macOS/Linux
lsof -i :8000 && kill -9 <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Ingestion stuck or failed
```bash
docker-compose logs -f backend
# Verify GOOGLE_API_KEY is valid and has available quota
```

### Qdrant 400 errors on search
Ensure you're running qdrant-client ≥ 1.18.0. CodeAtlas uses two separate `query_points` calls with manual RRF — the older native Prefetch+Fusion API is not used.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) — Async Python web framework
- [Qdrant](https://qdrant.tech/) — Vector database with dense + sparse support
- [Tree-sitter](https://tree-sitter.github.io/) — Language-agnostic AST parser
- [Google AI Studio](https://aistudio.google.com/) — Gemini Flash + gemini-embedding-001
- [React Flow (@xyflow/react)](https://reactflow.dev/) — Interactive graph visualisation
- [dagre](https://github.com/dagrejs/dagre) — Hierarchical graph layout
- [NetworkX](https://networkx.org/) — Python graph analysis
- [Vite](https://vitejs.dev/) — Frontend build tool
- [uv](https://docs.astral.sh/uv/) — Fast Python package manager

---

*Built with the goal of making every codebase as navigable as one you wrote yourself.*
