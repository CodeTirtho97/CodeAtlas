"""Unit tests for the embedder — all Google API calls are mocked."""
import pytest
from unittest.mock import patch, MagicMock, call
from typing import List

from app.services.ingestion.chunk import Chunk
from app.services.ingestion.embedder import (
    embed_chunks,
    embed_query,
    _prepare_text,
    _make_batches,
    EMBEDDING_DIMS,
    BATCH_SIZE,
)


# ─── Fixtures ────────────────────────────────────────────────────────────────

def _fake_embedding(dims: int = EMBEDDING_DIMS) -> List[float]:
    return [0.1] * dims


def _make_chunk(
    text="def foo(): pass",
    chunk_type="function",
    language="python",
    file_path="app/service.py",
    function_name="foo",
    class_name=None,
) -> Chunk:
    return Chunk(
        chunk_text=text,
        chunk_type=chunk_type,
        language=language,
        language_tier="1",
        file_path=file_path,
        line_start=1,
        line_end=2,
        function_name=function_name,
        class_name=class_name,
    )


def _make_embed_response(count: int = 1) -> MagicMock:
    """Build a mock response object matching google-genai's EmbedContentResponse."""
    response = MagicMock()
    response.embeddings = [
        MagicMock(values=_fake_embedding()) for _ in range(count)
    ]
    return response


# ─── _make_batches ───────────────────────────────────────────────────────────

class TestMakeBatches:
    def test_empty_list(self):
        assert _make_batches([], 10) == []

    def test_single_item(self):
        assert _make_batches([1], 10) == [[1]]

    def test_exact_batch_size(self):
        items = list(range(100))
        batches = _make_batches(items, 100)
        assert len(batches) == 1
        assert batches[0] == items

    def test_one_over_batch_size(self):
        items = list(range(101))
        batches = _make_batches(items, 100)
        assert len(batches) == 2
        assert len(batches[0]) == 100
        assert len(batches[1]) == 1

    def test_three_full_batches(self):
        items = list(range(300))
        batches = _make_batches(items, 100)
        assert len(batches) == 3
        assert all(len(b) == 100 for b in batches)

    def test_preserves_order(self):
        items = [10, 20, 30, 40, 50]
        batches = _make_batches(items, 3)
        flat = [x for b in batches for x in b]
        assert flat == items


# ─── _prepare_text ───────────────────────────────────────────────────────────

class TestPrepareText:
    def test_includes_language(self):
        chunk = _make_chunk(language="python")
        assert "python" in _prepare_text(chunk)

    def test_includes_chunk_type(self):
        chunk = _make_chunk(chunk_type="endpoint")
        assert "endpoint" in _prepare_text(chunk)

    def test_includes_function_name(self):
        chunk = _make_chunk(function_name="authenticate_user")
        assert "authenticate_user" in _prepare_text(chunk)

    def test_includes_class_name_when_no_function(self):
        chunk = _make_chunk(function_name=None, class_name="AuthService")
        assert "AuthService" in _prepare_text(chunk)

    def test_includes_file_path(self):
        chunk = _make_chunk(file_path="src/auth/service.py")
        assert "src/auth/service.py" in _prepare_text(chunk)

    def test_includes_chunk_text(self):
        chunk = _make_chunk(text="def hello(): pass")
        assert "def hello(): pass" in _prepare_text(chunk)

    def test_truncates_long_chunk_text(self):
        long_text = "x" * 10_000
        chunk = _make_chunk(text=long_text)
        result = _prepare_text(chunk)
        assert len(result) < len(long_text) + 200

    def test_header_on_first_line(self):
        chunk = _make_chunk()
        lines = _prepare_text(chunk).splitlines()
        assert lines[0].startswith("[")
        assert lines[0].endswith("]")


# ─── embed_chunks ────────────────────────────────────────────────────────────

