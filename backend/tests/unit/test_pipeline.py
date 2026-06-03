"""Unit tests for the ingestion pipeline — all I/O is mocked."""
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.ingestion.pipeline import run


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _make_chunk(file_path="app/main.py", chunk_type="function"):
    from app.services.ingestion.chunk import Chunk
    return Chunk(
        chunk_text="def foo(): pass",
        chunk_type=chunk_type,
        language="python",
        language_tier="1",
        file_path=file_path,
        line_start=1,
        line_end=2,
    )


def _make_file_info(relative_path="app/main.py"):
    from app.services.ingestion.file_filter import FileInfo
    from pathlib import Path
    return FileInfo(
        path=Path("/tmp/repo") / relative_path,
        relative_path=relative_path,
        language="python",
        language_tier="1",
    )


FAKE_EMBEDDING = [0.1] * 768


# ─── Full Pipeline Mock Test ──────────────────────────────────────────────────

class TestPipelineRun:
    """Test that pipeline.run() calls all steps in order and updates job status."""

    @pytest.mark.asyncio
    @patch("app.services.ingestion.pipeline.cleanup_repo")
    @patch("app.services.ingestion.pipeline.generate_onboarding_guide")
    @patch("app.services.ingestion.pipeline.generate_summary")
    @patch("app.services.ingestion.pipeline.extract_endpoints")
    @patch("app.services.ingestion.pipeline.build_dependency_graph")
    @patch("app.services.ingestion.pipeline.store_in_postgres", new_callable=AsyncMock)
    @patch("app.services.ingestion.pipeline.store_in_qdrant", new_callable=AsyncMock)
    @patch("app.services.ingestion.pipeline.get_qdrant_client", new_callable=AsyncMock)
    @patch("app.services.ingestion.pipeline.embed_chunks")
    @patch("app.services.ingestion.pipeline.parse_all_files")
    @patch("app.services.ingestion.pipeline.get_filtered_files")
    @patch("app.services.ingestion.pipeline.clone_repo")
    @patch("app.services.ingestion.pipeline.AsyncSessionLocal")
    async def test_happy_path_calls_all_steps(
        self,
        mock_session_local,
        mock_clone,
        mock_filter,
        mock_parse,
        mock_embed,
        mock_qdrant_client,
        mock_store_qdrant,
        mock_store_pg,
        mock_dep_graph,
        mock_endpoints,
        mock_summary,
        mock_onboarding,
        mock_cleanup,
    ):
        # Set up mock DB session
        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_local.return_value.__aexit__ = AsyncMock(return_value=False)

        # Make DB queries return mock objects
        mock_job = MagicMock(id=str(uuid.uuid4()), repository_id=str(uuid.uuid4()))
        mock_repo = MagicMock()
        mock_exec_result = MagicMock()
        mock_exec_result.scalar_one_or_none.return_value = mock_job
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        mock_session.commit = AsyncMock()
        mock_session.flush = AsyncMock()

        # Set up pipeline step return values
        from pathlib import Path
        chunk = _make_chunk()
        file_info = _make_file_info()

        mock_clone.return_value = Path("/tmp/repo")
        mock_filter.return_value = [file_info]
        mock_parse.return_value = [chunk]
        mock_embed.return_value = [(chunk, FAKE_EMBEDDING)]
        mock_store_qdrant.return_value = {}
        mock_dep_graph.return_value = {}
        mock_endpoints.return_value = []
        mock_summary.return_value = {"purpose": "test", "stack": [], "architecture": "", "entry_points": []}
        mock_onboarding.return_value = {"steps": [], "core_workflows": [], "learning_path": ""}

        # Run the pipeline
        await run(
            job_id=str(uuid.uuid4()),
            repository_id=str(uuid.uuid4()),
            github_url="https://github.com/test/repo",
        )

        # Verify all steps were called
        mock_clone.assert_called_once()
        mock_filter.assert_called_once()
        mock_parse.assert_called_once()
        mock_embed.assert_called_once()
        mock_store_qdrant.assert_called_once()
        mock_store_pg.assert_called_once()
        mock_dep_graph.assert_called_once()
        mock_endpoints.assert_called_once()
        mock_summary.assert_called_once()
        mock_onboarding.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.ingestion.pipeline.cleanup_repo")
    @patch("app.services.ingestion.pipeline.clone_repo")
    @patch("app.services.ingestion.pipeline.AsyncSessionLocal")
    async def test_cleanup_called_on_clone_failure(
        self,
        mock_session_local,
        mock_clone,
        mock_cleanup,
    ):
        """cleanup_repo must always run, even when cloning fails."""
        from app.services.ingestion.cloner import ClonerError

        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_local.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_exec_result = MagicMock()
        mock_exec_result.scalar_one_or_none.return_value = MagicMock(
            repository_id=str(uuid.uuid4())
        )
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        mock_session.commit = AsyncMock()

        mock_clone.side_effect = ClonerError("Repository not found")
        job_id = str(uuid.uuid4())

        await run(
            job_id=job_id,
            repository_id=str(uuid.uuid4()),
            github_url="https://github.com/bad/repo",
        )

        mock_cleanup.assert_called_once_with(job_id)

    @pytest.mark.asyncio
    @patch("app.services.ingestion.pipeline.cleanup_repo")
    @patch("app.services.ingestion.pipeline.embed_chunks")
    @patch("app.services.ingestion.pipeline.parse_all_files")
    @patch("app.services.ingestion.pipeline.get_filtered_files")
    @patch("app.services.ingestion.pipeline.clone_repo")
    @patch("app.services.ingestion.pipeline.AsyncSessionLocal")
    async def test_cleanup_called_on_mid_pipeline_failure(
        self,
        mock_session_local,
        mock_clone,
        mock_filter,
        mock_parse,
        mock_embed,
        mock_cleanup,
    ):
        """cleanup_repo must run even when a mid-pipeline step fails."""
        from pathlib import Path

        mock_session = AsyncMock()
        mock_session_local.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_local.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_exec_result = MagicMock()
        mock_exec_result.scalar_one_or_none.return_value = MagicMock(
            repository_id=str(uuid.uuid4())
        )
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        mock_session.commit = AsyncMock()

        mock_clone.return_value = Path("/tmp/repo")
        mock_filter.return_value = [_make_file_info()]
        mock_parse.return_value = [_make_chunk()]
        mock_embed.side_effect = RuntimeError("Embedding API down")
        job_id = str(uuid.uuid4())

        await run(
            job_id=job_id,
            repository_id=str(uuid.uuid4()),
            github_url="https://github.com/test/repo",
        )

        mock_cleanup.assert_called_once_with(job_id)
