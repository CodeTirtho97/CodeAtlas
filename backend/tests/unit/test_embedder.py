"""Unit tests for the embedder — all HTTP calls are mocked via httpx.Client."""
import pytest
from unittest.mock import patch, MagicMock
from typing import List

from app.services.ingestion.chunk import Chunk
from app.services.ingestion.embedder import (
    embed_chunks,
    embed_query,
    _prepare_text,
    EMBEDDING_DIMS,
    BATCH_SIZE,
    _EMBED_MODEL,
    MAX_RETRIES,
    RATE_LIMIT_DELAY,
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

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


def _success_response(count: int = 1) -> MagicMock:
    """HTTP 200 response with `count` embeddings."""
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "embeddings": [{"values": _fake_embedding()} for _ in range(count)]
    }
    resp.text = ""
    resp.headers = {}
    return resp


def _error_response(status: int = 500, body: str = "Internal Server Error") -> MagicMock:
    resp = MagicMock()
    resp.status_code = status
    resp.text = body
    resp.headers = {}
    return resp


def _patch_client(mock_client: MagicMock):
    """Patch httpx.Client so the context manager yields mock_client."""
    patcher = patch("app.services.ingestion.embedder.httpx.Client")
    return patcher


def _wire_client(MockClient, mock_client):
    """Connect MockClient class → instance → context manager → mock_client."""
    MockClient.return_value.__enter__.return_value = mock_client
    MockClient.return_value.__exit__.return_value = False


# ─── _prepare_text ───────────────────────────────────────────────────────────

class TestPrepareText:
    def test_includes_language(self):
        assert "python" in _prepare_text(_make_chunk(language="python"))

    def test_includes_chunk_type(self):
        assert "endpoint" in _prepare_text(_make_chunk(chunk_type="endpoint"))

    def test_includes_function_name(self):
        assert "authenticate_user" in _prepare_text(_make_chunk(function_name="authenticate_user"))

    def test_includes_class_name_when_no_function(self):
        assert "AuthService" in _prepare_text(_make_chunk(function_name=None, class_name="AuthService"))

    def test_includes_file_path(self):
        assert "src/auth/service.py" in _prepare_text(_make_chunk(file_path="src/auth/service.py"))

    def test_includes_chunk_text(self):
        assert "def hello(): pass" in _prepare_text(_make_chunk(text="def hello(): pass"))

    def test_truncates_long_chunk_text(self):
        long_text = "x" * 10_000
        result = _prepare_text(_make_chunk(text=long_text))
        assert len(result) < len(long_text) + 200

    def test_header_on_first_line(self):
        lines = _prepare_text(_make_chunk()).splitlines()
        assert lines[0].startswith("[")
        assert lines[0].endswith("]")


# ─── embed_chunks ─────────────────────────────────────────────────────────────

class TestEmbedChunks:

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_returns_chunk_embedding_pairs(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(1)
        _wire_client(MockClient, mc)

        chunk = _make_chunk()
        results = embed_chunks([chunk])

        assert len(results) == 1
        c, emb = results[0]
        assert c is chunk
        assert len(emb) == EMBEDDING_DIMS

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_multiple_chunks_single_batch(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(5)
        _wire_client(MockClient, mc)

        results = embed_chunks([_make_chunk(text=f"code {i}") for i in range(5)])

        assert len(results) == 5
        mc.post.assert_called_once()

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_splits_into_multiple_batches(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.side_effect = [
            _success_response(BATCH_SIZE),
            _success_response(1),
        ]
        _wire_client(MockClient, mc)

        results = embed_chunks([_make_chunk(text=f"code {i}") for i in range(BATCH_SIZE + 1)])

        assert len(results) == BATCH_SIZE + 1
        assert mc.post.call_count == 2

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_empty_input_returns_empty(self, MockClient, _sleep):
        mc = MagicMock()
        _wire_client(MockClient, mc)

        assert embed_chunks([]) == []
        mc.post.assert_not_called()

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_retries_on_http_error(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.side_effect = [
            _error_response(500),
            _error_response(500),
            _success_response(1),
        ]
        _wire_client(MockClient, mc)

        results = embed_chunks([_make_chunk()])

        assert len(results) == 1
        assert mc.post.call_count == 3

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_raises_when_all_batches_fail(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _error_response(500)
        _wire_client(MockClient, mc)

        with pytest.raises(RuntimeError, match="no results for any batch"):
            embed_chunks([_make_chunk()])

        assert mc.post.call_count == MAX_RETRIES

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_skipped_batch_does_not_cancel_other_batches(self, MockClient, _sleep):
        chunk_a = _make_chunk(text="batch one")
        chunk_b = _make_chunk(text="batch two")

        mc = MagicMock()
        mc.post.side_effect = [_error_response(500)] * MAX_RETRIES + [_success_response(1)]
        _wire_client(MockClient, mc)

        with patch("app.services.ingestion.embedder.BATCH_SIZE", 1):
            results = embed_chunks([chunk_a, chunk_b])

        assert len(results) == 1
        assert results[0][0] is chunk_b

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_payload_uses_retrieval_document_task_type(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(1)
        _wire_client(MockClient, mc)

        embed_chunks([_make_chunk()])

        payload = mc.post.call_args[1]["json"]
        assert payload["requests"][0]["taskType"] == "RETRIEVAL_DOCUMENT"

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_payload_uses_correct_model(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(1)
        _wire_client(MockClient, mc)

        embed_chunks([_make_chunk()])

        payload = mc.post.call_args[1]["json"]
        assert payload["requests"][0]["model"] == _EMBED_MODEL

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_rate_limit_waits_longer_than_base_delay(self, MockClient, mock_sleep):
        mc = MagicMock()
        mc.post.side_effect = [_error_response(429, "quota exceeded"), _success_response(1)]
        _wire_client(MockClient, mc)

        embed_chunks([_make_chunk()])

        durations = [c.args[0] for c in mock_sleep.call_args_list]
        assert any(d >= RATE_LIMIT_DELAY for d in durations)

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_retries_on_network_exception(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.side_effect = [
            Exception("Connection refused"),
            Exception("Connection refused"),
            _success_response(1),
        ]
        _wire_client(MockClient, mc)

        results = embed_chunks([_make_chunk()])
        assert len(results) == 1


# ─── embed_query ──────────────────────────────────────────────────────────────

class TestEmbedQuery:

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_returns_float_list(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(1)
        _wire_client(MockClient, mc)

        result = embed_query("How does authentication work?")

        assert isinstance(result, list)
        assert len(result) == EMBEDDING_DIMS

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_payload_uses_retrieval_query_task_type(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(1)
        _wire_client(MockClient, mc)

        embed_query("some question")

        payload = mc.post.call_args[1]["json"]
        assert payload["requests"][0]["taskType"] == "RETRIEVAL_QUERY"

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_payload_uses_correct_model(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _success_response(1)
        _wire_client(MockClient, mc)

        embed_query("test query")

        payload = mc.post.call_args[1]["json"]
        assert payload["requests"][0]["model"] == _EMBED_MODEL

    @patch("app.services.ingestion.embedder.time.sleep")
    @patch("app.services.ingestion.embedder.httpx.Client")
    def test_raises_on_persistent_failure(self, MockClient, _sleep):
        mc = MagicMock()
        mc.post.return_value = _error_response(500)
        _wire_client(MockClient, mc)

        with pytest.raises(RuntimeError, match="Failed to embed query"):
            embed_query("some question")
