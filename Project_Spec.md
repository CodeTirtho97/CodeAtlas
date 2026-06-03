# CodeAtlas

## AI-Powered Repository Intelligence Platform

*Turn any GitHub repository into a searchable knowledge graph.*

---

# 1. Project Overview

CodeAtlas is a platform that enables developers to understand unfamiliar GitHub repositories using Retrieval-Augmented Generation (RAG), semantic code search, and architecture-aware reasoning.

Instead of merely answering questions from repository files, the platform constructs a structured knowledge base representing:

* Source code
* Documentation
* Dependency relationships
* API endpoints
* Repository structure
* Architectural components

The resulting system acts as an AI-powered onboarding and code understanding assistant.

---

# 2. Problem Statement

Developers frequently spend hours or days understanding:

* New repositories
* Legacy codebases
* Open-source projects
* Large enterprise systems

Current approaches require:

* Reading documentation
* Manual code exploration
* Searching through files
* Asking teammates

CodeAtlas accelerates repository understanding through automated knowledge extraction and intelligent retrieval.

---

# 3. Target Users

### Primary

Software Engineers

### Secondary

* Open Source Contributors
* SDET Engineers
* Engineering Managers
* Students learning large codebases

---

# 4. Core User Flow

## Step 1

User logs in via GitHub OAuth and submits a GitHub Repository URL.

Example:

https://github.com/fastapi/fastapi

---

## Step 2

System validates the repository (size guard: reject repos > 10,000 files), then clones it to a temporary directory on the server. After ingestion is complete, the cloned files are deleted. Only the extracted chunks and embeddings are persisted (Qdrant + PostgreSQL). Disk usage is ephemeral and bounded by the file guard.

---

## Step 3

System analyzes repository.

Extract:

* README
* Documentation
* Source code
* Config files
* Dependency files
* API specifications

---

## Step 4

Knowledge Base Creation

Generate:

* Semantic chunks (by function / class / method — not fixed-length)
* Embeddings
* Repository metadata
* File dependency adjacency data

Store in:

* PostgreSQL
* Qdrant

---

## Step 5

Dashboard is automatically populated with:

* Repository Summary card
* "Start Here" onboarding guide
* Discovered API endpoints list
* File dependency list

---

## Step 6

User asks questions.

Examples:

How does authentication work?

What is the request flow for login?

Which files interact with UserService?

What breaks if I modify PaymentService?

Where should a new developer start?

---

## Step 7

System retrieves relevant context and generates a response.

Response format:

* Full natural-language explanation answering the question
* Sources block: file path + function/class name + line range for every chunk used

---

# 5. Functional Requirements

## FR-1 Repository Ingestion

Input:

GitHub URL

Output:

Local cloned repository

Supported:

* Public repositories (MVP)

Future:

* Private repositories

Guard:

* Reject repositories exceeding 10,000 files

---

## FR-2 Repository Parsing

Extract:

README files

Markdown documents

Source code

Configuration files

Package manifests

Examples:

requirements.txt

pom.xml

package.json

Dockerfile

docker-compose.yml

---

## FR-2a Language Support Tiers

Repositories can contain multiple languages. Parsing strategy depends on the tier.

### Tier 1 — Full AST Parsing (Tree-sitter)

Extract functions, classes, methods, and endpoints with full metadata.

Supported languages (MVP):

* Python
* JavaScript
* TypeScript
* Java
* Go

These five languages cover the majority of popular open-source repositories.

### Tier 2 — Raw Fallback Chunking

No AST available. Chunk by line count (max 100 lines per chunk) and store as `chunk_type: raw`.

Applied to:

* All languages not in Tier 1 (Ruby, Rust, C/C++, PHP, etc.)
* Configuration files (JSON, YAML, TOML)
* Shell scripts
* Dockerfiles
* CI config files (.github/workflows, .gitlab-ci.yml)
* Markdown / plain text documentation

### Skip List — Never Index

These files and directories are excluded from ingestion entirely:

| Pattern | Reason |
|---|---|
| `node_modules/` | Third-party dependencies, not project code |
| `vendor/` | Same as above |
| `.git/` | Version control internals |
| `*.min.js`, `*.min.css` | Minified, unreadable |
| `package-lock.json`, `yarn.lock`, `poetry.lock`, `Pipfile.lock` | Lock files, no semantic value |
| `*.pb.go`, `*_generated.go` | Generated code |
| `migrations/` | DB migration files (schema noise) |
| `dist/`, `build/`, `__pycache__/` | Build artifacts |
| Binary files | Images, compiled objects |

### Cross-Language Dependencies

Within-language import tracking is handled by NetworkX (FR-11).

Cross-language boundaries (e.g., React frontend → FastAPI backend) are not tracked via imports — they communicate over HTTP. These connections are already captured at the API boundary level via FR-10 (endpoint discovery). No additional cross-language dependency tracking in MVP.

---

## FR-3 Code Chunking

Chunking strategy:

NOT fixed-length chunking.

**Tier 1 languages:** Chunk by semantic unit via Tree-sitter AST:

* Class
* Function
* Method
* Endpoint (e.g., `@app.get(...)` in Python, `@GetMapping` in Java)

**Tier 2 languages and config files:** Chunk by line count (max 100 lines).

Language-specific notes:

* Python: extract FastAPI/Flask route decorators as `chunk_type: endpoint`
* Java: use `@RestController`, `@Service`, `@Repository` annotations to tag architectural role
* JavaScript/TypeScript: handle named exports and arrow function components
* Go: chunk by function and struct methods (no classes)

Metadata per chunk:

* file_path
* language
* language_tier (1 or 2)
* class_name
* function_name
* chunk_type (function / class / endpoint / doc / raw)
* architectural_role (controller / service / repository / utility — where detectable)
* repository_name
* line_start
* line_end

---

## FR-4 Embedding Generation

Generate embeddings for:

* Source code
* Documentation
* README sections

Model: Google text-embedding-004 (via Google AI Studio API)

* Same API key as Gemini — no additional accounts or setup
* Runs on Google's infrastructure — no model weights on the server
* 768-dimensional vectors
* Free tier: 1,500 requests/minute

Store in Qdrant.

---

## FR-5 Semantic Search

User queries should retrieve Top-K relevant chunks.

Search type: Hybrid Search

* Vector Search
* Keyword Search (BM25 via Qdrant built-in)

---

## FR-6 Repository Question Answering

Support:

* Architecture questions
* Code understanding questions
* API questions
* Dependency questions
* Onboarding questions

Response format:

* Full natural-language explanation (LLM-generated from retrieved context)
* Sources block listing every chunk used: file path, function/class name, line range

---

## FR-7 Citation Support

Every answer must include a Sources block:

Example:

```
Sources:
- auth/service.py — authenticate_user() [lines 42–67]
- middleware/jwt.py — verify_token() [lines 17–31]
- db/models.py — User [lines 5–28]
```

---

## FR-8 Repository Summary

Automatically generate on ingestion completion:

* Purpose
* Main Components
* Technologies
* Architecture overview
* Key Entry Points

Generated via: single LLM call over README + top-level files.

---

## FR-9 Developer Onboarding Guide

Automatically generate on ingestion completion:

* Files to read first
* Important services
* Core workflows
* Suggested learning path

Generated via: single LLM call over parsed structure + README.

---

## FR-10 API Endpoint Discovery

Automatically extract from source code via Tree-sitter (no LLM required):

* Routes
* Controllers
* HTTP methods

Example output:

```
GET  /users
POST /login
PUT  /users/{id}
```

---

## FR-11 File Dependency List

Automatically generate a file-level dependency adjacency list via NetworkX.

Example output:

```
auth/service.py
  → used by: routes/auth.py, middleware/jwt.py
  → uses:    db/models.py, utils/hash.py
```

Display as a structured list on the dashboard. No graph visualization in MVP.

---

# 6. Authentication and Rate Limiting

## Auth Method

GitHub OAuth

* Users log in with their GitHub account
* Sets up V2 private repository support with zero rework

## Per-User Limits

| Limit | Value | Enforcement |
|---|---|---|
| Repos stored per user | 3 | UI blocks new ingestion; prompt to delete one |
| Chunk cap per user | 100,000 chunks | Hard backend rejection before ingestion starts |
| Repos analyzed per day | 3 | Resets at midnight UTC |
| Max files per repository | 10,000 | Rejected at ingestion start |

## Repo Management

* User can view their 3 stored repos on a dashboard
* User can delete a repo (wipes Qdrant collection + DB records)
* Deleting frees slot for a new repo

---

# 7. Non Functional Requirements

Response Time:

< 5 seconds per Q&A query after indexing

---

Repository Size:

Up to 10,000 files (MVP)

---

Concurrent Users:

10+

---

Availability:

Single AWS EC2 deployment

---

# 8. System Architecture

