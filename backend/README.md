# Backend — Developer Guide

## Setup

### Prerequisites
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (fast Python package manager)
- PostgreSQL and Qdrant running (Docker Compose recommended)

### Install dependencies

```bash
cd backend
uv sync                # install from uv.lock
uv sync --extra dev    # also install pytest, black, mypy
```

### Environment variables

```bash
cp .env.example .env   # then fill in values
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@localhost:5432/codeatlas` |
| `QDRANT_URL` | `http://localhost:6333` |
| `GOOGLE_API_KEY` | Google AI Studio key — used for embeddings (`gemini-embedding-001`) and Gemini LLM |
| `GROQ_API_KEY` | Groq Cloud key — primary LLM *reranker*, and the automatic *fallback* for Q&A generation when Gemini errors or hits quota |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret |
| `JWT_SECRET` | Random secret ≥ 32 chars |
| `FRONTEND_URL` | `http://localhost:3000` (dev) |

Optional: `QDRANT_API_KEY` (Qdrant Cloud only), `LOG_LEVEL` (default: `INFO`).

**LLM provider precedence:** Reranking is Groq-first (`llama-3.3-70b-versatile`) → Gemini fallback. Q&A generation is the reverse — **Gemini 2.0 Flash primary → Groq fallback**: on a Gemini 429 / error, the backend automatically switches to Groq (when `GROQ_API_KEY` is set) and emits a `provider_switch` SSE event so the frontend can notify the user. (The eval citation pass forces Groq-first to sidestep Gemini's rate-limit backoff.)

---

## Running locally

### With Docker Compose (recommended)

```bash
docker-compose up
```

Starts PostgreSQL, Qdrant, and the backend with hot-reload.

### Without Docker

```bash
uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/api/docs`.

---

## Project structure

```
backend/
├── app/
│   ├── main.py                        # FastAPI init, CORS, router registration
│   ├── api/routes/
│   │   ├── auth.py                    # GitHub OAuth login + callback, /auth/me
│   │   ├── repos.py                   # ingest, list, get, delete repos
│   │   ├── query.py                   # one-shot Q&A + POST /query/stream (SSE)
│   │   ├── chat.py                    # sessions, messages, /ask, /stream (SSE)
│   │   ├── impact.py                  # change-impact analysis
│   │   └── eval.py                    # RAG quality evaluation
│   ├── core/
│   │   ├── config.py                  # pydantic-settings, env-var validation on startup
│   │   ├── database.py                # SQLAlchemy async engine, get_session, AsyncSessionLocal
│   │   └── qdrant.py                  # Qdrant async client singleton
│   ├── models/
│   │   ├── db/                        # SQLAlchemy ORM models
│   │   │   ├── base.py                # UUID PK + created_at / updated_at
│   │   │   ├── user.py
│   │   │   ├── repository.py
│   │   │   ├── file.py
│   │   │   ├── chunk.py
│   │   │   ├── ingestion_job.py
│   │   │   ├── question.py
│   │   │   ├── chat_session.py
│   │   │   └── chat_message.py
│   │   └── schemas/                   # Pydantic request/response schemas
│   │       ├── auth.py
│   │       ├── repository.py
│   │       ├── query.py
│   │       └── chat.py
│   └── services/
│       ├── ingestion/
│       │   ├── pipeline.py            # orchestrator called by BackgroundTasks
│       │   ├── cloner.py              # GitPython shallow clone + size guard
│       │   ├── file_filter.py         # skip list, language detection
│       │   ├── parser.py              # dispatches to per-language parsers
│       │   ├── parsers/
│       │   │   ├── python_parser.py
│       │   │   ├── js_parser.py       # .js + .jsx
│       │   │   ├── ts_parser.py       # .ts + .tsx
│       │   │   ├── java_parser.py
│       │   │   ├── go_parser.py
│       │   │   └── fallback_parser.py # 100-line raw chunking for Tier 2
│       │   ├── embedder.py            # gemini-embedding-001, batched
│       │   ├── chunk.py               # Chunk dataclass
│       │   └── store.py               # Qdrant upsert + PostgreSQL insert
│       ├── search/
│       │   ├── retriever.py           # hybrid search: dense + BM25 + RRF, rerank param
│       │   ├── rerank.py              # LLM reranker: Groq first, Gemini fallback (5s timeout → RRF)
│       │   └── sparse.py              # BM25 sparse encoder helpers
│       ├── generation/
│       │   ├── qa.py                  # Gemini 2.0 Flash primary → Groq fallback on quota/error
│       │   │                          # stream_answer_with_history(): SSE async generator
│       │   │                          # emits provider_switch event when provider changes
│       │   ├── summarizer.py          # repo summary (Gemini 2.0 → Groq fallback)
│       │   ├── onboarding.py          # onboarding guide (Gemini 2.0 → Groq fallback)
│       │   └── llm_json.py            # shared sync Gemini→Groq JSON generation helper
│       ├── analysis/
│       │   ├── api_extractor.py       # Tree-sitter route/decorator extraction
│       │   ├── dependency_graph.py    # NetworkX import graph → adjacency JSON
│       │   └── impact.py              # change-impact: transitive dep walk + risk scoring + summary
│       └── evaluation/
│           ├── retrieval_eval.py      # Recall@5, MRR, ablation (HYBRID/DENSE/SPARSE), citation precision
│           └── progress.py            # in-memory eval-run progress registry (polled by the UI)
├── benchmarks/                        # reproducible parser/sparse micro-benchmarks (python -m benchmarks.run)
├── tests/
│   └── unit/                          # pytest unit tests (no external services)
├── alembic/                           # DB migrations
├── pyproject.toml                     # dependencies managed with uv
├── uv.lock
├── .env.example
├── Dockerfile
└── .github/workflows/ci.yml          # black check + pytest unit + mypy
```

---

## API routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/login` | Redirect to GitHub OAuth |
| `GET` | `/auth/callback` | Exchange code, set JWT cookie |
| `GET` | `/auth/me` | Current user info |
| `POST` | `/repos/ingest` | Submit repo for ingestion |
| `GET` | `/repos/ingest/{job_id}/status` | Poll ingestion progress |
| `POST` | `/repos/ingest/{job_id}/cancel` | Cancel an in-flight ingestion |
| `GET` | `/repos` | List user's repos |
| `GET` | `/repos/{repo_id}` | Repo detail (summary, onboarding, endpoints, deps) |
| `GET` | `/repos/{repo_id}/composition` | Codebase composition (languages, roles, chunk types) |
| `DELETE` | `/repos/{repo_id}` | Delete repo from Qdrant + DB |
| `POST` | `/query` | One-shot Q&A with citations |
| `POST` | `/query/stream` | Streaming Q&A (SSE) |
| `POST` | `/query/search` | Semantic code search (retrieval only, no LLM) |
| `GET` | `/chat/sessions` | List chat sessions for a repo |
| `POST` | `/chat/sessions` | Create chat session |
| `DELETE` | `/chat/sessions/{id}` | Delete session |
| `GET` | `/chat/sessions/{id}/messages` | Get session messages |
| `POST` | `/chat/sessions/{id}/ask` | Ask in session (blocking) |
| `POST` | `/chat/sessions/{id}/stream` | Ask in session (SSE streaming) |
| `POST` | `/repos/{repo_id}/impact` | Change-impact analysis for a symbol/function |
| `POST` | `/repos/{repo_id}/eval/run` | Launch RAG evaluation in the background |
| `GET` | `/repos/{repo_id}/eval/status` | Poll a running evaluation's progress |
| `GET` | `/repos/{repo_id}/eval/result` | Get cached eval report |
| `GET` | `/health` | Service health check |

---

## SSE streaming protocol

`POST /query/stream` and `POST /chat/sessions/{id}/stream` both emit Server-Sent Events:

```
data: {"type": "sources",         "sources": [...]}
      ↑ instant — retrieval results before generation starts

data: {"type": "token",           "content": "..."}
      ↑ one per streamed text chunk; answer may contain inline [N] citation markers

data: {"type": "provider_switch", "provider": "groq",   "message": "Gemini quota reached — switched to Groq automatically"}
      ↑ emitted ONLY when the LLM provider changes mid-session (optional event)

data: {"type": "generation_error","message": "..."}
      ↑ forwarded as a token to the client; prevents saving an empty message

data: {"type": "done",            "provider": "gemini",
       "message_id": "...",       "user_message_id": "...",
       "questions_today": N,      "questions_in_session": N}
      ↑ terminal event; "provider" tells frontend which LLM ultimately answered
```

**Inline citations:** the LLM is prompted to place `[N]` markers (1-based chunk index) right after phrases that directly reference a specific function or class. The frontend strips these markers from visible text, using them only to underline the cited phrase and link it to the Evidence panel.

The request session is closed when `StreamingResponse` is returned; the assistant message is persisted inside the generator using a fresh `AsyncSessionLocal()` context.

---

## Retrieval pipeline

```
Query
  → embed with gemini-embedding-001 (RETRIEVAL_QUERY task type)
  → Qdrant prefetch: dense top-20 + BM25 sparse top-20
  → RRF fusion → top-10
  → LLM reranker:
      if GROQ_API_KEY set → Groq llama-3.3-70b-versatile (scores 0-10)
                           → on failure, falls back to Gemini
      else                → Gemini 2.0 Flash (scores 0-10)
      5s timeout on either → falls back to RRF order
  → top-10 final chunks passed to generation layer

Generation layer:
  if GROQ_API_KEY set → Gemini 2.0 Flash primary
                       → on 429 / error → emit provider_switch SSE → Groq fallback
  else               → Gemini 2.0 Flash only
```

Reranking is only applied for `SearchMode.HYBRID` when `rerank=True` is passed to `search()`.

---

## Chat rate limits

Enforced in both `/ask` and `/stream` before any response is sent:

- **15 questions per session**
- **30 questions per user per day** (resets at UTC midnight)

---

## Testing

```bash
# Unit tests (no external services needed)
uv run pytest tests/unit/ -v

# With coverage report
uv run pytest tests/unit/ --cov=app --cov-report=term-missing

# Format check
uv run black --check app

# Type check
uv run mypy app
```

CI runs all three on every push/PR via `.github/workflows/ci.yml`.

---

## Code style

- **Formatter:** Black (line-length 100)
- **Type checker:** MyPy (`ignore_missing_imports = true`)
- **Async:** async/await throughout — SQLAlchemy 2.x async ORM, asyncpg driver
- **Naming:** `snake_case` functions/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` constants

---

## Adding a new route

1. Create `app/api/routes/new_feature.py`
2. Define Pydantic schemas in `app/models/schemas/`
3. Register the router in `app/main.py`
4. Add unit tests in `tests/unit/`

---

See `Project_Spec.md` for full requirements and architecture details.
