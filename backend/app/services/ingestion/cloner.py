import os
import re
import shutil
import tempfile
from pathlib import Path

from git import Repo
from git.exc import GitCommandError, InvalidGitRepositoryError

# Base temp directory for all cloned repos
TEMP_BASE = Path(tempfile.gettempdir()) / "codeatlas"

# GitHub URL pattern — public repos only (MVP)
_GITHUB_URL_RE = re.compile(
    r"^https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$"
)

MAX_FILES = 10_000


class ClonerError(Exception):
    """Raised for expected clone failures (bad URL, too large, not found)."""
    pass


def validate_github_url(url: str) -> None:
    """Raise ClonerError if the URL is not a valid public GitHub repo URL."""
    url = url.rstrip("/")
    if not _GITHUB_URL_RE.match(url):
        raise ClonerError(
            f"Invalid GitHub URL: '{url}'. "
            "Expected format: https://github.com/owner/repo"
        )


def clone_repo(github_url: str, job_id: str) -> Path:
    """Shallow-clone a GitHub repository to a temporary directory.

    Args:
        github_url: Public GitHub URL (https://github.com/owner/repo)
        job_id:     Unique ID for this ingestion job (used as temp dir name)

    Returns:
        Path to the cloned repository directory

    Raises:
        ClonerError: Bad URL, repo not found, private repo, or > MAX_FILES files
    """
    github_url = github_url.rstrip("/")
    validate_github_url(github_url)

    clone_dir = TEMP_BASE / job_id

    # Ensure the base temp dir exists, but NOT the clone_dir itself —
    # git requires the target directory to be absent or empty.
    # Also wipes any leftover from a previous failed attempt for the same job.
    TEMP_BASE.mkdir(parents=True, exist_ok=True)
    _cleanup(clone_dir)

    try:
        Repo.clone_from(
            github_url,
            str(clone_dir),
            depth=1,
            single_branch=True,
        )

        file_count = _count_files(clone_dir)
        if file_count > MAX_FILES:
            raise ClonerError(
                f"Repository has {file_count:,} files which exceeds the "
                f"{MAX_FILES:,} file limit."
            )

        return clone_dir

    except GitCommandError as exc:
        _cleanup(clone_dir)
        stderr = str(exc).lower()
        if "not found" in stderr or "could not read" in stderr or "access denied" in stderr:
            raise ClonerError(
                f"Repository not found or is private: {github_url}"
            ) from exc
        raise ClonerError(f"Git clone failed: {exc}") from exc

    except ClonerError:
        _cleanup(clone_dir)
        raise

    except Exception as exc:
        _cleanup(clone_dir)
        raise ClonerError(f"Unexpected error during clone: {exc}") from exc


def cleanup_repo(job_id: str) -> None:
    """Remove the cloned repository temp directory for a given job."""
    _cleanup(TEMP_BASE / job_id)


def _count_files(path: Path) -> int:
    """Count all files recursively under path."""
    return sum(1 for p in path.rglob("*") if p.is_file())


def _cleanup(path: Path) -> None:
    if not path.exists():
        return
    # Git creates read-only files inside .git/ on Windows.
    # The onerror callback chmod's them writable before retrying deletion.
    def _force_writable(func, fpath, _exc_info):
        import stat
        os.chmod(fpath, stat.S_IWRITE)
        func(fpath)

    shutil.rmtree(path, onerror=_force_writable)