```
Frontend (React + TypeScript + TailwindCSS)
        ↓
FastAPI Backend
        ↓
Repository Processing Service (GitPython + Tree-sitter)
        ↓
Embedding Service (Nomic Embed)
        ↓
Qdrant (vector + keyword search)
        ↓
LLM Layer (Gemini API)
        ↓
Response Generation (explanation + citations)
```

---

# 9. Technology Stack

Frontend

* React
* TypeScript
* TailwindCSS

Backend

* FastAPI
* Python

Authentication

* GitHub OAuth (Authlib)

Database

* PostgreSQL

Vector Database

* Qdrant

Repository Processing

* GitPython

Code Parsing

* Tree-sitter

Graph / Dependency Analysis

* NetworkX

Containerization

* Docker

Deployment

* AWS EC2

LLM

* Gemini API (Google AI Studio)

Embeddings

* Google text-embedding-004 (Google AI Studio — same API key as Gemini)

---

# 10. Database Schema

Repository

* id
* user_id (FK → Users)
* github_url
* name
* status
* chunk_count
* created_at

Users

* id
* github_id
* github_username
* email
* repos_analyzed_today
* last_reset_at

Files

* id
* repository_id
* path
* language

Chunks

* id
* repository_id
* file_id
* chunk_text
* chunk_type  (function / class / endpoint / doc)
* function_name
* class_name
* line_start
* line_end
* embedding_id

Questions

* id
* repository_id
* user_id
* question
* answer
* source_chunk_ids (array)
* created_at

---

# 11. Detailed API Contracts

## Authentication Endpoints

### `POST /auth/login`
Initiates GitHub OAuth flow.

**Request:**
```json
{
  "redirect_uri": "https://codeatlas.vercel.app/callback"
}
```

**Response:**
```json
{
  "auth_url": "https://github.com/login/oauth/authorize?client_id=..."
}
```

**Status Codes:**
- `200` — auth URL generated
- `400` — invalid redirect_uri

---

### `GET /auth/callback?code=<code>&state=<state>`
GitHub OAuth callback handler.

**Response:**
```json
{
  "access_token": "jwt_token",
  "user": {
    "id": "uuid",
    "github_username": "user",
    "email": "user@example.com"
  }
}
```

**Cookies Set:**
- `Authorization: Bearer <jwt_token>` (httpOnly, secure, 7-day expiry)

**Status Codes:**
- `302` — redirect to dashboard with token in cookie
- `400` — invalid OAuth code
- `500` — token exchange failed

---

## Repository Management Endpoints

### `POST /repos/ingest`
Submit a GitHub repository for ingestion.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "github_url": "https://github.com/fastapi/fastapi"
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "repository_id": "uuid",
  "status": "pending",
  "github_url": "https://github.com/fastapi/fastapi"
}
```

**Status Codes:**
- `202` — ingestion started
- `400` — invalid URL format, unsupported repo type (private)
- `403` — unauthorized
- `409` — user already has 3 repos, user hit daily limit (3/day)
- `413` — repo exceeds 10,000 files

**Validation:**
- URL must match pattern: `https://github.com/[owner]/[repo]`
- Reject private repos (MVP only allows public)
- Reject if user has 3 repos already
- Reject if user hit daily ingestion limit (resets at UTC midnight)
- Reject if estimated file count > 10,000 (via GitHub API)

---

### `GET /repos/ingest/{job_id}/status`
Poll ingestion job status.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "running",
  "progress_pct": 45,
  "progress_message": "Parsing code...",
  "error": null
}
```

**Status Values:**
- `pending` — queued
- `running` — in progress
- `completed` — success
- `failed` — error occurred

**Error Response (status=failed):**
```json
{
  "job_id": "uuid",
  "status": "failed",
  "progress_pct": 20,
  "error": "Repository cloning failed: connection timeout"
}
```

**Status Codes:**
- `200` — status retrieved
- `404` — job not found
- `403` — unauthorized (not job owner)

---

### `GET /repos`
List user's repositories.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "repositories": [
    {
      "id": "uuid",
      "name": "fastapi",
      "github_url": "https://github.com/fastapi/fastapi",
      "status": "completed",
      "chunk_count": 1250,
      "created_at": "2026-06-03T10:30:00Z",
      "summary": {
        "purpose": "Modern Python web framework...",
        "stack": ["Python", "FastAPI"],
        "entry_points": ["main.py"]
      }
    }
  ]
}
```

**Query Parameters:**
- `limit`: 10 (default)
- `offset`: 0 (default)

**Status Codes:**
- `200` — success
- `403` — unauthorized

---

### `GET /repos/{repo_id}`
Get single repository details (includes summary, onboarding, endpoints, dependencies).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "repository": {
    "id": "uuid",
    "name": "fastapi",
    "github_url": "https://github.com/fastapi/fastapi",
    "status": "completed",
    "chunk_count": 1250,
    "created_at": "2026-06-03T10:30:00Z",
    "summary": {
      "purpose": "...",
      "stack": ["Python", "FastAPI", "Starlette"],
      "architecture": "...",
      "entry_points": ["main.py", "app/routes"]
    },
    "onboarding": {
      "steps": [
        {
          "order": 1,
          "title": "Start with main.py",
          "files": ["main.py"],
          "description": "..."
        }
      ],
      "core_workflows": ["..."],
      "learning_path": "..."
    },
    "api_endpoints": [
      {
        "method": "GET",
        "path": "/users",
        "file_path": "routes/users.py",
        "function_name": "get_users",
        "line": 42
      }
    ],
    "dependencies": {
      "auth/service.py": {
        "uses": ["db/models.py", "utils/hash.py"],
        "used_by": ["routes/auth.py"]
      }
    }
  }
}
```

**Status Codes:**
- `200` — success
- `404` — repo not found
- `403` — unauthorized

---

### `DELETE /repos/{repo_id}`
Delete repository (removes from Qdrant + PostgreSQL).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Repository deleted successfully"
}
```

**Status Codes:**
- `204` — success (no content)
- `404` — repo not found
- `403` — unauthorized

---

## Query & Q&A Endpoints

### `POST /query`
Submit a question about a repository.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "repository_id": "uuid",
  "question": "How does authentication work?"
}
```

**Response:**
```json
{
  "question_id": "uuid",
  "answer": "Authentication in this codebase is handled via...",
  "sources": [
    {
      "file_path": "auth/service.py",
      "function_name": "authenticate_user",
      "class_name": null,
      "line_start": 42,
      "line_end": 67,
      "chunk_type": "function"
    },
    {
      "file_path": "middleware/jwt.py",
      "function_name": "verify_token",
      "class_name": null,
      "line_start": 17,
      "line_end": 31,
      "chunk_type": "function"
    }
  ]
}
```

**Request Validation:**
- `question` length: 10–1000 characters
- `repository_id` must exist and belong to user
- Rate limit: 10 queries per user per hour (per repo)

**Status Codes:**
- `200` — answer generated
- `400` — invalid question (too short/long)
- `404` — repo not found
- `403` — unauthorized
- `429` — rate limit exceeded

**Error Response:**
```json
{
  "error": "rate_limit_exceeded",
  "retry_after": 3600
}
```

---

### `GET /query/{question_id}`
Retrieve previous question and answer.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
Same as `POST /query` response.

**Status Codes:**
- `200` — success
- `404` — question not found
- `403` — unauthorized

---

## Health & Status Endpoints

### `GET /health`
Service health check.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "ok",
    "qdrant": "ok",
    "gemini_api": "ok"
  }
}
```

**Status Codes:**
- `200` — all services healthy
- `503` — one or more services down

---

## Global Error Response Format

All error responses follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": {}
}
```

**Common Error Codes:**
- `invalid_request` — malformed JSON, missing fields
- `invalid_input` — validation failed (URL format, text length)
- `unauthorized` — missing/invalid JWT token
- `forbidden` — insufficient permissions
- `rate_limit_exceeded` — too many requests
- `not_found` — resource doesn't exist
- `conflict` — conflicting state (3 repos already)
- `internal_error` — server error

---

## Rate Limiting Headers

All responses include rate limit info:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1717410600
```

---

# 12. Security Specifications

## Input Validation

### General Rules

**All text inputs:**
- Maximum length: enforce per endpoint (see API contracts)
- Character whitelist: alphanumeric + common punctuation (no script tags, no SQL keywords)
- Trim whitespace before/after validation

**GitHub URLs:**
- Pattern: `^https://github\.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$`
- Reject if URL contains query strings or fragments
- Reject if URL points to GitHub Enterprise (only github.com)

**File paths in responses:**
- Always sanitize before returning to frontend (remove ../, normalize slashes)
- Never trust file paths from user input

---

## CORS & HTTP Security

**CORS Policy:**
```python
allow_origins = ["https://codeatlas.vercel.app"]  # production
# Dev: ["http://localhost:3000", "http://localhost:5173"]
allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
allow_headers = ["Content-Type", "Authorization"]
allow_credentials = True
max_age = 3600
```

