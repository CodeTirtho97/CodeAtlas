FROM python:3.11-slim

# Install uv — fast Python package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install system dependencies (git required by GitPython at runtime)
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Dependency layer (cached unless pyproject.toml changes) ──────────────────
# hatchling validates readme + package dir at build time, so both must exist.
# We copy README.md and create a stub app/ so the editable install succeeds,
# then overwrite with real source code in the next COPY step.
COPY pyproject.toml README.md ./
RUN mkdir -p app && touch app/__init__.py
RUN uv pip install --system -e .

# ── Application code ─────────────────────────────────────────────────────────
# Copied after deps so code changes don't invalidate the pip-install cache.
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
