"""Unit tests for analysis services: dependency_graph and api_extractor."""
import pytest
from app.services.ingestion.chunk import Chunk
from app.services.analysis.dependency_graph import (
    build_dependency_graph,
    _resolve_python,
    _resolve_js,
    _resolve_java,
    _resolve_go,
)
from app.services.analysis.api_extractor import extract_endpoints, _detect_method


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def _chunk(
    file_path="app/service.py",
    language="python",
    chunk_type="function",
    imports=None,
    function_name=None,
    chunk_text="",
) -> Chunk:
    return Chunk(
        chunk_text=chunk_text,
        chunk_type=chunk_type,
        language=language,
        language_tier="1",
        file_path=file_path,
        line_start=1,
        line_end=10,
        function_name=function_name,
        imports=imports or [],
    )


# ══════════════════════════════════════════════════════════════════════════════
# Dependency Graph
# ══════════════════════════════════════════════════════════════════════════════

class TestDependencyGraph:

    def test_empty_chunks_returns_empty(self):
        assert build_dependency_graph([]) == {}

    def test_no_imports_returns_empty(self):
        chunks = [
            _chunk("app/main.py", imports=[]),
            _chunk("app/service.py", imports=[]),
        ]
        assert build_dependency_graph(chunks) == {}

    def test_simple_internal_edge(self):
        chunks = [
            _chunk("app/routes.py", imports=["app.service"]),
            _chunk("app/service.py", imports=[]),
        ]
        graph = build_dependency_graph(chunks)

        assert "app/routes.py" in graph
        assert "app/service.py" in graph["app/routes.py"]["uses"]
        # Reverse edge: service.py is used by routes.py
        assert "app/routes.py" in graph["app/service.py"]["used_by"]

    def test_external_imports_ignored(self):
        """Third-party imports (os, fastapi, etc.) must not appear in graph."""
        chunks = [
            _chunk("app/main.py", imports=["os", "fastapi", "sqlalchemy"]),
            _chunk("app/service.py", imports=[]),
        ]
        graph = build_dependency_graph(chunks)
        # No edges to stdlib/third-party
        assert graph == {}

    def test_multiple_files_with_cross_imports(self):
        chunks = [
            _chunk("routes/auth.py",    imports=["app.services.auth"]),
            _chunk("app/services/auth.py", imports=["app.models.user"]),
            _chunk("app/models/user.py",   imports=[]),
        ]
        graph = build_dependency_graph(chunks)

        assert "app/services/auth.py" in graph["routes/auth.py"]["uses"]
        assert "app/models/user.py" in graph["app/services/auth.py"]["uses"]

    def test_circular_dependency_allowed(self):
        """Circular imports are valid in Python — should not raise."""
        chunks = [
            _chunk("a.py", imports=["b"]),
            _chunk("b.py", imports=["a"]),
        ]
        # Should not raise
        graph = build_dependency_graph(chunks)
        assert isinstance(graph, dict)

    def test_deduplicates_import_edges(self):
        """Same file imported twice should produce only one edge."""
        chunks = [
            _chunk("main.py", imports=["app.service", "app.service"]),
            _chunk("app/service.py", imports=[]),
        ]
        graph = build_dependency_graph(chunks)
        uses = graph.get("main.py", {}).get("uses", [])
        assert uses.count("app/service.py") == 1


class TestResolvePython:
    PROJECT = {"app/models.py", "app/service.py", "app/__init__.py"}

    def test_absolute_import(self):
        result = _resolve_python("app.models", "app/routes.py", self.PROJECT)
        assert result == "app/models.py"

    def test_absolute_import_init(self):
        result = _resolve_python("app", "main.py", self.PROJECT)
        assert result == "app/__init__.py"

    def test_relative_import_sibling(self):
        result = _resolve_python(".models", "app/routes.py", self.PROJECT)
        assert result == "app/models.py"

    def test_external_import_returns_none(self):
        result = _resolve_python("os", "app/main.py", self.PROJECT)
        assert result is None

    def test_nonexistent_module_returns_none(self):
        result = _resolve_python("app.missing", "main.py", self.PROJECT)
        assert result is None