**HTTP Headers (FastAPI middleware):**
```python
"Strict-Transport-Security": "max-age=31536000; includeSubDomains"
"X-Content-Type-Options": "nosniff"
"X-Frame-Options": "DENY"
"X-XSS-Protection": "1; mode=block"
"Content-Security-Policy": "default-src 'self'; script-src 'self'"
```

---

## JWT Token Management

**Token Payload:**
```json
{
  "user_id": "uuid",
  "github_username": "user",
  "iat": 1717406400,
  "exp": 1717996400
}
```

**Token Settings:**
- Expiry: 7 days
- Algorithm: HS256 (symmetric, uses JWT_SECRET)
- Issued at: UTC timestamp
- Storage: httpOnly cookie (browser cannot access via JS)

**Token Refresh:**
- No refresh token in MVP
- User must re-login after 7 days (acceptable for dev tool)
- In V2: implement refresh token rotation

---

## OAuth Token Security

**GitHub OAuth tokens stored in database (for V2 private repos):**
- Encrypt in transit (always use HTTPS)
- Encrypt at rest (use SQLAlchemy hybrid properties or envelope encryption)
- Never log tokens
- Revoke on logout
- Token vault: environment variable `GITHUB_TOKEN_ENCRYPTION_KEY` (generated during deployment)

---

## Database Security

**PostgreSQL:**
- All connections via SSL/TLS (force_ssl=on in Neon)
- User roles: `codeatlas_app` (read/write) vs `codeatlas_admin` (schema)
- No raw SQL: all queries via SQLAlchemy ORM
- Prepared statements: parameterized queries only

**Secrets Management:**
- Never commit `.env` files
- Use `.env.example` as template
- Validate all required env vars on startup
- Rotate `JWT_SECRET` annually (requires re-auth)

---

## API Security

**Rate Limiting:**
- Per-user, per-endpoint (using user_id + endpoint path)
- Backend: in-memory dict with periodic cleanup (no Redis MVP)
- Algorithm: token bucket (refill 10 tokens/hour per endpoint)
- Headers: X-RateLimit-* returned on all responses

**Authentication:**
- All endpoints except `/auth/login`, `/auth/callback`, `/health` require valid JWT
- JWT validated on every request (middleware)
- Expired/invalid JWT → 403 Forbidden

---

## Third-Party API Security

**Google AI (Gemini + Embeddings):**
- API key stored in `GOOGLE_API_KEY` env var
- Never embed key in frontend code
- Call only from backend
- Monitor API usage via Google Cloud Console

**GitHub API:**
- OAuth token never exposed to frontend
- Backend handles all GitHub API calls
- Use OAuth app credentials, not personal access tokens

---

## Data Privacy & PII

**User Data Stored:**
- `github_id`, `github_username`, `email`
- These are public GitHub data, acceptable to store
- No storage of: GitHub access tokens (yet), private user info

**Question/Answer Logging:**
- Questions stored in `questions` table (user can delete)
- Answers cached but not re-served without user query
- No telemetry on question content

---

# 13. Error Handling & Resilience

## Ingestion Pipeline Failures

**Clone Failures:**
- Network timeout (> 30s) → retry with exponential backoff, max 3 attempts
- Repository not found (404) → fail immediately, log error code
- Repository too large (>10k files) → fail immediately, user-friendly message

**Parsing Failures:**
- Single file parse error → log and skip, continue with next file
- If > 50% of files fail → fail entire ingestion, alert admin
- Unsupported encoding → treat as binary, skip

**Embedding Failures:**
- API rate limit (429) → exponential backoff, max 5 retries over 10 minutes
- API quota exceeded → fail ingestion, return "quota exceeded" error
- Network timeout → retry with exponential backoff, max 3 attempts
- Single batch failure → retry that batch, skip if fails twice

**Qdrant Storage Failures:**
- Connection timeout → retry up to 5 times, exponential backoff
- Write failure → log error, keep running (graceful degradation — search may be incomplete)
- Collection doesn't exist → auto-create

**Gemini API Failures (summary/onboarding):**
- Rate limit → exponential backoff, max 3 retries
- Content policy violation → skip generation, store `{error: "content_policy_violation"}`
- Network timeout → skip, continue with ingestion

---

## Query Pipeline Failures

**Search Failures (Qdrant):**
- Connection timeout → return 503, user sees "Search temporarily unavailable"
- Collection missing → return 404, suggest re-ingesting

**LLM Failures (Gemini):**
- Rate limit → wait and retry (up to 30s total)
- Content policy violation → return generic response "Unable to generate answer"
- Network timeout → return 503

**Database Failures (PostgreSQL):**
- Connection pool exhausted → reject new connections with 503
- Query timeout → log and return 500
- Disk full → log error, page admin

---

## Resilience Patterns

**Exponential Backoff Formula:**
```
delay = base_delay * (multiplier ^ attempt_count) + random_jitter
base_delay = 1 second
multiplier = 2
jitter = random(0, 1) seconds
max_delay = 60 seconds
```

**Graceful Degradation:**
- If Qdrant fails during query → return empty results with error note (not 500)
- If Gemini fails during Q&A → return retrieved context only (no LLM explanation)
- If dependency list fails to generate → return `{dependencies: null}` in dashboard

**Dead Letter Queue (MVP):**
- Failed ingestions logged to `failed_ingestions` table
- Admin endpoint to view and retry failed jobs
- Automatic cleanup of > 30-day-old failed jobs

---

## Circuit Breaker Pattern

**Third-Party APIs:**
- Google AI: if 5 consecutive requests fail → open circuit for 5 minutes, return cached response
- GitHub API: if service returns 500+ for 10 consecutive requests → open circuit
- Qdrant: if unavailable for > 5 minutes → alert admin

---

# 14. Performance Optimization

## Caching Strategy

**In-Memory Cache (FastAPI + cache decorator):**
- Repository summary: cache for 24 hours (re-index triggers invalidation)
- Onboarding guide: cache for 24 hours
- API endpoints list: cache for 24 hours
- File dependencies: cache for 24 hours
- User repo list: cache for 1 hour
- Health status: cache for 30 seconds

**Query Response Caching:**
- Same question asked twice by same user → return cached answer (24 hour TTL)
- Cache key: `hash(question + repository_id)`
- Store in `questions` table `cached_until` field

**Embedding Caching:**
- Identical code chunks (same hash) → reuse embedding from previous ingestion
- Hash: SHA256 of chunk text
- Saves API calls during re-indexing

---

## Database Optimization

**Indexes (PostgreSQL):**
```sql
-- Chunks table (critical for search)
CREATE INDEX idx_chunks_repository_id ON chunks(repository_id);
CREATE INDEX idx_chunks_qdrant_point_id ON chunks(qdrant_point_id);
CREATE INDEX idx_chunks_file_id ON chunks(file_id);

-- Files table
CREATE INDEX idx_files_repository_id ON files(repository_id);

-- Users table
CREATE INDEX idx_users_github_id ON users(github_id);

-- Questions table
CREATE INDEX idx_questions_repository_id ON questions(repository_id);
CREATE INDEX idx_questions_user_id ON questions(user_id);

-- Repositories table
CREATE INDEX idx_repositories_user_id ON repositories(user_id);
CREATE INDEX idx_repositories_status ON repositories(status);
```

**Connection Pooling:**
- Min pool size: 5
- Max pool size: 20
- Max overflow: 10

---

## Vector Database Optimization

**Qdrant Collection Configuration:**
```json
{
  "vectors": {
    "size": 768,
    "distance": "Cosine"
  },
  "sparse_vectors": {
    "index": {
      "on_disk": true
    }
  },
  "payloads": {
    "repository_id": "integer",
    "chunk_type": "keyword",
    "language": "keyword",
    "file_path": "text"
  }
}
```

**Payload Indexing:**
- `repository_id` — indexed (filter on every search)
- `chunk_type` — indexed (optional filter)
- `language` — indexed (optional filter)

**Search Optimization:**
- Prefetch: 20 results per vector + 20 results per keyword
- Top-K: 10 results after RRF
- Batch search: 8 concurrent queries per search request (if needed)

---

## Query Performance Targets

| Operation | Target | Notes |
|---|---|---|
| Search (Qdrant hybrid) | < 500ms | includes retrieval + ranking |
| LLM generation (Gemini) | < 3s | includes API latency |
| Total Q&A response | < 5s | search + generation |
| Dashboard load | < 1s | all 4 panels from single DB query |
| Repo list load | < 500ms | max 10 repos |

---

## Asynchronous Processing

**FastAPI Background Tasks:**
- Ingestion runs async via `BackgroundTasks`
- Job status polled by frontend
- No blocking endpoints

**Database Queries:**
- All async (asyncpg driver)
- Connection pooling active
- Query timeouts: 30 seconds

---

# 15. Monitoring & Observability

