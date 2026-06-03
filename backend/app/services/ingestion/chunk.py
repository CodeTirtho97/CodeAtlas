from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Chunk:
    """A single semantic unit extracted from a source file.

    Produced by parsers, consumed by the embedder and DB writer.
    """

    # ── Content ────────────────────────────────────────────────────────────
    chunk_text: str
    chunk_type: str         # function | class | endpoint | doc | raw

    # ── Location ───────────────────────────────────────────────────────────
    file_path: str          # relative to repo root, forward slashes
    line_start: int         # 1-indexed
    line_end: int           # 1-indexed

    # ── Language ───────────────────────────────────────────────────────────
    language: str
    language_tier: str      # "1" (AST) | "2" (raw fallback)

    # ── Code metadata (optional) ───────────────────────────────────────────
    function_name: Optional[str] = None
    class_name: Optional[str] = None
    # controller | service | repository | utility | None
    architectural_role: Optional[str] = None

    # ── Dependency graph ───────────────────────────────────────────────────
    # Module paths this file imports — used by dependency_graph.py
    # Not stored in Qdrant; resolved and stored in the DB separately.
    imports: List[str] = field(default_factory=list)

    def __repr__(self) -> str:
        loc = f"L{self.line_start}-{self.line_end}"
        name = self.function_name or self.class_name or "?"
        return f"<Chunk {self.chunk_type}:{name} {self.file_path}:{loc}>"
