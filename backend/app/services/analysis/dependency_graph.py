"""File dependency graph using NetworkX.

Builds a directed graph where an edge A → B means "file A imports file B".
Only project-internal edges are kept (stdlib and third-party are dropped).
"""
import logging
import re
from collections import defaultdict
from typing import Dict, List, Set

import networkx as nx

from app.services.ingestion.chunk import Chunk

log = logging.getLogger(__name__)


def build_dependency_graph(chunks: List[Chunk]) -> Dict[str, dict]:
    """Build a file-level import dependency graph from parsed chunks.

    Args:
        chunks: All chunks from the repository (imports field used)

    Returns:
        Adjacency dict:
        {
          "auth/service.py": {
            "uses":    ["db/models.py", "utils/hash.py"],
            "used_by": ["routes/auth.py"]
          },
          ...
        }
    """
    # Collect all known project files
    project_files: Set[str] = {c.file_path for c in chunks}

    # Build file → imports mapping (deduplicated)
    file_imports: Dict[str, Set[str]] = defaultdict(set)
    for chunk in chunks:
        if chunk.imports:
            file_imports[chunk.file_path].update(chunk.imports)

    # Build language map for import resolution
    file_language: Dict[str, str] = {c.file_path: c.language for c in chunks}

    # Build directed graph
    graph = nx.DiGraph()
    graph.add_nodes_from(project_files)

    for source_file, imports in file_imports.items():
        lang = file_language.get(source_file, "raw")
        for raw_import in imports:
            resolved = _resolve_import(raw_import, source_file, project_files, lang)
            if resolved and resolved != source_file:
                graph.add_edge(source_file, resolved)

    # Serialize to adjacency dict
    adjacency: Dict[str, dict] = {}
    for node in sorted(graph.nodes()):
        uses = sorted(graph.successors(node))
        used_by = sorted(graph.predecessors(node))
        if uses or used_by:
            adjacency[node] = {"uses": uses, "used_by": used_by}

    log.info(
        "Dependency graph: %d files, %d edges",
        graph.number_of_nodes(), graph.number_of_edges(),
    )
    return adjacency


# ─── Import Resolution ────────────────────────────────────────────────────────

def _resolve_import(
    raw_import: str,
    source_file: str,
    project_files: Set[str],
    language: str,
) -> str | None:
    """Try to match a raw import string to a known project file path.

    Returns the matched file path, or None if the import is external
    (stdlib / third-party) or cannot be resolved.
    """
    if not raw_import:
        return None

    if language == "python":
        return _resolve_python(raw_import, source_file, project_files)
    elif language in ("javascript", "typescript"):
        return _resolve_js(raw_import, source_file, project_files)
    elif language == "java":
        return _resolve_java(raw_import, project_files)
    elif language == "go":
        return _resolve_go(raw_import, project_files)

    return None


def _resolve_python(raw: str, source: str, files: Set[str]) -> str | None:
    """Resolve a Python import to a project file path.

    Handles:
        - Absolute: "app.auth.service" → "app/auth/service.py"
        - Relative: ".auth" relative to source file's package
    """
    source_dir = "/".join(source.split("/")[:-1])

    if raw.startswith("."):
        # Relative import
        dots = len(raw) - len(raw.lstrip("."))
        module = raw[dots:]

        # Walk up the directory tree by dot count
        parts = source_dir.split("/") if source_dir else []
        base_parts = parts[: max(0, len(parts) - (dots - 1))]

        if module:
            candidate_parts = base_parts + module.split(".")
        else:
            candidate_parts = base_parts

        # Try .py file
        candidate = "/".join(candidate_parts) + ".py"
        if candidate in files:
            return candidate
        # Try package __init__.py
        init = "/".join(candidate_parts) + "/__init__.py"
        if init in files:
            return init
        return None

    # Absolute import — convert dots to slashes and try extensions
    candidate = raw.replace(".", "/") + ".py"
    if candidate in files:
        return candidate
    init = raw.replace(".", "/") + "/__init__.py"
    if init in files:
        return init

    return None


def _resolve_js(raw: str, source: str, files: Set[str]) -> str | None:
    """Resolve a JS/TS import specifier to a project file path.

    Handles:
      - Relative: './auth', '../services/auth'
      - Path aliases / bare specifiers: '@/services/auth', 'utils/helpers'
        (matched by trailing path components against project files)
    """
    import os

    _JS_EXTS = (".ts", ".tsx", ".js", ".jsx")

    if raw.startswith("."):
        # Relative import — resolve normally
        source_dir = "/".join(source.split("/")[:-1])
        try:
            joined = os.path.join(source_dir, raw) if source_dir else raw
            resolved = os.path.normpath(joined).replace("\\", "/")
        except Exception:
            return None

        for ext in _JS_EXTS:
            if resolved + ext in files:
                return resolved + ext
        for ext in _JS_EXTS:
            candidate = resolved + "/index" + ext
            if candidate in files:
                return candidate
        return None

    # Non-relative: strip alias prefix (e.g. '@/', '~/', 'src/')
    # then try matching the trailing path components against project files.
    stripped = re.sub(r"^[@~][^/]*/", "", raw)   # remove @alias/ or ~alias/
    stripped = re.sub(r"^src/", "", stripped)      # common src/ prefix

    parts = stripped.split("/")
    # Try progressively shorter suffixes (most-specific first)
    for length in range(min(len(parts), 4), 0, -1):
        suffix = "/".join(parts[-length:])
        for ext in _JS_EXTS:
            # exact suffix match with extension
            for f in files:
                if f.endswith("/" + suffix + ext) or f == suffix + ext:
                    return f
            # already has extension
            for f in files:
                if f.endswith("/" + suffix) or f == suffix:
                    return f

    return None


def _resolve_java(raw: str, files: Set[str]) -> str | None:
    """Resolve a Java import declaration to a project file path.

    "com.example.auth.AuthService" → "com/example/auth/AuthService.java"
    """
    candidate = raw.replace(".", "/") + ".java"
    if candidate in files:
        return candidate
    return None


def _resolve_go(raw: str, files: Set[str]) -> str | None:
    """Resolve a Go import path to a project file path.

    Go imports are module paths. We strip the module prefix and match
    against the project's directory structure.

    "github.com/user/repo/pkg/auth" → look for any file in "pkg/auth/"
    """
    # Try matching the last N components of the import path as a directory
    parts = raw.strip('"').split("/")
    for length in range(min(len(parts), 4), 0, -1):
        prefix = "/".join(parts[-length:]) + "/"
        match = next((f for f in files if f.startswith(prefix)), None)
        if match:
            return match

    return None