## Logging Strategy

**Log Levels:**
- `INFO` — ingestion milestones, API requests (method, path, status, duration)
- `WARNING` — transient API failures, retries, cache misses
- `ERROR` — ingestion failures, database errors, service unavailability
- `CRITICAL` — circuit breaker open, data corruption detected

**Log Format (JSON):**
```json
{
  "timestamp": "2026-06-03T10:30:45.123Z",
  "level": "INFO",
  "service": "codeatlas_backend",
  "event": "ingestion_complete",
  "job_id": "uuid",
  "repository_id": "uuid",
  "duration_seconds": 240,
  "chunk_count": 1250
}
```

**Excluded from Logs:**
- JWT tokens, API keys, GitHub access tokens
- User email addresses
- Full chunk text (only summary)
- Question content (only question_id)

**Log Destination:**
- Development: stdout (printed to console)
- Production: CloudWatch (AWS) or similar centralized log service

---

## Metrics & Monitoring

**Key Metrics (emit every 60 seconds):**

```
codeatlas.ingestion.duration_seconds (histogram)
  Tags: status (success|failed), language_tier

codeatlas.ingestion.chunks_created (counter)
  Tags: repository_name

codeatlas.api.request_duration_seconds (histogram)
  Tags: method, path, status_code

codeatlas.api.request_count (counter)
  Tags: method, path, status_code

codeatlas.query.response_time_seconds (histogram)
  Tags: repository_id, cached (yes|no)

codeatlas.embedding_api.calls (counter)
  Tags: status (success|failed), error_type

codeatlas.qdrant.search_latency_ms (histogram)
  Tags: query_type (vector|keyword|hybrid)

codeatlas.database.query_time_ms (histogram)
  Tags: query_type

codeatlas.cache.hit_rate (gauge)
  Tags: cache_type (summary|onboarding|query)

codeatlas.users.active (gauge)
  No tags
```

**Monitoring Dashboard (e.g., Grafana):**
- Ingestion success/failure rate
- Average Q&A response time (p50, p95, p99)
- API error rate by endpoint
- Vector DB latency
- Cache hit rates
- Active users

---

## Error Tracking

**Tool: Sentry (optional MVP, required V1):**
- Capture all exceptions
- Group by error type
- Track error trends
- Alert on new error types

**Sentry Tags:**
- `service`: backend/frontend
- `environment`: dev/prod
- `user_id`: for debugging user-specific issues
- `repository_id`: for debugging repo-specific issues

**What NOT to send to Sentry:**
- User questions/answers
- API keys
- Tokens
- File content

---

## Alerting Rules

| Condition | Severity | Action |
|---|---|---|
| Ingestion success rate < 80% (per hour) | Critical | Page oncall |
| Qdrant unavailable for > 5 min | Critical | Page oncall |
| Gemini API error rate > 10% | Warning | Slack notification |
| Database connection pool exhausted | Critical | Page oncall |
| Disk space < 10% on EC2 | Warning | Slack notification |
| JWT secret compromised (detected) | Critical | Page oncall + rotate secret |

---

# 16. Edge Cases & Limitations

## Repository Constraints

**Unsupported Repository Types:**
- Monorepos with > 5 top-level workspaces (e.g., Nx monorepo with 20 apps) — reject with message "Repo too complex"
- Repos with circular import dependencies — allowed, NetworkX detects and reports
- Repos with no code files (only docs) — allowed, but endpoints/summary may be empty
- Repos with binary files masquerading as text — detect BOM, reject file

**Large Files:**
- Files > 10MB — skip (log warning)
- Files > 1MB but < 10MB — parse but emit single "raw" chunk
- Reason: to prevent parsing memory overload

---

## File & Encoding Issues

**Unsupported Encodings:**
- UTF-16, UTF-32 — skip file
- Binary with UTF-8 BOM — attempt parse, fallback to skip if fails
- Mixed encodings within file — parse as UTF-8, replace invalid chars with `?`

**File Edge Cases:**
- Empty files — create zero chunks (no index entry)
- Very long lines (> 10k chars) — split on 10k boundary
- Files with no newlines — treat as single chunk
- Symlinks — follow once, detect cycles, skip if circular

---

## Code Parsing Edge Cases

**Tree-sitter Limitations:**
- Syntax errors in source file — parse as much as possible, log warning
- Incomplete/partial code — parse successfully (Tree-sitter is lenient)
- Dynamically generated code — not parsed (acceptable limitation)

**Language-Specific:**
- Python: `__init__.py` with no classes/functions — treated as module, single raw chunk
- JavaScript: arrow functions in object literals — detected correctly
- Java: inner classes and anonymous classes — parse correctly, nested in class tree
- Go: `package main` files — detected correctly
- TypeScript: `.d.ts` files — parsed correctly, chunk_type="type_definition"

---

## Dependency Graph Edge Cases

**Multiple imports of same file:**
```python
from utils import helper
from utils import helper as h  # different import, same file
```
→ Deduplicate: single edge `current_file → utils.py`

**Relative imports:**
```python
from ..utils import helper
from . import sibling
from ...parent import module
```
→ Resolve to absolute repo paths, filter out stdlib

**Circular dependencies:**
```
A → B → C → A
```
→ Allowed, detected, reported to user in dependencies list

**Unused imports:**
→ Included in dependency graph (actual import tracked, not usage)

---

## Architectural Role Detection Edge Cases

**Multi-role classes:**
```python
class UserService(BaseService, Repository):
    pass
```
→ Detect first matching suffix: `Service` → tag as "service"

**No matching suffix:**
→ Tag as "utility"

---

## Question & Answer Edge Cases

**Very long questions (> 1000 chars):**
- Reject with 400 Bad Request

**Non-English questions:**
→ Allowed, Gemini handles multilingual queries

**Questions with code snippets:**
```
How does the function below work?
def foo():
    pass
```
→ Treat as regular text, include code in context for Gemini

**Questions with no matching context:**
→ Gemini returns "I couldn't find relevant context in this repository" (handled gracefully)

---

## Demo Mode Limitations

**Preloaded fastapi/fastapi repo:**
- Locked to read-only (no delete, no question spam)
- Question rate limit: 30 queries per hour per IP
- Reset every 24 hours

---

# 17. Data Management & Compliance

## Data Retention Policy

| Data Type | Retention | Deletion | Reason |
|---|---|---|---|
| User account | Indefinite | On user deletion request | OAuth identity |
| Repository index | Until deleted by user | On user request | User controls lifespan |
| Questions/Answers | 1 year | Auto-delete | Reduce storage, user can delete manually |
| Ingestion jobs (failed) | 30 days | Auto-delete | Log archival |
| API access logs | 90 days | Auto-delete | Security/compliance audit |
| Error logs | 90 days | Auto-delete | Debugging history |

---

## User Data Deletion (GDPR)

**DELETE /users/me request:**
1. Verify JWT ownership
2. Delete user record
3. Delete all repositories owned by user
4. Delete all questions/answers for user
5. Delete all ingestion jobs for user
6. Remove from Qdrant (filter by all `repository_id` values)
7. Return 204 success

**Processing time:** < 5 minutes for typical user (< 100 repos)

---

## Backup & Recovery

**PostgreSQL:**
- Neon handles automatic daily backups (retention: 7 days)
- Manual backup on deployment (via Alembic migration snapshot)
- Recovery RTO: 1 hour (restore from backup, replay transactions)

**Qdrant:**
- Qdrant Cloud handles snapshots (3 snapshots retained)
- Recovery: restore from latest snapshot

**Data Integrity Checks:**
- Weekly: validate chunk count in DB matches Qdrant
- Weekly: validate file count matches disk

---

## PII and Sensitive Data

**What is stored:**
- GitHub ID, username, email — all public info from GitHub profile
- Question content — user-generated, not PII
- Repository metadata — all public from GitHub

**What is NOT stored:**
- GitHub access tokens (MVP)
- User passwords
- Credit card or billing info
- Private repo content (MVP)

---

## Compliance & Standards

**GDPR Readiness:**
- User deletion implemented (right to be forgotten)
- Data portability: not implemented (V2)
- Consent: users implicitly consent by using service (terms of service required)

**SOC 2 (Future):**
- Logging and monitoring (in progress)
- Access controls (GitHub OAuth sufficient)
- Data encryption (in transit: HTTPS, at rest: TBD)

---

# 18. Frontend Architecture

## State Management

**Choice: React Context API (MVP)**
- Rationale: sufficient for MVP scope, no external deps
- Future: migrate to Zustand or Redux if complexity grows

**Context Structure:**
```
AuthContext
  ├── user: {id, github_username, email} | null
  ├── login(): void
  ├── logout(): void
  └── isAuthenticated: boolean

RepoContext
  ├── currentRepo: Repository | null
  ├── repositories: Repository[]
  ├── loading: boolean
  ├── error: string | null
  ├── selectRepo(repo_id): void
  ├── fetchRepos(): void
  └── deleteRepo(repo_id): void

QueryContext
  ├── currentAnswer: Answer | null
  ├── loading: boolean
  ├── submitQuery(repo_id, question): void
  └── clearAnswer(): void
```

