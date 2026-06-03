"""
Integration tests for cloner.py — requires network access to GitHub.

Run with:
    pytest tests/integration/test_cloner.py -v

These tests perform real git clones, so they are slower than unit tests.
They are excluded from the default pytest run (see pyproject.toml).
"""
import pytest
from pathlib import Path
from app.services.ingestion.cloner import (
    clone_repo,
    cleanup_repo,
    validate_github_url,
    ClonerError,
    TEMP_BASE,
)


# Small, stable public repo — used for real clone tests
SMALL_TEST_REPO = "https://github.com/octocat/Hello-World"
TEST_JOB_ID = "test-integration-clone-job"


class TestValidateGithubUrl:

    def test_valid_url(self):
        validate_github_url("https://github.com/fastapi/fastapi")  # no error

    def test_valid_url_with_hyphens_and_dots(self):
        validate_github_url("https://github.com/my-org/my.repo")

    def test_rejects_http(self):
        with pytest.raises(ClonerError, match="Invalid GitHub URL"):
            validate_github_url("http://github.com/owner/repo")

    def test_rejects_non_github_domain(self):
        with pytest.raises(ClonerError, match="Invalid GitHub URL"):
            validate_github_url("https://gitlab.com/owner/repo")

    def test_rejects_url_with_trailing_slash(self):
        # trailing slash is stripped, so this should be valid
        validate_github_url("https://github.com/owner/repo/")

    def test_rejects_url_with_subpath(self):
        with pytest.raises(ClonerError, match="Invalid GitHub URL"):
            validate_github_url("https://github.com/owner/repo/tree/main")

    def test_rejects_url_with_query_string(self):
        with pytest.raises(ClonerError, match="Invalid GitHub URL"):
            validate_github_url("https://github.com/owner/repo?tab=readme")

    def test_rejects_bare_domain(self):
        with pytest.raises(ClonerError, match="Invalid GitHub URL"):
            validate_github_url("https://github.com")

    def test_rejects_empty_string(self):
        with pytest.raises(ClonerError, match="Invalid GitHub URL"):
            validate_github_url("")


@pytest.mark.integration
class TestCloneRepo:
    """Network-dependent tests — marked with @pytest.mark.integration."""

    def teardown_method(self):
        """Always clean up after each test."""
        cleanup_repo(TEST_JOB_ID)

    def test_successful_clone(self):
        clone_dir = clone_repo(SMALL_TEST_REPO, TEST_JOB_ID)

        assert clone_dir.exists()
        assert clone_dir.is_dir()
        # A cloned repo always has a README
        assert any(clone_dir.iterdir())

    def test_clone_dir_is_under_temp_base(self):
        clone_dir = clone_repo(SMALL_TEST_REPO, TEST_JOB_ID)
        assert str(clone_dir).startswith(str(TEMP_BASE))

    def test_cleanup_removes_directory(self):
        clone_dir = clone_repo(SMALL_TEST_REPO, TEST_JOB_ID)
        assert clone_dir.exists()

        cleanup_repo(TEST_JOB_ID)
        assert not clone_dir.exists()

    def test_cleanup_is_idempotent(self):
        """Calling cleanup twice should not raise an error."""
        cleanup_repo(TEST_JOB_ID)  # dir doesn't exist — should be fine
        cleanup_repo(TEST_JOB_ID)  # still fine

    def test_invalid_repo_raises_cloner_error(self):
        with pytest.raises(ClonerError, match="not found or is private"):
            clone_repo(
                "https://github.com/this-owner-does-not-exist-xyz/no-repo",
                TEST_JOB_ID,
            )

    def test_cleanup_happens_on_clone_failure(self):
        """Temp directory must be removed even when clone fails."""
        with pytest.raises(ClonerError):
            clone_repo(
                "https://github.com/this-owner-does-not-exist-xyz/no-repo",
                TEST_JOB_ID,
            )

        clone_dir = TEMP_BASE / TEST_JOB_ID
        assert not clone_dir.exists()


@pytest.mark.integration
class TestSizeGuard:
    """Tests the MAX_FILES guard (uses monkeypatching to avoid real large clone)."""

    def test_size_guard_triggers(self, monkeypatch):
        """Mock _count_files to return a value over the limit."""
        import app.services.ingestion.cloner as cloner_module

        # Patch _count_files to simulate a huge repo
        monkeypatch.setattr(cloner_module, "_count_files", lambda path: 10_001)

        with pytest.raises(ClonerError, match="exceeds the 10,000 file limit"):
            clone_repo(SMALL_TEST_REPO, TEST_JOB_ID)

        # Temp dir must be cleaned up
        assert not (TEMP_BASE / TEST_JOB_ID).exists()
