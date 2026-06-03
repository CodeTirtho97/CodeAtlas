"""JavaScript / JSX parser using Tree-sitter.

Extracts functions, classes, methods, arrow functions, and Express endpoints.
Handles .js and .jsx files.
"""
from typing import List, Optional
from tree_sitter_languages import get_parser as _ts_parser

from app.services.ingestion.chunk import Chunk

_parser = _ts_parser("javascript")

# Express-style route method names
_ENDPOINT_METHODS = {"get", "post", "put", "delete", "patch", "use", "all",
                     "head", "options"}


# ─── Public API ──────────────────────────────────────────────────────────────

def parse(file_path: str, source: str) -> List[Chunk]:
    """Parse a JavaScript source file into semantic chunks."""
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

def _walk(node, src, file_path, imports, out, class_name):
    for child in node.children:

        if child.type == "function_declaration":
            out.append(_make_function_chunk(child, src, file_path, imports,
                                            class_name, False))

        elif child.type == "class_declaration":
            cls_chunk = _make_class_chunk(child, src, file_path, imports)
            out.append(cls_chunk)
            body = child.child_by_field_name("body")
            if body:
                _walk(body, src, file_path, imports, out,
                      class_name=cls_chunk.class_name)

        elif child.type == "method_definition":
            name_node = child.child_by_field_name("name")
            func_name = _text(name_node, src) if name_node else None
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="function",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="javascript",
                language_tier="1",
                function_name=func_name,
                class_name=class_name,
                imports=imports,
            ))

        elif child.type in ("lexical_declaration", "variable_declaration"):
            # const foo = () => {} or const foo = function() {}
            _handle_var_decl(child, src, file_path, imports, out, class_name)

        elif child.type == "expression_statement":
            # router.get('/path', handler) or app.post(...)
            _handle_expression_stmt(child, src, file_path, imports, out)

        elif child.type == "export_statement":
            # export default function / export const foo = ...
            _handle_export(child, src, file_path, imports, out)


def _handle_var_decl(node, src, file_path, imports, out, class_name):
    """Handle: const foo = () => {} or const foo = function() {}"""
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
                language="javascript",
                language_tier="1",
                function_name=func_name,
                class_name=class_name,
                imports=imports,
            ))


def _handle_expression_stmt(node, src, file_path, imports, out):
    """Handle: router.get('/path', handler) — Express endpoint registration."""
    expr = next((c for c in node.named_children
                 if c.type == "call_expression"), None)
    if not expr:
        return
    func = expr.child_by_field_name("function")
    if not func or func.type != "member_expression":
        return
    prop = func.child_by_field_name("property")
    if prop and _text(prop, src).lower() in _ENDPOINT_METHODS:
        args = expr.child_by_field_name("arguments")
        path_arg = _first_string_arg(args, src) if args else None
        out.append(Chunk(
            chunk_text=_text(node, src),
            chunk_type="endpoint",
            file_path=file_path,
            line_start=node.start_point[0] + 1,
            line_end=node.end_point[0] + 1,
            language="javascript",
            language_tier="1",
            function_name=path_arg,
            imports=imports,
        ))


def _handle_export(node, src, file_path, imports, out):
    """Handle export statements — recurse into the exported declaration."""
    for child in node.named_children:
        if child.type == "function_declaration":
            out.append(_make_function_chunk(child, src, file_path, imports,
                                            None, False))
        elif child.type == "class_declaration":
            cls_chunk = _make_class_chunk(child, src, file_path, imports)
            out.append(cls_chunk)
        elif child.type in ("lexical_declaration", "variable_declaration"):
            _handle_var_decl(child, src, file_path, imports, out, None)


# ─── Chunk Builders ───────────────────────────────────────────────────────────

def _make_function_chunk(node, src, file_path, imports, class_name,
                         is_endpoint) -> Chunk:
    name_node = node.child_by_field_name("name")
    return Chunk(
        chunk_text=_text(node, src),
        chunk_type="endpoint" if is_endpoint else "function",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="javascript",
        language_tier="1",
        function_name=_text(name_node, src) if name_node else None,
        class_name=class_name,
        imports=imports,
    )


def _make_class_chunk(node, src, file_path, imports) -> Chunk:
    name_node = node.child_by_field_name("name")
    return Chunk(
        chunk_text=_text(node, src),
        chunk_type="class",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="javascript",
        language_tier="1",
        class_name=_text(name_node, src) if name_node else None,
        imports=imports,
    )


def _raw_chunk(file_path, source, imports) -> Chunk:
    lines = source.splitlines()
    return Chunk(
        chunk_text=source,
        chunk_type="raw",
        file_path=file_path,
        line_start=1,
        line_end=len(lines) or 1,
        language="javascript",
        language_tier="1",
        imports=imports,
    )


# ─── Import Extraction ────────────────────────────────────────────────────────

def _extract_imports(root, src: bytes) -> List[str]:
    imports = []
    for node in root.children:
        if node.type == "import_statement":
            source_node = node.child_by_field_name("source")
            if source_node:
                imports.append(_text(source_node, src).strip("'\""))
        elif node.type == "lexical_declaration":
            # const x = require('module')
            for decl in node.named_children:
                if decl.type != "variable_declarator":
                    continue
                value = decl.child_by_field_name("value")
                if value and value.type == "call_expression":
                    fn = value.child_by_field_name("function")
                    args = value.child_by_field_name("arguments")
                    if fn and _text(fn, src) == "require" and args:
                        mod = _first_string_arg(args, src)
                        if mod:
                            imports.append(mod)
    return imports


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _first_string_arg(args_node, src: bytes) -> Optional[str]:
    """Return the value of the first string argument in an argument list."""
    for child in args_node.named_children:
        if child.type == "string":
            return _text(child, src).strip("'\"` ")
    return None