---

## Component Structure

**Pages:**
```
App.tsx
├── LandingPage
├── DashboardPage
└── CallbackPage
```

**Layout Components:**
```
Layout.tsx
├── Header (logo, user menu, logout)
└── Main content area
```

**Feature Components:**
```
RepoSummaryCard.tsx
OnboardingGuide.tsx
ApiEndpointsList.tsx
DependencyList.tsx
IngestionProgress.tsx
QAInput.tsx
AnswerCard.tsx
SourceCitations.tsx
RepoSelector.tsx
```

**Shared Components:**
```
Button.tsx
Input.tsx
Card.tsx
Modal.tsx
LoadingSpinner.tsx
ErrorAlert.tsx
Badge.tsx
Tabs.tsx
```

---

## Component Testing Strategy

**Vitest + React Testing Library:**
- Unit tests: each component tested in isolation
- Mock API calls via `vi.mock()`
- Coverage target: 70% for shared components, 50% for pages
- Snapshot tests: sparingly (markup-heavy components only)

**Test Categories:**
1. **Rendering** — component renders without crash
2. **User Interaction** — button clicks, form submissions
3. **API Integration** — loading/error states
4. **Accessibility** — ARIA labels, keyboard navigation

---

## Styling Approach

**Tailwind CSS:**
- Utility-first (no custom CSS for MVP)
- Color palette: consistent with design system (or default Tailwind)
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Dark mode: not in MVP

**CSS File Structure:**
```
src/styles/
├── tailwind.config.js
├── globals.css      # Tailwind imports + global resets
└── theme.css        # custom color extensions (minimal)
```

---

## Accessibility (WCAG 2.1 Level AA)

**Required:**
- All buttons must have visible focus state
- Form inputs must have associated labels
- Alt text on images (if any)
- Color contrast ≥ 4.5:1 for text
- Keyboard navigation: Tab through all interactive elements
- Semantic HTML: `<button>` not `<div onclick>`
- ARIA labels on non-semantic interactive elements

**Testing:**
- Manual keyboard navigation (Tab, Enter, Escape)
- Chrome DevTools Lighthouse audit
- axe DevTools browser extension

---

## Mobile Responsiveness

**Breakpoints:**
- Mobile: < 640px (primary focus for MVP)
- Tablet: 640–1024px
- Desktop: > 1024px

**Key Requirements:**
- Single-column layout on mobile
- Touch-friendly buttons: min 44px × 44px
- Readable text: min 16px font size
- No horizontal scroll

**Testing:**
- Chrome DevTools device emulation
- Real device testing (iPhone, Android)

---

## Browser Compatibility

**Minimum Requirements (MVP):**
- Chrome/Edge: last 2 versions
- Firefox: last 2 versions
- Safari: last 2 versions
- Mobile: iOS Safari 14+, Chrome Android last 2 versions

**Do NOT support:**
- Internet Explorer
- Edge < 90
- Older mobile browsers

---

## Internationalization (i18n)

**MVP:** English only
**V2:** Plan for i18next (lazy load translations)

---

# 19. Testing Strategy

## Unit Testing

**Backend (pytest):**
```
tests/
├── unit/
│   ├── test_parsers/
│   │   ├── test_python_parser.py
│   │   ├── test_js_parser.py
│   │   ├── test_java_parser.py
│   │   └── test_fallback_parser.py
│   ├── test_file_filter.py
│   ├── test_embedder.py
│   ├── test_retriever.py
│   ├── test_qa.py
│   ├── test_models.py
│   └── test_config.py
```

**Coverage:**
- Parsers: 85% (critical parsing logic)
- Services: 70% (ingestion, query)
- Models/schemas: 90% (data contracts)
- Utilities: 80% (filters, helpers)

**Excluded from coverage:**
- Config files (pydantic-settings)
- Database migrations
- FastAPI route handlers (covered by integration tests)

---

**Frontend (Vitest + React Testing Library):**
```
tests/
├── unit/
│   ├── hooks/
│   │   └── test_useRepos.ts
│   └── utils/
│       └── test_api.ts
├── components/
│   ├── test_Button.tsx
│   ├── test_AnswerCard.tsx
│   └── test_RepoSelector.tsx
```

**Coverage:**
- Components: 50%+ (focus on logic-heavy ones)
- Hooks: 70%+
- Utils: 90%+

---

## Integration Testing

**Backend (pytest with test database):**
```
tests/
├── integration/
│   ├── test_auth_flow.py       # OAuth callback → user creation
│   ├── test_ingestion_pipeline.py  # clone → parse → embed → store
│   ├── test_query_pipeline.py   # search → LLM → response
│   ├── test_rate_limiting.py
│   ├── test_dependency_graph.py
│   └── test_api_endpoints.py
```

**Setup:**
- Use Docker Compose with test PostgreSQL + test Qdrant
- Mock external APIs (Google, GitHub) with `responses` library
- Database: rollback after each test (pytest fixtures)

**Coverage:**
- Critical paths: 100% (auth, ingestion, query, rate limiting)
- Happy path flows: 80%+
- Error scenarios: 60%+

---

**Frontend (React Testing Library):**
```
tests/
├── integration/
│   ├── test_auth_flow.tsx       # login → redirect → dashboard
│   ├── test_repo_ingestion.tsx  # submit URL → progress → dashboard
│   └── test_qa_flow.tsx         # ask question → show answer
```

**Mocking:**
- `vi.mock()` for API calls
- Mock context values (`vi.mock('../context/AuthContext')`)

---

## End-to-End Testing (E2E)

**Tool: Playwright or Cypress (optional MVP, required V1)**

**Critical User Journeys:**
1. Sign up → view preloaded repo → ask question
2. Sign in → submit new repo URL → wait for ingestion → ask question
3. View repo list → delete repo → add new repo
4. Hit rate limit → see error → wait and retry

**Setup:**
- Staging environment (full deployment)
- Run E2E tests after integration tests pass
- Screenshot/video on failure

---

## Performance Testing

**Backend:**
- Load test: 10 concurrent users, 5 repos, 10 queries each
- Tool: `locust` or Apache JMeter
- Target: < 5s response time at p95

**Frontend:**
- Lighthouse audit: Performance > 80
- Bundle size: < 300KB gzipped
- Time to interactive: < 2s on 4G

---

## Test Data & Fixtures

**Backend:**
- `conftest.py` — shared fixtures for test DB, test users, test repos
- Pre-seeded test repos: fastapi/fastapi (mini version), expressjs/express (mini)
- Fixtures: `test_db_session`, `test_user`, `test_repo`, `test_chunks`

**Frontend:**
- Mock data: repos, answers, ingestion jobs in `src/test/fixtures/`
- MSW (Mock Service Worker) for API mocking (optional V1)

---

## CI/CD Integration

**GitHub Actions Workflow:**

```yaml
name: Tests
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: 3.11
      - run: pip install -r backend/requirements.txt
      - run: pytest backend/tests/unit --cov --cov-report=xml
      - run: pytest backend/tests/integration --timeout=30
      - uses: codecov/codecov-action@v3

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci --prefix frontend
      - run: npm run lint --prefix frontend
      - run: npm run test:unit --prefix frontend
      - run: npm run build --prefix frontend
```

---

## Testing Checklist Before Release

- [ ] All unit tests pass (backend + frontend)
- [ ] Integration tests pass with real DB
- [ ] Coverage > 70% for critical paths
- [ ] Linting passes (pylint, eslint)
- [ ] Type checking passes (mypy for Python, tsc for TS)
- [ ] Bundle size < 300KB
- [ ] Lighthouse score > 80
- [ ] Manual smoke test on staging
- [ ] E2E tests pass (if applicable)

---

# 20. Documentation Standards

## API Documentation

**Tool: OpenAPI / Swagger (auto-generated)**

**FastAPI Configuration:**
```python
app = FastAPI(
    title="CodeAtlas API",
    description="AI-powered repository intelligence platform",
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/api/docs",     # Swagger UI at /api/docs
    redoc_url="/api/redoc"    # ReDoc at /api/redoc
)
```

**Endpoint Documentation (auto-extracted from docstrings):**
```python
@app.post("/repos/ingest")
async def ingest_repo(request: IngestRepoRequest) -> IngestRepoResponse:
    """
    Submit a GitHub repository for ingestion.
    
    - **github_url**: Full URL to public GitHub repository
    - Returns: Job ID for polling ingestion status
    """
```

---

## Code Documentation

