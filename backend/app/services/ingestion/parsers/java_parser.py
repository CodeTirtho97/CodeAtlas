"""Java parser using Tree-sitter.

Extracts classes, methods, and Spring Boot endpoint/role annotations.
"""
from typing import List, Optional, Set
from tree_sitter_languages import get_parser as _ts_parser

from app.services.ingestion.chunk import Chunk

_parser = _ts_parser("java")

# Spring MVC HTTP method annotations → endpoint
_ENDPOINT_ANNOTATIONS = {
    "@getmapping", "@postmapping", "@putmapping", "@deletemapping",
    "@patchmapping", "@requestmapping",
}

# Class-level annotations → architectural role
_ROLE_ANNOTATIONS = {
    "@restcontroller": "controller",
    "@controller":     "controller",
    "@service":        "service",
    "@repository":     "repository",
    "@component":      "utility",
}


# ─── Public API ──────────────────────────────────────────────────────────────

def parse(file_path: str, source: str) -> List[Chunk]:
    """Parse a Java source file into semantic chunks."""
    src = source.encode("utf-8")
    tree = _parser.parse(src)
    root = tree.root_node

    imports = _extract_imports(root, src)
    chunks: List[Chunk] = []
    _walk(root, src, file_path, imports, chunks, class_name=None,
          class_role=None)

    if not chunks:
        lines = source.splitlines()
        chunks.append(Chunk(
            chunk_text=source,
            chunk_type="raw",
            file_path=file_path,
            line_start=1,
            line_end=len(lines) or 1,
            language="java",
            language_tier="1",
            imports=imports,
        ))

    return chunks


# ─── AST Walker ──────────────────────────────────────────────────────────────

def _walk(node, src, file_path, imports, out, class_name, class_role):
    for child in node.children:

        if child.type in ("class_declaration", "interface_declaration",
                          "enum_declaration", "record_declaration"):
            _handle_class(child, src, file_path, imports, out)

        elif child.type == "method_declaration":
            _handle_method(child, src, file_path, imports, out,
                           class_name, class_role)

        elif child.type == "constructor_declaration":
            name_node = child.child_by_field_name("name")
            out.append(Chunk(
                chunk_text=_text(child, src),
                chunk_type="function",
                file_path=file_path,
                line_start=child.start_point[0] + 1,
                line_end=child.end_point[0] + 1,
                language="java",
                language_tier="1",
                function_name=_text(name_node, src) if name_node else None,
                class_name=class_name,
                architectural_role=class_role,
                imports=imports,
            ))


def _handle_class(node, src, file_path, imports, out):
    """Extract a class/interface/enum chunk and recurse into its body."""
    annotations = _collect_annotations(node, src)
    role = _role_from_annotations(annotations)
    name_node = node.child_by_field_name("name")
    class_name = _text(name_node, src) if name_node else None

    # Fallback role from class name suffix
    if not role and class_name:
        role = _role_from_name(class_name)

    out.append(Chunk(
        chunk_text=_text(node, src),
        chunk_type="class",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="java",
        language_tier="1",
        class_name=class_name,
        architectural_role=role,
        imports=imports,
    ))

    body = node.child_by_field_name("body")
    if body:
        _walk(body, src, file_path, imports, out,
              class_name=class_name, class_role=role)


def _handle_method(node, src, file_path, imports, out, class_name, class_role):
    """Extract a method as function or endpoint chunk."""
    annotations = _collect_annotations(node, src)
    is_endpoint = bool(annotations & _ENDPOINT_ANNOTATIONS)
    name_node = node.child_by_field_name("name")

    out.append(Chunk(
        chunk_text=_text(node, src),
        chunk_type="endpoint" if is_endpoint else "function",
        file_path=file_path,
        line_start=node.start_point[0] + 1,
        line_end=node.end_point[0] + 1,
        language="java",
        language_tier="1",
        function_name=_text(name_node, src) if name_node else None,
        class_name=class_name,
        architectural_role=class_role,
        imports=imports,
    ))


# ─── Import Extraction ────────────────────────────────────────────────────────

def _extract_imports(root, src: bytes) -> List[str]:
    imports = []
    for node in root.children:
        if node.type == "import_declaration":
            # import com.example.auth.AuthService;
            for child in node.named_children:
                if child.type == "scoped_identifier":
                    imports.append(_text(child, src))
    return imports


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _text(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _collect_annotations(node, src: bytes) -> Set[str]:
    """Return lowercase annotation names from the node's modifiers."""
    annotations: Set[str] = set()
    for child in node.children:
        if child.type == "modifiers":
            for mod in child.children:
                if mod.type == "annotation":
                    name = mod.child_by_field_name("name")
                    if name:
                        annotations.add("@" + _text(name, src).lower())
        elif child.type == "annotation":
            name = child.child_by_field_name("name")
            if name:
                annotations.add("@" + _text(name, src).lower())
    return annotations


def _role_from_annotations(annotations: Set[str]) -> Optional[str]:
    for ann in annotations:
        if ann in _ROLE_ANNOTATIONS:
            return _ROLE_ANNOTATIONS[ann]
    return None


def _role_from_name(class_name: str) -> Optional[str]:
    lower = class_name.lower()
    if lower.endswith("controller") or lower.endswith("router"):
        return "controller"
    if lower.endswith("service"):
        return "service"
    if lower.endswith("repository") or lower.endswith("repo") or lower.endswith("dao"):
        return "repository"
    return "utility"
