"""API endpoint extractor — pure Tree-sitter output, no LLM.

Reads endpoint chunks produced by the parsers and returns a
structured list suitable for dashboard display.
"""
from typing import List, Optional
from app.services.ingestion.chunk import Chunk

# HTTP method keywords extracted from chunk text
_HTTP_METHODS = {"get", "post", "put", "delete", "patch", "head", "options"}


def extract_endpoints(chunks: List[Chunk]) -> List[dict]:
    """Extract all API endpoints from parsed chunks.

    Returns a list of dicts:
    {
        "method":        str | None,   # GET, POST, etc.
        "path":          str | None,   # "/users/{id}"
        "file_path":     str,
        "function_name": str | None,
        "line":          int,
        "language":      str,
    }
    """
    endpoints = []

    for chunk in chunks:
        if chunk.chunk_type != "endpoint":
            continue

        method, path = _infer_method_and_path(chunk)

        endpoints.append({
            "method":        method,
            "path":          path,
            "file_path":     chunk.file_path,
            "function_name": chunk.function_name,
            "line":          chunk.line_start,
            "language":      chunk.language,
        })

    return endpoints


# ─── Method / Path Inference ─────────────────────────────────────────────────

def _infer_method_and_path(chunk: Chunk) -> tuple[Optional[str], Optional[str]]:
    """Heuristically extract HTTP method and path from endpoint chunk text."""
    text = chunk.chunk_text.lower()

    method = _detect_method(text, chunk.language)
    path = _detect_path(chunk)

    return method, path


def _detect_method(text: str, language: str) -> Optional[str]:
    """Detect HTTP method from code text."""

    if language == "python":
        # FastAPI/Flask: @app.get, @router.post, @app.route(methods=["PUT"])
        for m in _HTTP_METHODS:
            if f".{m}(" in text or f'.{m}\n' in text:
                return m.upper()
        # Flask: @app.route(..., methods=["DELETE"])
        for m in _HTTP_METHODS:
            if f'"{m}"' in text or f"'{m}'" in text:
                return m.upper()

    elif language == "java":
        # @GetMapping, @PostMapping, @PutMapping...
        for m in _HTTP_METHODS:
            if f"@{m}mapping" in text or f'requestmethod.{m}' in text:
                return m.upper()

    elif language in ("javascript", "typescript"):
        # router.get, app.post, router.delete
        for m in _HTTP_METHODS:
            if f".{m}(" in text:
                return m.upper()

    elif language == "go":
        # r.GET, router.POST, http.HandleFunc
        for m in _HTTP_METHODS:
            if f".{m}(" in text:
                return m.upper()
        if "handlefunc" in text or "handle(" in text:
            return "GET"  # generic handler, default to GET

    return None


def _detect_path(chunk: Chunk) -> Optional[str]:
    """Try to extract the route path from the chunk.

    For Python FastAPI/Flask, the path is often the decorator argument.
    For JS/Go, it may be the function_name field (set by the parser).
    """
    # Parser may have stored the path in function_name for endpoint chunks
    fn = chunk.function_name
    if fn and fn.startswith("/"):
        return fn

    # Try to find quoted path in source
    text = chunk.chunk_text
    for quote in ('"', "'", "`"):
        idx = text.find(quote + "/")
        if idx != -1:
            end = text.find(quote, idx + 1)
            if end != -1:
                candidate = text[idx + 1: end]
                if "/" in candidate and len(candidate) < 200:
                    return candidate

    return None
