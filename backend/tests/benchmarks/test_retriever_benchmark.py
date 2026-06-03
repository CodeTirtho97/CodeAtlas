"""Performance benchmarks for retriever and parser components.

Run with:
    pytest tests/benchmarks/ --benchmark-only -v

Or with detailed stats:
    pytest tests/benchmarks/ --benchmark-only --benchmark-histogram

These produce the numbers for resume bullet points:
  - Sparse vector generation latency (per chunk)
  - Parser throughput (chunks/second)
  - Context builder latency (per query)

Network-dependent benchmarks (Qdrant, Gemini) are integration-only
and require a running Qdrant instance (see mark: @pytest.mark.integration).
"""
import pytest
from app.services.search.sparse import to_sparse_vector
from app.services.search.retriever import SearchResult
from app.services.generation.qa import _build_context


# ─── Sample Data ─────────────────────────────────────────────────────────────

SMALL_CHUNK = "def authenticate_user(username: str, password: str) -> bool:\n    return True"

MEDIUM_CHUNK = "\n".join([
    "class AuthService:",
    "    def __init__(self, db: Database):",
    "        self.db = db",
    "",
    "    def authenticate(self, username: str, password: str) -> Optional[User]:",
    "        user = self.db.query(User).filter_by(username=username).first()",
    "        if not user or not verify_password(password, user.hashed_password):",
    "            return None",
    "        return user",
    "",
    "    def create_token(self, user: User) -> str:",
    "        return jwt.encode({'sub': str(user.id)}, SECRET_KEY)",
] * 5)  # ~65 lines

LARGE_CHUNK = MEDIUM_CHUNK * 10  # ~650 lines (realistic for a large class)

REALISTIC_CODE_SNIPPETS = [
    f"def function_{i}(arg1, arg2):\n    return arg1 + arg2"
    for i in range(100)
]


# ─── Sparse Vector Benchmarks ─────────────────────────────────────────────────

class TestSparseVectorBenchmarks:

    def test_sparse_small_chunk(self, benchmark):
        """Benchmark: sparse vector for a single small function (~2 lines)."""
        result = benchmark(to_sparse_vector, SMALL_CHUNK)
        assert result.indices  # sanity check

    def test_sparse_medium_chunk(self, benchmark):
        """Benchmark: sparse vector for a medium class (~65 lines)."""
        result = benchmark(to_sparse_vector, MEDIUM_CHUNK)
        assert result.indices

    def test_sparse_large_chunk(self, benchmark):
        """Benchmark: sparse vector for a large class (~650 lines)."""
        result = benchmark(to_sparse_vector, LARGE_CHUNK)
        assert result.indices

    def test_sparse_batch_100_chunks(self, benchmark):
        """Benchmark: sparse vectors for 100 chunks (one ingestion batch)."""
        def batch():
            return [to_sparse_vector(code) for code in REALISTIC_CODE_SNIPPETS]

        results = benchmark(batch)
        assert len(results) == 100


# ─── Parser Benchmarks ────────────────────────────────────────────────────────

PYTHON_SOURCE = """\
import os
from pathlib import Path
from .auth import verify_token
from .models import User


class AuthService:
    def authenticate(self, username: str, password: str) -> bool:
        user = self.db.query(User).filter_by(username=username).first()
        if not user:
            return False
        return verify_password(password, user.hashed_password)

    def create_token(self, user: User) -> str:
        payload = {"sub": str(user.id), "exp": datetime.utcnow() + timedelta(days=7)}
        return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    def verify_token(self, token: str) -> Optional[User]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            return self.db.query(User).get(payload["sub"])
        except jwt.JWTError:
            return None


class UserRepository:
    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).get(user_id)

    def create(self, username: str, email: str) -> User:
        user = User(username=username, email=email)
        self.db.add(user)
        return user


app = FastAPI()
router = APIRouter()


@app.get("/users")
async def get_users():
    return []


@router.post("/users")
async def create_user(data: dict):
    return data
"""


class TestParserBenchmarks:

    def test_python_parser_single_file(self, benchmark):
        """Benchmark: parse a realistic Python file (~50 lines)."""
        from app.services.ingestion.parsers.python_parser import parse

        result = benchmark(parse, "app/auth/service.py", PYTHON_SOURCE)
        assert len(result) > 0

    def test_python_parser_repeated_100x(self, benchmark):
        """Benchmark: simulate parsing 100 Python files (ingestion batch)."""
        from app.services.ingestion.parsers.python_parser import parse

        def parse_batch():
            results = []
            for i in range(100):
                chunks = parse(f"app/service_{i}.py", PYTHON_SOURCE)
                results.extend(chunks)
            return results

        results = benchmark(parse_batch)
        assert len(results) > 0

    def test_fallback_parser_100_line_file(self, benchmark):
        """Benchmark: fallback line-count chunking for a 100-line file."""
        from app.services.ingestion.parsers.fallback_parser import parse

        source = "\n".join(f"line {i}: some content here" for i in range(100))
        result = benchmark(parse, "config.yaml", source)
        assert len(result) == 1

    def test_fallback_parser_1000_line_file(self, benchmark):
        """Benchmark: fallback chunking for a 1000-line file (10 chunks)."""
        from app.services.ingestion.parsers.fallback_parser import parse

        source = "\n".join(f"line {i}: some content here" for i in range(1000))
        result = benchmark(parse, "large_config.yaml", source)
        assert len(result) == 10


# ─── Context Builder Benchmark ────────────────────────────────────────────────

def _make_results(n: int):
    return [
        SearchResult(
            point_id=f"point-{i}",
            score=0.9 - i * 0.01,
            file_path=f"src/module_{i}/service.py",
            chunk_type="function",
            language="python",
            function_name=f"function_{i}",
            class_name=f"Service{i}",
            line_start=i * 10 + 1,
            line_end=i * 10 + 15,
            architectural_role="service",
            chunk_preview=(
                f"def function_{i}(self, arg: str) -> bool:\n"
                f"    # implementation of function {i}\n"
                f"    return True"
            ),
        )
        for i in range(n)
    ]


class TestContextBuilderBenchmarks:

    def test_context_build_top8(self, benchmark):
        """Benchmark: build prompt context for 8 retrieved chunks (default top-K)."""
        results = _make_results(8)
        context = benchmark(_build_context, results)
        assert "function_0" in context

    def test_context_build_top20(self, benchmark):
        """Benchmark: build prompt context for 20 retrieved chunks (max)."""
        results = _make_results(20)
        context = benchmark(_build_context, results)
        assert len(context) > 0