**Backend (Python):**
- Docstrings: Google style (3-line module docstring, per-function docstring)
- Example:
```python
def extract_endpoints(file_path: str) -> List[Endpoint]:
    """Extract HTTP endpoints from a Python source file using Tree-sitter.
    
    Args:
        file_path: Absolute path to .py file
        
    Returns:
        List of detected endpoints with method, path, and line number
    """
```

- Avoid over-documentation: If the function name and types are clear, skip docstring
- Comments: only for WHY (not WHAT)

**Frontend (TypeScript):**
- TSDoc style (similar to JSDoc)
- Example:
```typescript
/**
 * Fetches ingestion status and updates component state.
 * @param jobId - UUID of the ingestion job
 * @returns Promise resolving to IngestionStatus
 */
async function checkIngestionStatus(jobId: string): Promise<IngestionStatus>
```

---

## Architecture Decision Records (ADRs)

**Format: Standard ADR format**

Store in `docs/adr/` directory.

**Template:**
```markdown
# ADR-001: Use Qdrant for Vector Storage

**Date:** 2026-06-03
**Status:** Accepted
**Context:** Need fast semantic search over code chunks.
**Decision:** Use Qdrant for vector + keyword search.
**Consequences:** 
  - Pros: Free tier, built-in BM25, easy self-hosting
  - Cons: Limited scale compared to Weaviate

**Alternatives Considered:**
  - Weaviate (more expensive)
  - Milvus (harder to deploy)
  - Pinecone (proprietary, $$$)
```

---

## Deployment Runbook

**File: `docs/DEPLOYMENT.md`**

**Contents:**
1. Prerequisite services (Neon, Qdrant Cloud, Vercel, Railway accounts)
2. Environment setup (env vars, secrets)
3. Database initialization (Alembic migrations)
4. Pre-index demo repo (fastapi/fastapi)
5. Health checks
6. Rollback procedure
7. Common troubleshooting

---

## Developer Onboarding

**File: `docs/CONTRIBUTING.md`**

**Sections:**
1. Local development setup (Docker Compose, Python venv, Node)
2. Running tests
3. Code style guide (Black, Prettier)
4. Git workflow (branches, commit messages)
5. How to add a new language parser
6. How to debug ingestion failures

---

## README Structure

**Root README.md:**
- 1-line description
- Key features
- Quick start (Docker Compose)
- Demo links
- Architecture diagram
- Tech stack
- Contributing
- License

**backend/README.md:**
- How to run tests
- How to add new dependencies
- Environment variables
- Key modules

**frontend/README.md:**
- How to run locally
- How to build for production
- Component structure
- Styling guidelines

---

## Inline Code Comments

**Rule: Comment WHY, not WHAT**

**Bad:**
```python
# Loop through all chunks
for chunk in chunks:
    # Add chunk to list
    processed.append(chunk)
```

**Good:**
```python
# Filter to top-K chunks by similarity score (RRF ranking)
for chunk in chunks[:10]:
    processed.append(chunk)
```

---

## Type Hints & Documentation

**Python:**
- All function signatures must have type hints
- Use `Optional[T]` for nullable types
- Use `List[T]`, `Dict[K, V]` from typing module

**TypeScript:**
- All function signatures must have return types
- Use `type` or `interface` for objects (prefer `interface` for contracts)
- Use `unknown` if type is truly dynamic

---

# 21. Deployment & DevOps

## Container Strategy

**Docker Images:**

**Backend:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend:**
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY frontend/package*.json .
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM node:18-alpine

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "preview"]
```

---

## Docker Compose (Development)

**File: `docker-compose.yml`**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: codeatlas
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: codeatlas_dev
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U codeatlas"]
      interval: 10s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://codeatlas:dev_password@postgres:5432/codeatlas_dev
      QDRANT_URL: http://qdrant:6333
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      JWT_SECRET: dev_secret_key_change_in_prod
    depends_on:
      postgres:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --reload

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:8000
    depends_on:
      - backend
    command: npm run dev
```

---

## Environment Variables

**Backend (.env.example):**
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/codeatlas
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=  # only for Qdrant Cloud
GOOGLE_API_KEY=your_google_ai_api_key
GITHUB_CLIENT_ID=your_github_oauth_app_id
GITHUB_CLIENT_SECRET=your_github_oauth_secret
JWT_SECRET=a_very_long_random_string_at_least_32_chars
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=INFO
```

**Frontend (.env.example):**
```
VITE_API_URL=http://localhost:8000
VITE_GITHUB_CLIENT_ID=your_github_oauth_app_id
```

**Validation on Startup:**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    QDRANT_URL: str
    GOOGLE_API_KEY: str
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    JWT_SECRET: str
    FRONTEND_URL: str
    
    class Config:
        env_file = ".env"

settings = Settings()  # Raises ValueError if any var missing
```

---

## Database Migrations (Alembic)

**Workflow:**
1. Create model change in `models/db/`
2. Auto-generate migration: `alembic revision --autogenerate -m "add_column_x"`
3. Review generated SQL in `alembic/versions/`
4. Test: `alembic upgrade head`
5. Commit migration + model change
6. Production: `alembic upgrade head` before deploying new code

**Migration Example:**
```sql
-- alembic/versions/001_init.py
def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.UUID, primary_key=True),
        sa.Column('github_id', sa.Integer, unique=True),
        sa.Column('github_username', sa.String, nullable=False)
    )

def downgrade():
    op.drop_table('users')
```

---

## Production Deployment Services

| Layer | Service | Configuration |
|---|---|---|
| Frontend | Vercel | Auto-deploy on git push, env vars via dashboard |
| Backend API | Railway | Docker deploy from `backend/Dockerfile`, 2+ replicas |
| PostgreSQL | Neon | Serverless Postgres, auto-backup, SSL enforced |
| Vector DB | Qdrant Cloud | Free tier (1GB), or self-hosted on Railway |
| Monitoring | CloudWatch | Log aggregation, dashboards |

---

## Deployment Checklist

- [ ] All environment variables set in production
- [ ] Database migrations run (`alembic upgrade head`)
- [ ] Pre-index demo repo (fastapi/fastapi)
- [ ] Health check passes (`GET /health`)
- [ ] Smoke test: OAuth login → dashboard → ask question
- [ ] Rate limiting verified
- [ ] Logging to CloudWatch verified
- [ ] Alerts configured (Slack or PagerDuty)
- [ ] Rollback plan documented and tested
- [ ] Secrets rotated (JWT_SECRET, GOOGLE_API_KEY)

---

## Rollback Strategy

**If Critical Bug Detected:**
1. Revert code: `git revert <commit_hash>`
2. Push to main branch
3. Vercel auto-deploys frontend (< 2 min)
4. Railway re-deploys backend (< 5 min)
5. Health checks validate both services
6. If DB migration incompatible: manual rollback via Neon dashboard

**Zero-Downtime Deployment (V2):**
- Blue-green deployment strategy
- Canary deployments (10% traffic first)
- Database migrations backward-compatible

---

## Scaling Considerations (V2+)

**Bottlenecks to Monitor:**
- Embedding API rate limit (1,500 req/min) → queue with backoff
- Gemini API rate limit (60 req/min) → queue with backoff
- PostgreSQL connection pool (max 20) → scale connections
- Qdrant vector DB (1GB free) → upgrade to paid or self-host

**Scaling Strategies:**
- Embed batch requests (already implemented)
- Qdrant self-hosting on Kubernetes
- PostgreSQL replicas for read queries
- Redis for caching (in-memory dict → Redis)
- Multiple backend replicas behind load balancer

---



* GitHub OAuth login
* Repository ingestion with size guard
* Repository parsing (Tree-sitter, function/class chunking)
* Embeddings (Nomic Embed) + Qdrant storage
* Hybrid search (vector + BM25)
* Q&A with full explanation + citations
* Auto-generated Repository Summary
* Auto-generated Onboarding Guide
* API endpoint discovery (Tree-sitter)
* File dependency list (NetworkX)
* Per-user repo limits (3 repos, 100k chunks, 3/day)

---

# 12. V2 Milestone

* Dependency graph visualization (React Flow)
* Impact analysis ("what breaks if X changes?")
* Private repository support (via stored GitHub OAuth token)
* Incremental re-indexing (diff-based, not full wipe)
* Repository health insights (largest modules, most coupled files)
* Chat history / multi-turn Q&A

---

# 13. Demo Strategy

## Preloaded Repository

One repository is pre-indexed before any live demo:

**fastapi/fastapi** — chosen because:
* Clean Python codebase, well-structured
* Universally recognized by interviewers and developers
* Rich enough to produce impressive Q&A answers and a meaningful onboarding guide

When the demo site loads, this repo is already available — no waiting, instant dashboard.

## Two Demo Modes

### Mode 1 — Instant Demo (default)

Click the preloaded fastapi/fastapi repo on the landing page.

Dashboard appears immediately with:
* Repository Summary card
* Start Here onboarding guide
* Discovered API endpoints
* File dependency list

Ask a question → answer + citations in < 5 seconds.

