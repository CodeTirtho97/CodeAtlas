"""Parser dispatcher.

Routes each FileInfo to the correct language parser and returns
a flat list of Chunks for the whole repository.
"""
import logging
from typing import List

from app.services.ingestion.chunk import Chunk
from app.services.ingestion.file_filter import FileInfo
from app.services.ingestion.parsers import (
    python_parser,
    js_parser,
    ts_parser,
    java_parser,
    go_parser,
    fallback_parser,
)

log = logging.getLogger(__name__)

# Map language label (from file_filter) → parser module
_PARSER_MAP = {
    "python":     python_parser,
    "javascript": js_parser,
    "typescript": ts_parser,
    "java":       java_parser,
    "go":         go_parser,
}


def parse_file(file_info: FileInfo) -> List[Chunk]:
    """Parse a single file and return its chunks.

    Falls back to the line-count parser on any parse error so that
    a broken source file never halts the entire ingestion.
    """
    try:
        source = file_info.path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        log.warning("Could not read %s: %s", file_info.relative_path, exc)
        return []

    if not source.strip():
        return []

    parser = _PARSER_MAP.get(file_info.language)

    try:
        if parser:
            return parser.parse(file_info.relative_path, source)
        else:
            return fallback_parser.parse(
                file_info.relative_path, source, language=file_info.language
            )
    except Exception as exc:
        log.warning(
            "Parser error in %s (%s): %s — falling back to raw chunking",
            file_info.relative_path, file_info.language, exc,
        )
        return fallback_parser.parse(
            file_info.relative_path, source, language=file_info.language
        )


def parse_all_files(files: List[FileInfo]) -> List[Chunk]:
    """Parse every file in the list and return all chunks combined."""
    all_chunks: List[Chunk] = []
    skipped = 0

    for file_info in files:
        chunks = parse_file(file_info)
        if chunks:
            all_chunks.extend(chunks)
        else:
            skipped += 1

    log.info(
        "Parsed %d files → %d chunks (%d skipped)",
        len(files) - skipped, len(all_chunks), skipped,
    )
    return all_chunks
