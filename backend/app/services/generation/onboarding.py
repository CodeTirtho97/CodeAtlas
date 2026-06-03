"""Developer onboarding guide generator using Gemini.

Takes the repo summary + file/chunk structure and generates an
ordered step-by-step guide for a developer new to the codebase.
Called once at the end of ingestion, after the summary.
"""
import json
import logging
from collections import Counter
from typing import List, Optional

from google import genai
from google.genai import types as genai_types

from app.core.config import settings
from app.services.ingestion.chunk import Chunk
from app.services.ingestion.file_filter import FileInfo

log = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"

_ONBOARDING_PROMPT = """\
You are creating a developer onboarding guide for the repository: {repo_name}

Repository summary:
{summary}

Key files and their roles:
{file_structure}

Return a JSON object with exactly these fields:

{{
  "steps": [
    {{
      "order": 1,
      "title": "<short title>",
      "files": ["<file1>", "<file2>"],
      "description": "<what to look for and why>"
    }},
    ...
  ],
  "core_workflows": ["<workflow description 1>", "<workflow description 2>"],
  "learning_path": "<1-2 paragraph recommended learning sequence>"
}}

Rules:
- Include 3-6 steps total, ordered from most important to supporting
- Each step should focus on understanding a specific concern (auth, data model, API layer, etc.)
- core_workflows lists 2-4 key flows (e.g. "User login → JWT → protected route")
- learning_path is a short narrative guide

Return ONLY the JSON object with no markdown or extra text.
"""


def generate_onboarding_guide(
    summary: dict,
    files: List[FileInfo],
    chunks: List[Chunk],
) -> dict:
    """Generate a structured developer onboarding guide.

    Uses the summary JSON + file/chunk structure to ask Gemini for
    an ordered learning guide. Falls back to a minimal dict on error.
    """
    repo_name = summary.get("purpose", "this repository")[:80]
    file_structure = _build_file_structure(files, chunks)
    prompt = _ONBOARDING_PROMPT.format(
        repo_name=repo_name,
        summary=json.dumps(summary, indent=2),
        file_structure=file_structure,
    )

    result = _call_gemini(prompt)
    if result:
        return result

    log.warning("Onboarding guide generation failed — using fallback")
    return {
        "steps": [{"order": 1, "title": "Explore the codebase",
                   "files": [], "description": "Start from the entry points."}],
        "core_workflows": [],
        "learning_path": "Explore the project structure to understand the codebase.",
    }


# ─── File Structure Builder ──────────────────────────────────────────────────

def _build_file_structure(files: List[FileInfo], chunks: List[Chunk]) -> str:
    """Build a compact file listing with architectural roles for Gemini context."""

    # Map file_path → set of architectural roles
    file_roles: dict[str, set] = {}
    file_chunk_types: dict[str, Counter] = {}

    for chunk in chunks:
        if chunk.architectural_role:
            file_roles.setdefault(chunk.file_path, set()).add(chunk.architectural_role)
        file_chunk_types.setdefault(chunk.file_path, Counter())[chunk.chunk_type] += 1

    lines = []
    tier1_files = [f for f in files if f.language_tier == "1"]

    # Sort: controllers first, then services, repositories, utility, others
    priority = {"controller": 0, "service": 1, "repository": 2, "utility": 3}

    def sort_key(fi: FileInfo) -> tuple:
        roles = file_roles.get(fi.relative_path, set())
        role_priority = min((priority.get(r, 4) for r in roles), default=4)
        return (role_priority, fi.language, fi.relative_path)

    for fi in sorted(tier1_files, key=sort_key)[:50]:  # cap at 50 files
        path = fi.relative_path
        roles = sorted(file_roles.get(path, set()))
        ctypes = file_chunk_types.get(path, Counter())
        summary_parts = []
        if roles:
            summary_parts.append(f"roles: {', '.join(roles)}")
        if ctypes:
            summary_parts.append(
                ", ".join(f"{n} {t}s" for t, n in ctypes.most_common(3))
            )
        suffix = f"  [{'; '.join(summary_parts)}]" if summary_parts else ""
        lines.append(f"  {path}{suffix}")

    return "\n".join(lines) if lines else "No Tier 1 source files found."


# ─── Gemini Call ─────────────────────────────────────────────────────────────

def _call_gemini(prompt: str) -> Optional[dict]:
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    for attempt in range(1, 4):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            return _parse_json(response.text)
        except Exception as exc:
            log.warning(
                "Gemini onboarding attempt %d/3 failed: %s", attempt, exc
            )

    return None


def _parse_json(text: str) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Could not parse Gemini JSON response: %.200s", text)
        return None
