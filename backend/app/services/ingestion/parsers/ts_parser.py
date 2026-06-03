"""TypeScript / TSX parser using Tree-sitter.

Reuses JavaScript extraction logic with the TypeScript grammar,
which covers all JS constructs plus TypeScript-specific nodes.
Handles .ts and .tsx files.
"""
from typing import List
from tree_sitter_languages import get_parser as _ts_parser

from app.services.ingestion.chunk import Chunk
from app.services.ingestion.parsers import js_parser

_parser = _ts_parser("typescript")

# TypeScript-only node types that carry semantic value
_TS_SPECIFIC = {
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "abstract_class_declaration",
}


# ─── Public API ──────────────────────────────────────────────────────────────

def parse(file_path: str, source: str) -> List[Chunk]:
    """Parse a TypeScript source file into semantic chunks."""
    src = source.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    # Reuse JS import extraction
    imports = js_parser._extract_imports(root, src)

    chunks: List[Chunk] = []

    # Walk with TS-specific additions
    _walk_ts(root, src, file_path, imports, chunks, class_name=None)

    if not chunks:
        lines = source.splitlines()
        chunks.append(Chunk(
            chunk_text=source,
            chunk_type="raw",
            file_path=file_path,
            line_start=1,
            line_end=len(lines) or 1,
            language="typescript",
            language_tier="1",
            imports=imports,
        ))

    return chunks


# ─── Walker ──────────────────────────────────────────────────────────────────

def _walk_ts(node, src, file_path, imports, out, class_name):
    for child in node.children:

        if child.type in ("function_declaration", "generator_function_declaration"):
            out.append(_fn_chunk(child, src, file_path, imports, class_name))

        elif child.type in ("class_declaration", "abstract_class_declaration"):
            cls = _cls_chunk(child, src, file_path, imports)
            out.append(cls)
            body = child.child_by_field_name("body")
            if body:
                _walk_ts(body, src, file_path, imports, out,
                         class_name=cls.class_name)

        elif child.type == "method_definition":
            name_node = child.child_by_field_name("name")
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="function",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="typescript",
                language_tier="1",
                function_name=_text(name_node, src) if name_node else None,
                class_name=class_name,
                imports=imports,
            ))

        elif child.type in ("lexical_declaration", "variable_declaration"):
            _handle_var_decl_ts(child, src, file_path, imports, out, class_name)

        elif child.type == "expression_statement":
            js_parser._handle_expression_stmt(child, src, file_path, imports, out)
            # Re-label language to typescript
            if out and out[-1].language == "javascript":
                out[-1] = _relabel(out[-1])

        elif child.type == "export_statement":
            _handle_export_ts(child, src, file_path, imports, out)

        elif child.type in _TS_SPECIFIC:
            # Interface / type alias / enum — store as a lightweight 'class' chunk
            name_node = child.child_by_field_name("name")
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="class",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="typescript",
                language_tier="1",
                class_name=_text(name_node, src) if name_node else None,
                imports=imports,
            ))


def _handle_var_decl_ts(node, src, file_path, imports, out, class_name):
    for declarator in node.named_children:
        if declarator.type != "variable_declarator":
            continue
        name_node = declarator.child_by_field_name("name")
        value_node = declarator.child_by_field_name("value")
        if value_node and value_node.type in ("arrow_function", "function"):
            func_name = _text(name_node, src) if name_node else None
            out.append(Chunk(
                chunk_text=_text(node, src),
                chunk_type="function",
                file_path=file_path,
                line_start=node.start_point[0] + 1,
                line_end=node.end_point[0] + 1,
                language="typescript",
                language_tier="1",
                function_name=func_name,
                class_name=class_name,
                imports=imports,
            ))


def _handle_export_ts(node, src, file_path, imports, out):
    for child in node.named_children:
        if child.type in ("function_declaration", "generator_function_declaration"):
            out.append(_fn_chunk(child, src, file_path, imports, None))
        elif child.type in ("class_declaration", "abstract_class_declaration"):
            out.append(_cls_chunk(child, src, file_path, imports))
        elif child.type in ("lexical_declaration", "variable_declaration"):
            _handle_var_decl_ts(child, src, file_path, imports, out, None)
        elif child.type in _TS_SPECIFIC:
            name_node = child.child_by_field_name("name")
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="class",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="typescript",
                language_tier="1",
                class_name=_text(name_node, src) if name_node else None,
                imports=imports,
            ))


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _fn_chunk(node, src, file_path, imports, class_name) -> Chunk:
    name_node = node.child_by_field_name("name")
    return Chunk(
        chunk_text=_text(node, src),
        chunk_type="function",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="typescript",
        language_tier="1",
        function_name=_text(name_node, src) if name_node else None,
        class_name=class_name,
        imports=imports,
    )


def _cls_chunk(node, src, file_path, imports) -> Chunk:
    name_node = node.child_by_field_name("name")
    return Chunk(
        chunk_text=_text(node, src),
        chunk_type="class",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="typescript",
        language_tier="1",
        class_name=_text(name_node, src) if name_node else None,
        imports=imports,
    )


def _relabel(chunk: Chunk) -> Chunk:
    """Return a copy of chunk with language set to 'typescript'."""
    from dataclasses import replace
    return replace(chunk, language="typescript")


def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")
