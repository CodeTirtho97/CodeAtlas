import os
import re
import shutil
import tempfile
from pathlib import Path

import httpx
from git import Repo
from git.exc import GitCommandError, InvalidGitRepositoryError

# Base temp directory for all cloned repos
TEMP_BASE = Path(tempfile.gettempdir()) / "codeatlas"

# GitHub URL pattern — public repos only (MVP)
_GITHUB_URL_RE = re.compile(
    r"^https://github\.com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$"
)

MAX_FILES = 10_000
# GitHub reports size in KB; reject repos larger than this before cloning.
# Prevents filling the server disk with multi-GB binary repos or malicious inputs.
MAX_REPO_SIZE_KB = 500_000  # 500 MB


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


def _check_github_repo_size(github_url: str) -> None:
    """Hit the GitHub API to check repo size before cloning.

    Raises ClonerError if the repo is too large or inaccessible via the API.
    This prevents filling server disk with multi-GB repos before the file-count
    check can trigger.
    """
    # Extract owner/repo from URL
    parts = github_url.rstrip("/").split("/")
    owner, repo_name = parts[-2], parts[-1]
    api_url = f"https://api.github.com/repos/{owner}/{repo_name}"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                api_url,
                headers={"Accept": "application/vnd.github+json"},
            )
        if resp.status_code == 404:
            raise ClonerError(f"Repository not found or is private: {github_url}")
        if resp.status_code == 403:
            raise ClonerError(f"GitHub API rate limit hit. Please try again in a minute.")
        if resp.status_code != 200:
            # Non-fatal: if the API check fails for any other reason, allow the clone to proceed.
            return

        size_kb = resp.json().get("size", 0)
        if size_kb > MAX_REPO_SIZE_KB:
            raise ClonerError(
                f"Repository is {size_kb // 1024:,} MB which exceeds the "
                f"{MAX_REPO_SIZE_KB // 1024:,} MB size limit."
            )
    except ClonerError:
        raise
    except Exception:
        # Network errors or unexpected API shape — don't block the clone.
        pass


def clone_repo(github_url: str, job_id: str) -> Path:
    """Shallow-clone a GitHub repository to a temporary directory.

    Checks the GitHub API for repo size before cloning to avoid filling
    server disk with oversized or malicious repos.

    Args:
        github_url: Public GitHub URL (https://github.com/owner/repo)
        job_id:     Unique ID for this ingestion job (used as temp dir name)

    Returns:
        Path to the cloned repository directory

    Raises:
        ClonerError: Bad URL, repo not found, private repo, too large, or > MAX_FILES files
    """
    github_url = github_url.rstrip("/")
    validate_github_url(github_url)

    # ── Pre-clone size check via GitHub API ───────────────────────────────────
    _check_github_repo_size(github_url)

    clone_dir = TEMP_BASE / job_id

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