class TestEmbedChunks:

    @patch("app.services.ingestion.embedder._make_client")
    def test_returns_chunk_embedding_pairs(self, mock_make_client):
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(1)
        mock_make_client.return_value = mock_client

        chunk = _make_chunk()
        results = embed_chunks([chunk])

        assert len(results) == 1
        c, emb = results[0]
        assert c is chunk
        assert len(emb) == EMBEDDING_DIMS

    @patch("app.services.ingestion.embedder._make_client")
    def test_multiple_chunks_in_one_batch(self, mock_make_client):
        chunks = [_make_chunk(text=f"code {i}") for i in range(5)]
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(5)
        mock_make_client.return_value = mock_client

        results = embed_chunks(chunks)

        assert len(results) == 5
        mock_client.models.embed_content.assert_called_once()

    @patch("app.services.ingestion.embedder._make_client")
    def test_batches_at_batch_size_boundary(self, mock_make_client):
        chunks = [_make_chunk(text=f"code {i}") for i in range(BATCH_SIZE + 1)]
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = [
            _make_embed_response(BATCH_SIZE),
            _make_embed_response(1),
        ]
        mock_make_client.return_value = mock_client

        results = embed_chunks(chunks)

        assert len(results) == BATCH_SIZE + 1
        assert mock_client.models.embed_content.call_count == 2

    @patch("app.services.ingestion.embedder._make_client")
    def test_empty_input_returns_empty(self, mock_make_client):
        mock_client = MagicMock()
        mock_make_client.return_value = mock_client

        results = embed_chunks([])

        assert results == []
        mock_client.models.embed_content.assert_not_called()

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder._make_client")
    def test_retries_on_rate_limit(self, mock_make_client, mock_sleep):
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = [
            Exception("429 ResourceExhausted: quota exceeded"),
            Exception("429 ResourceExhausted: quota exceeded"),
            _make_embed_response(1),
        ]
        mock_make_client.return_value = mock_client

        results = embed_chunks([_make_chunk()])

        assert len(results) == 1
        assert mock_client.models.embed_content.call_count == 3
        assert mock_sleep.call_count == 2

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder._make_client")
    def test_skips_batch_after_max_retries(self, mock_make_client, mock_sleep):
        from app.services.ingestion.embedder import MAX_RETRIES
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = Exception("API Error")
        mock_make_client.return_value = mock_client

        results = embed_chunks([_make_chunk()])

        assert results == []
        assert mock_client.models.embed_content.call_count == MAX_RETRIES

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder._make_client")
    def test_failed_batch_does_not_affect_other_batches(
        self, mock_make_client, mock_sleep
    ):
        from app.services.ingestion.embedder import MAX_RETRIES
        chunk_a = _make_chunk(text="batch one")
        chunk_b = _make_chunk(text="batch two")

        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = (
            [Exception("error")] * MAX_RETRIES + [_make_embed_response(1)]
        )
        mock_make_client.return_value = mock_client

        with patch("app.services.ingestion.embedder.BATCH_SIZE", 1):
            results = embed_chunks([chunk_a, chunk_b])

        assert len(results) == 1
        assert results[0][0] is chunk_b

    @patch("app.services.ingestion.embedder._make_client")
    def test_uses_retrieval_document_task_type(self, mock_make_client):
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(1)
        mock_make_client.return_value = mock_client

        embed_chunks([_make_chunk()])

        _, kwargs = mock_client.models.embed_content.call_args
        config = kwargs.get("config")
        assert config.task_type == "RETRIEVAL_DOCUMENT"

    @patch("app.services.ingestion.embedder._make_client")
    def test_uses_correct_model(self, mock_make_client):
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(1)
        mock_make_client.return_value = mock_client

        embed_chunks([_make_chunk()])

        _, kwargs = mock_client.models.embed_content.call_args
        assert kwargs.get("model") == "models/text-embedding-004"


# ─── embed_query ─────────────────────────────────────────────────────────────

class TestEmbedQuery:

    @patch("app.services.ingestion.embedder._make_client")
    def test_returns_embedding_vector(self, mock_make_client):
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(1)
        mock_make_client.return_value = mock_client

        result = embed_query("How does authentication work?")

        assert isinstance(result, list)
        assert len(result) == EMBEDDING_DIMS

    @patch("app.services.ingestion.embedder._make_client")
    def test_uses_retrieval_query_task_type(self, mock_make_client):
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(1)
        mock_make_client.return_value = mock_client

        embed_query("some question")

        _, kwargs = mock_client.models.embed_content.call_args
        config = kwargs.get("config")
        assert config.task_type == "RETRIEVAL_QUERY"

    @patch("app.services.ingestion.embedder._make_client")
    def test_uses_correct_model(self, mock_make_client):
        mock_client = MagicMock()
        mock_client.models.embed_content.return_value = _make_embed_response(1)
        mock_make_client.return_value = mock_client

        embed_query("test")

        _, kwargs = mock_client.models.embed_content.call_args
        assert kwargs.get("model") == "models/text-embedding-004"

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder._make_client")
    def test_raises_on_persistent_failure(self, mock_make_client, mock_sleep):
        mock_client = MagicMock()
        mock_client.models.embed_content.side_effect = Exception("Network error")
        mock_make_client.return_value = mock_client

        with pytest.raises(RuntimeError, match="Failed to embed query"):
            embed_query("some question")