Use this to show the core value proposition without any setup time.

---

### Mode 2 — Live Ingestion Demo (on request)

Submit a new GitHub URL to show the full ingestion pipeline live.

Flow:
```
Paste GitHub URL → Submit
        ↓
Progress indicator: Cloning... Parsing... Embedding... Indexing...
        ↓
Dashboard populates automatically on completion
```

Use this when the audience wants to see the system work end-to-end on a real repo.
Suggested repo to use live: **expressjs/express** (small, fast to index, ~2 minutes).

## Suggested Demo Script

1. Open the site — preloaded fastapi/fastapi dashboard is visible
2. Show the Repository Summary and Onboarding Guide (auto-generated, no user input)
3. Show the API endpoint list and file dependency list
4. Ask: *"How does authentication work?"* — show the explanation + citations
5. Ask: *"Where should a new developer start?"* — show the onboarding answer
6. (Optional) Submit expressjs/express URL — show the live ingestion progress bar
7. Once indexed, repeat a question on the new repo

---

# 14. Implementation Plan

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Repository layout | Monorepo (`backend/` + `frontend/`) | Single git history, simpler solo deployment |
| Async ingestion | FastAPI BackgroundTasks + DB polling | Zero extra infrastructure, sufficient for MVP concurrency |
| Local dev infra | Docker Compose | One command spins up everything, no cloud accounts needed during dev |
| LLM | Gemini API | Large context window, generous free tier |
| Embeddings | Google text-embedding-004 | Same Google AI Studio key as Gemini, no model weights on server |
| Auth | GitHub OAuth (Authlib) | Perfect fit for a GitHub-focused tool, sets up private repo support for V2 |

---

## Project Structure

```
codeatlas/
├── backend/
│   ├── app/
│   │   ├── main.py                        # FastAPI app init, router registration
│   │   ├── api/routes/
│   │   │   ├── auth.py                    # GitHub OAuth login/callback
│   │   │   ├── repos.py                   # ingest, list, delete repos
│   │   │   ├── query.py                   # Q&A endpoint
│   │   │   └── status.py                  # ingestion job polling
│   │   ├── core/
│   │   │   ├── config.py                  # pydantic-settings, env vars
│   │   │   ├── database.py                # SQLAlchemy async engine + session
│   │   │   └── qdrant.py                  # Qdrant async client singleton
│   │   ├── models/
│   │   │   ├── db/                        # SQLAlchemy ORM models
│   │   │   │   ├── user.py
│   │   │   │   ├── repository.py
│   │   │   │   ├── file.py
│   │   │   │   ├── chunk.py
│   │   │   │   ├── question.py
│   │   │   │   └── ingestion_job.py
│   │   │   └── schemas/                   # Pydantic request/response schemas
│   │   └── services/
│   │       ├── ingestion/
│   │       │   ├── pipeline.py            # orchestrator — called by BackgroundTasks
│   │       │   ├── cloner.py              # GitPython clone → temp dir, size guard
│   │       │   ├── file_filter.py         # skip list, language detection
│   │       │   ├── parser.py              # dispatches to correct language parser
│   │       │   ├── parsers/
│   │       │   │   ├── python_parser.py
│   │       │   │   ├── js_parser.py       # handles .js and .jsx
│   │       │   │   ├── ts_parser.py       # handles .ts and .tsx
│   │       │   │   ├── java_parser.py
│   │       │   │   ├── go_parser.py
│   │       │   │   └── fallback_parser.py # line-count chunking for Tier 2
│   │       │   └── embedder.py            # Google text-embedding-004 batch calls
│   │       ├── search/
│   │       │   └── retriever.py           # Qdrant hybrid search (dense + BM25)
│   │       ├── generation/
│   │       │   ├── qa.py                  # retrieve → Gemini → format with citations
│   │       │   ├── summarizer.py          # repo summary generation
│   │       │   └── onboarding.py          # onboarding guide generation
│   │       └── analysis/
│   │           ├── api_extractor.py       # Tree-sitter route/decorator extraction
│   │           └── dependency_graph.py    # NetworkX import graph → adjacency list
│   ├── alembic/                           # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── CallbackPage.tsx           # GitHub OAuth redirect handler
│   │   ├── components/
│   │   │   ├── RepoSummaryCard.tsx
│   │   │   ├── OnboardingGuide.tsx
│   │   │   ├── ApiEndpointsList.tsx
│   │   │   ├── DependencyList.tsx
│   │   │   ├── IngestionProgress.tsx
│   │   │   ├── QAInput.tsx
│   │   │   ├── AnswerCard.tsx
│   │   │   └── SourceCitations.tsx
│   │   ├── hooks/
│   │   │   ├── useIngestionStatus.ts      # polls /status/{job_id} every 2s
│   │   │   └── useRepos.ts
│   │   └── api/client.ts                  # axios instance, typed API calls
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## Phase 1 — Foundation (Days 1–3)

**Goal:** Running skeleton with auth, DB, and Docker Compose. Nothing impressive yet — just solid plumbing.

### Docker Compose Services

| Service | Image | Port |
|---|---|---|
| `postgres` | postgres:16 | 5432 |
| `qdrant` | qdrant/qdrant | 6333 |
| `backend` | local build | 8000 (hot reload) |
| `frontend` | local build | 3000 (hot reload) |

### Database Schema

```
users:          id, github_id, github_username, email,
                repos_analyzed_today, last_reset_at

repositories:   id, user_id, github_url, name, status, chunk_count,
                summary_json, onboarding_json, api_endpoints_json,
                dependency_json, created_at

files:          id, repository_id, path, language, language_tier

chunks:         id, repository_id, file_id, chunk_text, chunk_type,
                architectural_role, function_name, class_name,
                line_start, line_end, qdrant_point_id

questions:      id, repository_id, user_id, question, answer,
                source_chunk_ids, created_at

ingestion_jobs: id, repository_id, status, progress_message,
                progress_pct, error, created_at, updated_at
```

### Qdrant Collection: `code_chunks`

Single global collection — all repos share it, filtered by `repository_id` payload field.

- Dense vector: 768 dims, cosine distance (Google text-embedding-004)
- Sparse vector: BM25 keyword search (Qdrant built-in)
- Indexed payload fields: `repository_id`, `chunk_type`, `language`, `file_path`

### GitHub OAuth Flow

```
GET /auth/login      → redirect to GitHub OAuth consent screen
GET /auth/callback   → exchange code for token, upsert user in DB,
                       return JWT stored in httpOnly cookie
```

Library: Authlib + python-jose for JWT signing.

---

## Phase 2 — Ingestion Pipeline (Days 4–8)

**Goal:** Submit a GitHub URL → all chunks stored in Qdrant + PostgreSQL.

### Ingestion Endpoint

`POST /repos/ingest`
1. Validate user limits (3 repos stored, 3/day, 100k total chunks)
2. Create `ingestion_job` record with `status=pending`
3. Fire `pipeline.run(job_id, github_url)` via `BackgroundTasks`
4. Return `{job_id}` immediately

### `cloner.py`

- Shallow clone (`depth=1`) to `/tmp/codeatlas/{job_id}/` using GitPython
- Count all files after clone — if > 10,000, delete and fail the job
- Always clean up temp directory in a `finally` block

### `file_filter.py`

Skip list — directories:
`node_modules`, `vendor`, `.git`, `dist`, `build`, `__pycache__`, `migrations`

Skip list — file patterns:
`*.min.js`, `*.min.css`, `*-lock.json`, `*.lock`, `*.pb.go`, `*_generated.go`

Skip list — binary extensions:
`.png`, `.jpg`, `.pdf`, `.exe`, `.zip`, `.woff`, `.ttf`, etc.

Language tier map (extension → language, tier):

| Extension | Language | Tier |
|---|---|---|
| `.py` | Python | 1 |
| `.js`, `.jsx` | JavaScript | 1 |
| `.ts`, `.tsx` | TypeScript | 1 |
| `.java` | Java | 1 |
| `.go` | Go | 1 |
| Everything else | raw | 2 |

### Language Parsers (Tree-sitter)

Package: `tree-sitter-languages` (bundles all grammars, no separate installs).

Each Tier 1 parser returns a list of `Chunk` dataclasses with: `chunk_text`, `chunk_type`, `function_name`, `class_name`, `line_start`, `line_end`, `architectural_role`, `imports`.

Language-specific extraction rules:

| Language | Endpoints detected | Architectural role detection |
|---|---|---|
| Python | `@app.get/post/put/delete/patch` decorators | Class name suffixes (Service, Controller, Repository) |
| Java | `@GetMapping`, `@PostMapping`, `@RestController`, `@Service`, `@Repository` | Annotations |
| JavaScript/TS | `router.get/post`, `app.get/post` Express patterns | — |
| Go | `http.HandleFunc`, chi/gin `router.GET/POST` | — |

`fallback_parser.py`: splits file into sequential 100-line chunks, `chunk_type=raw`.

### `embedder.py`

```python
# Google text-embedding-004 via google-generativeai SDK
# Batch size: 100 texts per API call
# task_type="RETRIEVAL_DOCUMENT" during indexing
# task_type="RETRIEVAL_QUERY" at query time
# Model: "models/text-embedding-004" → 768-dim output
```

### `pipeline.py` Orchestration Sequence

```
update_job(status="running", pct=5,  msg="Cloning repository...")
clone_repo()