class TestResolveJs:
    PROJECT = {"src/auth/service.ts", "src/utils/helpers.ts", "src/index.ts"}

    def test_relative_ts_import(self):
        result = _resolve_js("./service", "src/auth/routes.ts", self.PROJECT)
        assert result == "src/auth/service.ts"

    def test_relative_parent_import(self):
        result = _resolve_js("../utils/helpers", "src/auth/routes.ts", self.PROJECT)
        assert result == "src/utils/helpers.ts"

    def test_bare_specifier_ignored(self):
        """Third-party bare specifiers (react, express) return None."""
        result = _resolve_js("react", "src/app.ts", self.PROJECT)
        assert result is None

    def test_nonexistent_file_returns_none(self):
        result = _resolve_js("./missing", "src/auth/routes.ts", self.PROJECT)
        assert result is None


class TestResolveJava:
    PROJECT = {"com/example/auth/AuthService.java"}

    def test_resolves_class_import(self):
        result = _resolve_java("com.example.auth.AuthService", self.PROJECT)
        assert result == "com/example/auth/AuthService.java"

    def test_nonexistent_class_returns_none(self):
        result = _resolve_java("com.example.missing.Foo", self.PROJECT)
        assert result is None


class TestResolveGo:
    PROJECT = {"pkg/auth/service.go", "pkg/models/user.go"}

    def test_resolves_go_import(self):
        result = _resolve_go("github.com/user/repo/pkg/auth", self.PROJECT)
        assert result is not None
        assert "pkg/auth" in result

    def test_unresolvable_returns_none(self):
        result = _resolve_go("github.com/user/repo/pkg/missing", self.PROJECT)
        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# API Extractor
# ══════════════════════════════════════════════════════════════════════════════

class TestApiExtractor:

    def test_empty_chunks_returns_empty(self):
        assert extract_endpoints([]) == []

    def test_ignores_non_endpoint_chunks(self):
        chunks = [
            _chunk(chunk_type="function"),
            _chunk(chunk_type="class"),
            _chunk(chunk_type="raw"),
        ]
        assert extract_endpoints(chunks) == []

    def test_extracts_endpoint_chunks(self):
        chunk = _chunk(
            chunk_type="endpoint",
            chunk_text='@app.get("/users")\nasync def get_users(): pass',
            function_name="get_users",
        )
        results = extract_endpoints([chunk])
        assert len(results) == 1
        assert results[0]["function_name"] == "get_users"

    def test_result_has_required_fields(self):
        chunk = _chunk(chunk_type="endpoint", chunk_text='@app.post("/items")')
        results = extract_endpoints([chunk])
        assert len(results) == 1
        r = results[0]
        assert "method" in r
        assert "path" in r
        assert "file_path" in r
        assert "function_name" in r
        assert "line" in r
        assert "language" in r

    def test_line_number_correct(self):
        chunk = Chunk(
            chunk_text='@app.get("/users")\nasync def get_users(): pass',
            chunk_type="endpoint",
            language="python",
            language_tier="1",
            file_path="routes/users.py",
            line_start=42,
            line_end=50,
        )
        results = extract_endpoints([chunk])
        assert results[0]["line"] == 42

    def test_multiple_endpoints_returned(self):
        chunks = [
            _chunk(chunk_type="endpoint", chunk_text='@app.get("/users")'),
            _chunk(chunk_type="function"),  # ignored
            _chunk(chunk_type="endpoint", chunk_text='@app.post("/users")'),
            _chunk(chunk_type="endpoint", chunk_text='@app.delete("/users/{id}")'),
        ]
        results = extract_endpoints(chunks)
        assert len(results) == 3


class TestDetectMethod:

    @pytest.mark.parametrize("text,lang,expected", [
        ('@app.get("/users")',  "python", "GET"),
        ('@app.post("/users")', "python", "POST"),
        ('@app.put("/users")',  "python", "PUT"),
        ('@app.delete("/x")',   "python", "DELETE"),
        ('@app.patch("/x")',    "python", "PATCH"),
        ('@GetMapping("/x")',   "java",   "GET"),
        ('@PostMapping("/x")',  "java",   "POST"),
        ('router.get("/x", handler)', "javascript", "GET"),
        ('router.post("/x", h)',      "javascript", "POST"),
        ('r.GET("/x", handler)',      "go",         "GET"),
        ('r.POST("/x", h)',           "go",         "POST"),
    ])
    def test_detects_method(self, text, lang, expected):
        result = _detect_method(text.lower(), lang)
        assert result == expected

    def test_returns_none_for_unknown(self):
        result = _detect_method("function foo() {}", "javascript")
        assert result is None
