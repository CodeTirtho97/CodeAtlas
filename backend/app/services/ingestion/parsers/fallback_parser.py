"""Fallback parser for Tier-2 languages and config/doc files.

Splits files into sequential 100-line chunks with no AST analysis.
Applied to: Ruby, Rust, C/C++, PHP, YAML, TOML, JSON, Markdown,
            Dockerfiles, shell scripts, CI configs, and all other
            non-Tier-1 files.
"""
from typing import List

from app.services.ingestion.chunk import Chunk

CHUNK_SIZE = 100  # lines per chunk


# ─── Public API ──────────────────────────────────────────────────────────────

def parse(file_path: str, source: str, language: str = "raw") -> List[Chunk]:
    """Split a file into sequential line-count chunks.

    Args:
        file_path: Relative path in the repo (forward slashes)
        source:    Full file content as a string
        language:  Language label (default 'raw')

    Returns:
        List of Chunks, each covering up to CHUNK_SIZE lines
    """
    lines = source.splitlines()
    if not lines:
        return []

    chunks: List[Chunk] = []
    total = len(lines)

    for start in range(0, total, CHUNK_SIZE):
        end = min(start + CHUNK_SIZE, total)
        chunk_lines = lines[start:end]
        chunk_text = "\n".join(chunk_lines)

        if not chunk_text.strip():
            continue

        chunks.append(Chunk(
            chunk_text=chunk_text,
            chunk_type="raw",
            file_path=file_path,
            line_start=start + 1,       # 1-indexed
            line_end=end,               # 1-indexed, inclusive
            language=language,
            language_tier="2",
        ))

    return chunks
