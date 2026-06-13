"""Repository summary generator using Gemini.

Reads README + top-level manifest files from the cloned repo and
asks Gemini to produce a structured JSON summary card.
Called once at the end of ingestion.
"""
import logging
from pathlib import Path
from typing import Optional

from app.services.generation.llm_json import generate_json

log = logging.getLogger(__name__)

# Manifest files that describe the project stack
_MANIFEST_NAMES = [
    "requirements.txt", "pyproject.toml", "Pipfile",
    "package.json",
    "pom.xml", "build.gradle",
    "go.mod",
    "Cargo.toml",
    "Gemfile",
]

_SUMMARY_PROMPT = """\
You are analysing a GitHub repository. Given the content below, return a JSON object with exactly these fields:

{{
  "purpose": "<1-2 sentence description of what the project does>",
  "stack": ["<tech1>", "<tech2>", ...],
  "architecture": "<1-2 sentence description of the high-level architecture>",
  "entry_points": ["<file_or_dir1>", "<file_or_dir2>", ...]
}}

Rules:
- "purpose" must be concise and non-technical enough for any developer
- "stack" should list languages, frameworks, and key infrastructure
- "architecture" describes how the major components relate
- "entry_points" lists the 2-4 most important files/dirs to read first

Repository: {repo_name}

{context}

Return ONLY the JSON object with no markdown, no explanation, no extra text.
"""


def generate_summary(github_url: str, clone_dir: Path) -> dict:
    """Generate a structured repository summary.

    Reads README and manifest files from clone_dir, calls Gemini,
    returns the parsed JSON dict. Falls back to a minimal dict on error.
    """
    repo_name = github_url.rstrip("/").split("/")[-1]
    context = _build_context(clone_dir)
    prompt = _SUMMARY_PROMPT.format(repo_name=repo_name, context=context)

    result = generate_json(prompt, temperature=0.1, label="summary")
    if result:
        return result

    log.warning("Summary generation failed for %s — using fallback", repo_name)
    return {"purpose": repo_name, "stack": [], "architecture": "", "entry_points": []}


# ─── Context Builder ─────────────────────────────────────────────────────────

def _build_context(clone_dir: Path) -> str:
    parts = []

    # README
    readme = _find_readme(clone_dir)
    if readme:
        content = readme.read_text(encoding="utf-8", errors="replace")[:3000]
        parts.append(f"=== README ===\n{content}")

    # Top-level directory listing
    top_level = sorted(
        p.name for p in clone_dir.iterdir()
        if not p.name.startswith(".")
    )
    parts.append(f"=== Top-level files/dirs ===\n{chr(10).join(top_level)}")

    # Manifest files
    for name in _MANIFEST_NAMES:
        path = clone_dir / name
        if path.exists():
            content = path.read_text(encoding="utf-8", errors="replace")[:1000]
            parts.append(f"=== {name} ===\n{content}")

    return "\n\n".join(parts)


def _find_readme(clone_dir: Path) -> Optional[Path]:
    for name in ("README.md", "README.rst", "README.txt", "README", "readme.md"):
        path = clone_dir / name
        if path.exists():
            return path
    return None