update_job(pct=15, msg="Filtering files...")
filter_files()

update_job(pct=20, msg="Parsing code...")
parse_all_files()          # dispatches to per-language parsers

update_job(pct=50, msg="Generating embeddings...")
embed_chunks()             # Google API, batched

update_job(pct=75, msg="Storing vectors...")
store_in_qdrant()          # upsert points with payload
store_in_postgres()        # files + chunks records

update_job(pct=85, msg="Building dependency graph...")
build_dependency_graph()   # NetworkX → JSON → repositories.dependency_json

update_job(pct=88, msg="Extracting API endpoints...")
extract_api_endpoints()    # Tree-sitter only → repositories.api_endpoints_json

update_job(pct=92, msg="Generating repository summary...")
generate_summary()         # 1 Gemini call → repositories.summary_json

update_job(pct=96, msg="Generating onboarding guide...")
generate_onboarding()      # 1 Gemini call → repositories.onboarding_json

update_job(status="completed", pct=100)
cleanup_temp_dir()         # always runs, even on failure
```

### Status Polling Endpoint

`GET /repos/ingest/{job_id}/status`

Returns: `{status, progress_pct, progress_message, error}`

Frontend polls every 2 seconds while `status == "running"`.

---

## Phase 3 — Intelligence Layer (Days 9–12)

**Goal:** Q&A with citations, auto-generated dashboard content all working.

### Hybrid Search (`retriever.py`)

Qdrant `prefetch` + `Query` API:
- Dense prefetch: embed query with `task_type="RETRIEVAL_QUERY"`, top-20
- Sparse prefetch: BM25 keyword search, top-20
- RRF fusion → top-10 final results
- Filter applied: `repository_id == current_repo_id`

Returns chunks with full payload: `file_path`, `function_name`, `class_name`, `line_start`, `line_end`, `chunk_type`.

### Q&A Flow (`qa.py`)

```
user_question
  → embed question (RETRIEVAL_QUERY)
  → retriever.search(top_k=8, repo_id=...)
  → build context string:
      "[Source: auth/service.py — authenticate_user(), L42-67]\n<chunk_text>\n\n..."
  → Gemini prompt:
      "You are an expert on the {repo_name} codebase.
       Answer the question using ONLY the provided code context.
       After your explanation, list every source chunk you referenced."
  → parse Gemini response → split explanation from sources section
  → map source references back to chunk metadata
  → return {answer: str, sources: [{file_path, function_name, line_start, line_end}]}
```

### Repo Summary (`summarizer.py`)

Context fed to Gemini: README.md content + top-level directory listing + contents of `package.json` / `requirements.txt` / `pom.xml` (whichever exists).

Prompt requests structured JSON output:
```json
{
  "purpose": "...",
  "stack": ["Python", "FastAPI", "PostgreSQL"],
  "architecture": "...",
  "entry_points": ["main.py", "app/routes/"]
}
```

Stored in `repositories.summary_json`. Generated once at ingestion, never re-generated unless repo is re-indexed.

### Onboarding Guide (`onboarding.py`)

Context: repo summary JSON + list of all parsed files with their detected chunk types and architectural roles.

Prompt requests ordered guide:
```json
{
  "steps": [
    {"order": 1, "title": "Start with the entry point", "files": ["main.py"], "description": "..."},
    ...
  ],
  "core_workflows": ["..."],
  "learning_path": "..."
}
```

### API Endpoint Extraction (`api_extractor.py`)

Pure Tree-sitter traversal, no LLM. Detects route definitions per language (see parser table above).

Output stored as JSON: `[{method, path, file_path, function_name, line}]`

### File Dependency List (`dependency_graph.py`)

Import statements are collected during parsing (Phase 2) per file.
After all files parsed:

1. Build `networkx.DiGraph` — edge: `file_a → file_b` means file_a imports file_b
2. Filter: only include edges where `file_b` exists in the repo (drop stdlib/third-party imports)
3. Resolve relative imports to absolute repo paths
4. Serialise adjacency list:

```json
{
  "auth/service.py": {
    "uses": ["db/models.py", "utils/hash.py"],
    "used_by": ["routes/auth.py", "middleware/jwt.py"]
  }
}
```

Stored in `repositories.dependency_json`.

---

## Phase 4 — Frontend (Days 13–17)

**Goal:** Complete UI — landing, OAuth, ingestion progress, dashboard, Q&A.

### Landing Page

- App name + one-line description
- "Sign in with GitHub" CTA → `GET /auth/login`
- Preloaded demo card: "Try instantly →  fastapi/fastapi" — links directly to its dashboard without any ingestion wait
- If signed in: user's repo list (max 3 cards) + "Analyze a new repo" URL input

### Ingestion Progress UI

- URL form → `POST /repos/ingest` → receive `job_id`
- Poll `GET /repos/ingest/{job_id}/status` every 2 seconds
- Animated progress bar + current `progress_message` below it
- On `status=completed` → auto-navigate to `/dashboard/{repo_id}`
- On `status=failed` → show error message + retry option

### Dashboard Layout

All four sections populated from a single `GET /repos/{repo_id}` response:

```
┌──────────────────────────────────────────────┐
│  Repository Summary                          │
│  Purpose · Stack · Architecture · Entry pts  │
├──────────────────────────────────────────────┤
│  Start Here Guide                            │
│  Step 1: Read main.py ...                    │
│  Step 2: Understand auth flow ...            │
├──────────────────┬───────────────────────────┤
│  API Endpoints   │  File Dependencies        │
│  GET  /users     │  auth/service.py          │
│  POST /login     │    → uses: db/models.py   │
│  PUT  /users/:id │    → used by: routes/...  │
└──────────────────┴───────────────────────────┘

[ Ask anything about this repository...    ▶ ]
```

### Q&A Interface

- Single text input + submit button below the dashboard
- Answer rendered as Markdown
- Sources section: collapsible chips per citation

```
Sources
  ▸ auth/service.py — authenticate_user()  [L42–67]
  ▸ middleware/jwt.py — verify_token()     [L17–31]
```

- No chat history in MVP — each question is independent

---

## Phase 5 — Deployment + Demo (Days 18–20)

### Service Map

| Layer | Provider | Notes |
|---|---|---|
| Frontend | Vercel | Connect GitHub repo, auto-deploy on push |
| Backend API | Railway | Docker deploy from `backend/Dockerfile` |
| PostgreSQL | Neon | Serverless Postgres, free tier |
| Vector DB | Qdrant Cloud | Free tier (1GB, ~1M vectors) |

### Environment Variables (backend)

```
DATABASE_URL=postgresql+asyncpg://...
QDRANT_URL=https://...qdrant.io
QDRANT_API_KEY=...
GOOGLE_API_KEY=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
JWT_SECRET=...
FRONTEND_URL=https://codeatlas.vercel.app
```

### Pre-index Demo Repo

After first deployment, trigger a one-off ingestion of `https://github.com/fastapi/fastapi` under the demo account. This record must always exist in the live DB so the landing page demo card works instantly.

---

## Key Dependencies

**Backend (`requirements.txt`)**

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
authlib
httpx
gitpython
tree-sitter-languages
networkx
google-generativeai
qdrant-client
pydantic-settings
python-jose[cryptography]
```

**Frontend (`package.json`)**

```
react, react-dom
typescript
vite
tailwindcss
axios
react-router-dom
react-markdown
```

---

## Verification Checklist

1. `docker compose up` → all 4 services healthy, `/health` returns 200
2. GitHub OAuth login → user row created in DB, JWT cookie set
3. Submit `https://github.com/expressjs/express` → progress bar moves through all stages, completes in < 5 min
4. Dashboard loads with all four sections populated (summary, guide, endpoints, dependencies)
5. Ask "How does routing work?" → full explanation + at least 2 source citations returned
6. Attempt to add a 4th repo → UI shows limit warning, ingestion blocked
7. Delete a repo → Qdrant vectors removed (filtered delete by `repository_id`), DB records deleted, slot freed
8. Pre-indexed `fastapi/fastapi` dashboard loads instantly with no ingestion step

---

# 15. Resume Description

Built CodeAtlas, an AI-powered repository intelligence platform that dynamically ingests GitHub repositories, constructs semantic and dependency-aware knowledge bases, and enables architecture understanding, onboarding assistance, and repository-level question answering using RAG, FastAPI, Qdrant, Tree-sitter, and AWS.
