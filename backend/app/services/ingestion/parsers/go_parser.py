"""Go parser using Tree-sitter.

Extracts functions, struct method declarations, and HTTP handler patterns.
Go has no classes — functions and methods on structs are the primary units.
"""
from typing import List, Optional
from tree_sitter_languages import get_parser as _ts_parser

from app.services.ingestion.chunk import Chunk

_parser = _ts_parser("go")

# Router method names across popular Go HTTP libraries
_HTTP_METHODS = {"get", "post", "put", "delete", "patch", "head",
                 "options", "handle", "handlefunc"}


# ─── Public API ──────────────────────────────────────────────────────────────

def parse(file_path: str, source: str) -> List[Chunk]:
    """Parse a Go source file into semantic chunks."""
    src = source.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    imports = _extract_imports(root, src)
    chunks: List[Chunk] = []
    _walk(root, src, file_path, imports, chunks)

    if not chunks:
        lines = source.splitlines()
        chunks.append(Chunk(
            chunk_text=source,
            chunk_type="raw",
            file_path=file_path,
            line_start=1,
            line_end=len(lines) or 1,
            language="go",
            language_tier="1",
            imports=imports,
        ))

    return chunks


# ─── AST Walker ──────────────────────────────────────────────────────────────

def _walk(node, src, file_path, imports, out):
    for child in node.children:

        if child.type == "function_declaration":
            name_node = child.child_by_field_name("name")
            func_name = _text(name_node, src) if name_node else None
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="function",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="go",
                language_tier="1",
                function_name=func_name,
                imports=imports,
            ))
            # Walk function body for route registrations (router.GET, r.POST, etc.)
            body = child.child_by_field_name("body")
            if body:
                _walk_body_for_routes(body, src, file_path, imports, out)

        elif child.type == "method_declaration":
            # func (r *Router) GET(path string, handler HandlerFunc)
            name_node = child.child_by_field_name("name")
            receiver = child.child_by_field_name("receiver")
            class_name = _receiver_type(receiver, src) if receiver else None
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="function",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="go",
                language_tier="1",
                function_name=_text(name_node, src) if name_node else None,
                class_name=class_name,
                imports=imports,
            ))

        elif child.type == "type_declaration":
            # type UserService struct { ... }
            for spec in child.named_children:
                if spec.type == "type_spec":
                    name_node = spec.child_by_field_name("name")
                    type_node = spec.child_by_field_name("type")
                    if type_node and type_node.type == "struct_type":
                        class_name = _text(name_node, src) if name_node else None
                        out.append(Chunk(
                            chunk_text=_text(child, src),
                            chunk_type="class",
                            file_path=file_path,
                            line_start=child.start_point[0] + 1,
                            line_end=child.end_point[0] + 1,
                            language="go",
                            language_tier="1",
                            class_name=class_name,
                            architectural_role=_role_from_name(class_name),
                            imports=imports,
                        ))

        elif child.type == "expression_statement":
            # Top-level route registrations (outside any function)
            _handle_route_call(child, src, file_path, imports, out)


# ─── HTTP Route Detection ─────────────────────────────────────────────────────

def _walk_body_for_routes(body_node, src, file_path, imports, out):
    """Walk a function body and extract route call expressions as endpoints."""
    for child in body_node.children:
        if child.type == "expression_statement":
            _handle_route_call(child, src, file_path, imports, out)


def _handle_route_call(node, src, file_path, imports, out):
    """Detect route registrations: router.GET("/path", handler)."""
    call = next(
        (c for c in node.named_children if c.type == "call_expression"), None
    )
    if not call:
        return
    fn = call.child_by_field_name("function")
    if not fn or fn.type != "selector_expression":
        return
    field_node = fn.child_by_field_name("field")
    if not field_node:
        return
    if _text(field_node, src).lower() not in _HTTP_METHODS:
        return
    args = call.child_by_field_name("arguments")
    path = _first_string_arg(args, src) if args else None
    out.append(Chunk(
        chunk_text=_text(node, src),
        chunk_type="endpoint",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="go",
        language_tier="1",
        function_name=path,
        imports=imports,
    ))


# ─── Import Extraction ────────────────────────────────────────────────────────

def _extract_imports(root, src: bytes) -> List[str]:
    imports = []
    for node in root.children:
        if node.type == "import_declaration":
            for spec in node.named_children:
                if spec.type == "import_spec":
                    path_node = spec.child_by_field_name("path")
                    if path_node:
                        imports.append(_text(path_node, src).strip('"'))
                elif spec.type == "import_spec_list":
                    for inner in spec.named_children:
                        if inner.type == "import_spec":
                            path_node = inner.child_by_field_name("path")
                            if path_node:
                                imports.append(_text(path_node, src).strip('"'))
    return imports


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _receiver_type(receiver_node, src: bytes) -> Optional[str]:
    """Extract the struct type name from a method receiver: (s *UserService) → UserService."""
    # receiver_node is a parameter_list; its named_children are parameter_declarations
    for param_decl in receiver_node.named_children:
        if param_decl.type != "parameter_declaration":
            continue
        for child in param_decl.named_children:
            if child.type == "pointer_type":
                # *UserService → find the type_identifier inside
                inner = next(
                    (c for c in child.named_children if c.type == "type_identifier"),
                    None,
                )
                if inner:
                    return _text(inner, src)
            elif child.type == "type_identifier":
                return _text(child, src)
    return None


def _first_string_arg(args_node, src: bytes) -> Optional[str]:
    for child in args_node.named_children:
        if child.type in ("interpreted_string_literal", "raw_string_literal"):
            return _text(child, src).strip('"`')
    return None


def _role_from_name(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    lower = name.lower()
    if lower.endswith("service"):
        return "service"
    if lower.endswith("controller") or lower.endswith("handler"):
        return "controller"
    if lower.endswith("repository") or lower.endswith("repo"):
        return "repository"
    return "utility"
