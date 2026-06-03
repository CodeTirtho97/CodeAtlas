"""Python source file parser using Tree-sitter.

Extracts functions, classes, methods, and FastAPI/Flask endpoints.
"""
from typing import List, Optional
from tree_sitter_languages import get_parser as _ts_parser

from app.services.ingestion.chunk import Chunk

_parser = _ts_parser("python")

# Decorator attribute names that indicate an HTTP endpoint
_ENDPOINT_METHODS = {"get", "post", "put", "delete", "patch", "head", "options", "route"}

# Class name suffix → architectural role
_ROLE_MAP = {
    "service":    "service",
    "controller": "controller",
    "router":     "controller",
    "handler":    "controller",
    "repository": "repository",
    "repo":       "repository",
    "dao":        "repository",
}


# ─── Public API ──────────────────────────────────────────────────────────────

def parse(file_path: str, source: str) -> List[Chunk]:
    """Parse a Python source file into semantic chunks."""
    if not source.strip():
        return []

    src = source.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    imports = _extract_imports(root, src)
    chunks: List[Chunk] = []
    _walk(root, src, file_path, imports, chunks, class_name=None)

    if not chunks:
        chunks.append(_raw_chunk(file_path, source, imports))

    return chunks


# ─── AST Walker ──────────────────────────────────────────────────────────────

def _walk(node, src: bytes, file_path: str, imports: List[str],
          out: List[Chunk], class_name: Optional[str]) -> None:
    """Recursively walk nodes; extract function/class/endpoint chunks."""

    for child in node.children:
        if child.type == "decorated_definition":
            _handle_decorated(child, src, file_path, imports, out, class_name)

        elif child.type == "function_definition":
            chunk = _make_function_chunk(child, src, file_path, imports,
                                         class_name, is_endpoint=False)
            out.append(chunk)

        elif child.type == "class_definition":
            cls_chunk = _make_class_chunk(child, src, file_path, imports)
            out.append(cls_chunk)
            # Recurse into class body to extract methods
            body = child.child_by_field_name("body")
            if body:
                _walk(body, src, file_path, imports, out,
                      class_name=cls_chunk.class_name)


def _handle_decorated(node, src, file_path, imports, out, class_name):
    """Process a decorated_definition node."""
    decorators = [c for c in node.children if c.type == "decorator"]
    inner = next(
        (c for c in node.children
         if c.type in ("function_definition", "class_definition")),
        None,
    )
    if inner is None:
        return

    if inner.type == "function_definition":
        is_endpoint = any(_is_endpoint_decorator(d, src) for d in decorators)
        chunk = _make_function_chunk(
            inner, src, file_path, imports, class_name,
            is_endpoint=is_endpoint,
            decorator_node=node,
        )
        out.append(chunk)

    elif inner.type == "class_definition":
        cls_chunk = _make_class_chunk(inner, src, file_path, imports,
                                      decorator_node=node)
        out.append(cls_chunk)
        body = inner.child_by_field_name("body")
        if body:
            _walk(body, src, file_path, imports, out,
                  class_name=cls_chunk.class_name)


# ─── Chunk Builders ───────────────────────────────────────────────────────────

def _make_function_chunk(node, src, file_path, imports, class_name,
                         is_endpoint, decorator_node=None) -> Chunk:
    outer = decorator_node or node
    text = _text(outer, src)
    name_node = node.child_by_field_name("name")
    func_name = _text(name_node, src) if name_node else None

    return Chunk(
        chunk_text=text,
        chunk_type="endpoint" if is_endpoint else "function",
        file_path=file_path,
        line_start=outer.start_point[0] + 1,
        line_end=outer.end_point[0] + 1,
        language="python",
        language_tier="1",
        function_name=func_name,
        class_name=class_name,
        architectural_role=_role_from_class(class_name),
        imports=imports,
    )


def _make_class_chunk(node, src, file_path, imports,
                      decorator_node=None) -> Chunk:
    outer = decorator_node or node
    text = _text(outer, src)
    name_node = node.child_by_field_name("name")
    class_name = _text(name_node, src) if name_node else None

    return Chunk(
        chunk_text=text,
        chunk_type="class",
        file_path=file_path,
        line_start=outer.start_point[0] + 1,
        line_end=outer.end_point[0] + 1,
        language="python",
        language_tier="1",
        class_name=class_name,
        architectural_role=_role_from_class(class_name),
        imports=imports,
    )


def _raw_chunk(file_path: str, source: str, imports: List[str]) -> Chunk:
    lines = source.splitlines()
    return Chunk(
        chunk_text=source,
        chunk_type="raw",
        file_path=file_path,
        line_start=1,
        line_end=len(lines) or 1,
        language="python",
        language_tier="1",
        imports=imports,
    )


# ─── Import Extraction ────────────────────────────────────────────────────────

def _extract_imports(root, src: bytes) -> List[str]:
    imports: List[str] = []
    for node in root.children:
        if node.type == "import_statement":
            # import os  /  import os, sys
            for child in node.named_children:
                if child.type in ("dotted_name", "aliased_import"):
                    name_node = (child.child_by_field_name("name")
                                 if child.type == "aliased_import" else child)
                    if name_node:
                        imports.append(_text(name_node, src))
        elif node.type == "import_from_statement":
            # from X import Y  /  from . import Y  /  from ..X import Y
            module_node = node.child_by_field_name("module_name")
            relative = next(
                (c for c in node.children if c.type == "relative_import"), None
            )
            if relative:
                imports.append(_text(relative, src))
            elif module_node:
                imports.append(_text(module_node, src))
    return imports


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _is_endpoint_decorator(decorator_node, src: bytes) -> bool:
    """Return True if the decorator looks like a route decorator."""
    text = _text(decorator_node, src).lower()
    return any(f".{m}(" in text or f".{m}\n" in text
               for m in _ENDPOINT_METHODS)


def _role_from_class(class_name: Optional[str]) -> Optional[str]:
    if not class_name:
        return None
    lower = class_name.lower()
    for suffix, role in _ROLE_MAP.items():
        if lower.endswith(suffix):
            return role
    return "utility"
