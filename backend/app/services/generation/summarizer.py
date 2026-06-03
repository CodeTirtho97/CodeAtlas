"""Repository summary generator using Gemini.

Reads README + top-level manifest files from the cloned repo and
asks Gemini to produce a structured JSON summary card.
Called once at the end of ingestion.
"""
import json
import logging
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types as genai_types

from app.core.config import settings

log = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"

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

    result = _call_gemini(prompt)
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


# ─── Gemini Call ─────────────────────────────────────────────────────────────

def _call_gemini(prompt: str) -> Optional[dict]:
    """Call Gemini with retry on failure. Returns parsed dict or None."""
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    for attempt in range(1, 4):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            return _parse_json(response.text)
        except Exception as exc:
            log.warning(
                "Gemini summary attempt %d/3 failed: %s", attempt, exc
            )

    return None


def _parse_json(text: str) -> Optional[dict]:
    """Extract and parse JSON from Gemini response text."""
    if not text:
        return None
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Could not parse Gemini JSON response: %.200s", text)
        return None
