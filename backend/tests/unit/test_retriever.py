"""Unit tests for the retriever and sparse vector module."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.search.sparse import to_sparse_vector, _tokenize, VOCAB_SIZE
from app.services.search.retriever import search, SearchResult


# ══════════════════════════════════════════════════════════════════════════════
# Sparse Vector
# ══════════════════════════════════════════════════════════════════════════════

class TestSparseVector:

    def test_empty_text_returns_empty_vector(self):
        sv = to_sparse_vector("")
        assert sv.indices == []
        assert sv.values == []

    def test_single_word(self):
        sv = to_sparse_vector("authenticate")
        assert len(sv.indices) == 1
        assert len(sv.values) == 1
        assert sv.values[0] == pytest.approx(1.0)

    def test_repeated_tokens_increase_value(self):
        sv_single = to_sparse_vector("auth")
        sv_double = to_sparse_vector("auth auth")
        # Same index, same value (both normalised to 1.0 since only one unique token)
        assert sv_single.indices == sv_double.indices

    def test_multiple_unique_tokens(self):
        sv = to_sparse_vector("authenticate login logout")
        assert len(sv.indices) == 3

    def test_indices_in_vocab_range(self):
        sv = to_sparse_vector("hello world fastapi authentication jwt token")
        for idx in sv.indices:
            assert 0 <= idx < VOCAB_SIZE

    def test_no_duplicate_indices(self):
        sv = to_sparse_vector("the quick brown fox jumps over the lazy dog")
        assert len(sv.indices) == len(set(sv.indices))

    def test_values_are_positive(self):
        sv = to_sparse_vector("function class method")
        assert all(v > 0 for v in sv.values)

    def test_same_text_same_vector(self):
        text = "authenticate user with jwt token"
        sv1 = to_sparse_vector(text)
        sv2 = to_sparse_vector(text)
        assert sv1.indices == sv2.indices
        assert sv1.values == sv2.values

    def test_code_text_produces_vector(self):
        code = "def authenticate_user(username: str, password: str) -> bool:"
        sv = to_sparse_vector(code)
        assert len(sv.indices) > 0

    def test_short_tokens_skipped(self):
        # Single-char tokens should be filtered out
        sv_with = to_sparse_vector("a b c function")
        sv_without = to_sparse_vector("function")
        # "function" should appear in both
        assert len(sv_without.indices) >= 1


class TestTokenize:

    def test_basic_words(self):
        tokens = _tokenize("hello world")
        assert "hello" in tokens
        assert "world" in tokens

    def test_lowercases(self):
        tokens = _tokenize("AuthService UserRepository")
        assert "authservice" in tokens
        assert "userrepository" in tokens

    def test_filters_short_tokens(self):
        tokens = _tokenize("a to the function")
        # "a" (len=1) and "to" (len=2 — kept), "the" (len=3 — kept)
        assert "a" not in tokens

    def test_handles_code_identifiers(self):
        tokens = _tokenize("authenticate_user")
        assert "authenticate_user" in tokens

    def test_empty_string(self):
        assert _tokenize("") == []


# ══════════════════════════════════════════════════════════════════════════════
# Retriever
# ══════════════════════════════════════════════════════════════════════════════

def _make_qdrant_point(file_path="auth/service.py", function_name="authenticate"):
    """Build a mock Qdrant scored point."""
    point = MagicMock()
    point.id = "test-point-id"
    point.score = 0.87
    point.payload = {
        "file_path": file_path,
        "chunk_type": "function",
        "language": "python",
        "function_name": function_name,
        "class_name": None,
        "line_start": 42,
        "line_end": 67,
        "architectural_role": "service",
        "chunk_preview": "def authenticate(self): ...",
    }
    return point


class TestRetriever:

    @pytest.mark.asyncio
    @patch("app.services.search.retriever.embed_query")
    async def test_returns_search_results(self, mock_embed):
        mock_embed.return_value = [0.1] * 768

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = [_make_qdrant_point()]
        mock_client.query_points = AsyncMock(return_value=mock_response)

        results = await search(mock_client, "How does auth work?", "repo-123")

        assert len(results) == 1
        assert isinstance(results[0], SearchResult)
        assert results[0].file_path == "auth/service.py"
        assert results[0].function_name == "authenticate"
        assert results[0].score == pytest.approx(0.87)

    @pytest.mark.asyncio
    @patch("app.services.search.retriever.embed_query")
    async def test_makes_two_separate_searches(self, mock_embed):
        """Retriever calls query_points twice: once with using='' (dense) and once with using='text' (sparse)."""
        mock_embed.return_value = [0.1] * 768

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        mock_client.query_points = AsyncMock(return_value=mock_response)

        await search(mock_client, "authentication flow", "repo-123")

        assert mock_client.query_points.call_count == 2
        using_values = {c.kwargs["using"] for c in mock_client.query_points.call_args_list}
        assert "" in using_values       # dense vector search
        assert "text" in using_values   # sparse vector search

    @pytest.mark.asyncio
    @patch("app.services.search.retriever.embed_query")
    async def test_applies_repository_filter(self, mock_embed):
        mock_embed.return_value = [0.1] * 768

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        mock_client.query_points = AsyncMock(return_value=mock_response)

        await search(mock_client, "question", "my-repo-uuid")

        call_kwargs = mock_client.query_points.call_args[1]
        filt = call_kwargs["query_filter"]
        # Filter must contain repository_id condition
        cond = filt.must[0]
        assert cond.key == "repository_id"
        assert cond.match.value == "my-repo-uuid"

    @pytest.mark.asyncio
    @patch("app.services.search.retriever.embed_query")
    async def test_rrf_merges_dense_and_sparse_results(self, mock_embed):
        """RRF must combine results from both searches; a point in both lists ranks above one in only one."""
        mock_embed.return_value = [0.1] * 768

        # shared_point appears in both dense and sparse → should rank #1 via RRF
        shared_point = _make_qdrant_point(file_path="auth/service.py", function_name="authenticate")
        shared_point.id = "shared-point"

        # dense_only_point appears only in the dense result
        dense_only_point = _make_qdrant_point(file_path="other/module.py", function_name="helper")
        dense_only_point.id = "dense-only-point"

        mock_client = AsyncMock()
        dense_response = MagicMock()
        dense_response.points = [shared_point, dense_only_point]
        sparse_response = MagicMock()
        sparse_response.points = [shared_point]

        # First gather call gets dense_response, second gets sparse_response
        mock_client.query_points = AsyncMock(side_effect=[dense_response, sparse_response])

        results = await search(mock_client, "authenticate", "repo-id")

        file_paths = [r.file_path for r in results]
        # Both results must appear
        assert "auth/service.py" in file_paths
        assert "other/module.py" in file_paths
        # shared_point (in both lists) must rank above dense_only_point (in one list)
        assert results[0].file_path == "auth/service.py"

    @pytest.mark.asyncio
    @patch("app.services.search.retriever.embed_query")
    async def test_empty_results_returns_empty_list(self, mock_embed):
        mock_embed.return_value = [0.1] * 768

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        mock_client.query_points = AsyncMock(return_value=mock_response)

        results = await search(mock_client, "obscure question", "repo-id")
        assert results == []

    @pytest.mark.asyncio
    @patch("app.services.search.retriever.embed_query")
    async def test_respects_top_k(self, mock_embed):
        mock_embed.return_value = [0.1] * 768

        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.points = []
        mock_client.query_points = AsyncMock(return_value=mock_response)

        await search(mock_client, "question", "repo-id", top_k=5)

        call_kwargs = mock_client.query_points.call_args[1]
        assert call_kwargs["limit"] == 5


# ══════════════════════════════════════════════════════════════════════════════
# Q&A Pipeline
# ══════════════════════════════════════════════════════════════════════════════

class TestQAPipeline:

    @pytest.mark.asyncio
    @patch("app.services.generation.qa._call_gemini")
    @patch("app.services.generation.qa.search")
    async def test_returns_answer_and_sources(self, mock_search, mock_gemini):
        from app.services.generation.qa import answer_question

        mock_search.return_value = [
            SearchResult(
                point_id="p1", score=0.9,
                file_path="auth/service.py",
                chunk_type="function", language="python",
                function_name="authenticate_user", class_name=None,
                line_start=42, line_end=67,
                architectural_role="service",
                chunk_preview="def authenticate_user(): ...",
            )
        ]
        mock_gemini.return_value = {
            "answer": "Authentication works by verifying JWT tokens.",
            "sources": [
                {"file_path": "auth/service.py", "function_name": "authenticate_user",
                 "class_name": None, "line_start": 42, "line_end": 67}
            ],
        }

        result = await answer_question(
            client=AsyncMock(),
            question="How does auth work?",
            repository_id="repo-id",
            repo_name="myrepo",
        )

        assert "answer" in result
        assert "sources" in result
        assert len(result["sources"]) == 1
        assert result["sources"][0]["file_path"] == "auth/service.py"

    @pytest.mark.asyncio
    @patch("app.services.generation.qa.search")
    async def test_no_results_returns_fallback(self, mock_search):
        from app.services.generation.qa import answer_question

        mock_search.return_value = []

        result = await answer_question(
            client=AsyncMock(),
            question="What is the meaning of life?",
            repository_id="repo-id",
            repo_name="myrepo",
        )

        assert result["sources"] == []
        assert "couldn't find" in result["answer"].lower()

    @pytest.mark.asyncio
    @patch("app.services.generation.qa._call_gemini")
    @patch("app.services.generation.qa.search")
    async def test_gemini_failure_returns_fallback(self, mock_search, mock_gemini):
        from app.services.generation.qa import answer_question

        mock_search.return_value = [
            SearchResult(
                point_id="p1", score=0.9,
                file_path="main.py", chunk_type="function", language="python",
                function_name="main", class_name=None,
                line_start=1, line_end=10,
                architectural_role=None,
                chunk_preview="def main(): pass",
            )
        ]
        mock_gemini.return_value = None  # Gemini failed

        result = await answer_question(
            client=AsyncMock(),
            question="How does this work?",
            repository_id="repo-id",
            repo_name="myrepo",
        )

        assert result["sources"] == []
        assert result["answer"] != ""

    def test_build_context_annotates_chunks(self):
        from app.services.generation.qa import _build_context

        results = [
            SearchResult(
                point_id="p1", score=0.9,
                file_path="auth/service.py",
                chunk_type="function", language="python",
                function_name="authenticate_user", class_name=None,
                line_start=42, line_end=67,
                architectural_role="service",
                chunk_preview="def authenticate_user(u, p): ...",
            )
        ]
        context = _build_context(results)
        assert "auth/service.py" in context
        assert "authenticate_user" in context
        assert "L42-67" in context
        assert "def authenticate_user" in context
