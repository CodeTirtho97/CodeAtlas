import fnmatch
from dataclasses import dataclass
from pathlib import Path
from typing import List


# ─── Skip Rules ──────────────────────────────────────────────────────────────

SKIP_DIRS = {
    "node_modules", "vendor", ".git", "dist", "build", "__pycache__",
    "migrations", ".venv", "venv", "env", "coverage", ".nyc_output",
    ".next", ".nuxt", "out", "target", "bin", "obj", ".idea", ".vscode",
    "eggs", ".eggs", "htmlcov", ".tox", ".mypy_cache", ".pytest_cache",
}

# Glob patterns matched against filename only
SKIP_FILE_PATTERNS = [
    "*.min.js",
    "*.min.css",
    "*-lock.json",       # package-lock.json, yarn-lock.json
    "*.lock",            # poetry.lock, Pipfile.lock, etc.
    "*.pb.go",           # protobuf generated Go
    "*_generated.go",    # generated Go files
    "*.generated.ts",
    "*.d.ts",            # TypeScript declaration files (no logic)
]

BINARY_EXTENSIONS = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
    ".tiff", ".psd", ".ai", ".eps",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    # Archives
    ".zip", ".tar", ".gz", ".bz2", ".rar", ".7z", ".xz",
    # Executables / compiled
    ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".pyc", ".pyo",
    ".o", ".a", ".lib",
    # Fonts
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    # Media
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".flac", ".ogg",
    # Databases
    ".db", ".sqlite", ".sqlite3",
    # Other binary
    ".jar", ".war", ".ear", ".apk", ".ipa",
}

# Max file size to index — skip larger files to avoid memory issues
MAX_FILE_SIZE_BYTES = 1_000_000  # 1 MB

# ─── Language Tier Map ───────────────────────────────────────────────────────

# Maps file extension → (language, tier)
LANGUAGE_TIER_MAP: dict[str, tuple[str, str]] = {
    ".py":   ("python",     "1"),
    ".js":   ("javascript", "1"),
    ".jsx":  ("javascript", "1"),
    ".ts":   ("typescript", "1"),
    ".tsx":  ("typescript", "1"),
    ".java": ("java",       "1"),
    ".go":   ("go",         "1"),
}


# ─── Data Class ──────────────────────────────────────────────────────────────

@dataclass
class FileInfo:
    """Metadata about a file that has passed the filter."""
    path: Path              # absolute path
    relative_path: str      # path relative to repo root (forward slashes)
    language: str           # e.g. "python", "javascript", "raw"
    language_tier: str      # "1" (AST-parsed) or "2" (raw fallback)


# ─── Public API ──────────────────────────────────────────────────────────────

def get_filtered_files(repo_path: Path) -> List[FileInfo]:
    """Walk a cloned repository and return all files eligible for indexing.

    Applies skip dirs, binary extension filter, file pattern filter,
    size filter, and assigns language + tier to each file.

    Args:
        repo_path: Root path of the cloned repository

    Returns:
        Sorted list of FileInfo objects for indexable files
    """
    results: List[FileInfo] = []

    for file_path in sorted(repo_path.rglob("*")):
        if not file_path.is_file():
            continue

        relative = file_path.relative_to(repo_path)

        if _in_skip_dir(relative):
            continue

        if file_path.suffix.lower() in BINARY_EXTENSIONS:
            continue

        if _matches_skip_pattern(file_path.name):
            continue

        if file_path.stat().st_size == 0:
            continue

        if file_path.stat().st_size > MAX_FILE_SIZE_BYTES:
            continue

        language, tier = _detect_language(file_path)

        results.append(FileInfo(
            path=file_path,
            relative_path=str(relative).replace("\\", "/"),
            language=language,
            language_tier=tier,
        ))

    return results


def get_language_stats(files: List[FileInfo]) -> dict:
    """Return a count of files per language for logging / summary."""
    stats: dict[str, int] = {}
    for f in files:
        stats[f.language] = stats.get(f.language, 0) + 1
    return dict(sorted(stats.items(), key=lambda x: x[1], reverse=True))


# ─── Internals ───────────────────────────────────────────────────────────────

def _in_skip_dir(relative: Path) -> bool:
    """Return True if any path component is in the skip-dir set."""
    return any(part in SKIP_DIRS for part in relative.parts)


def _matches_skip_pattern(filename: str) -> bool:
    """Return True if the filename matches any skip glob pattern."""
    return any(fnmatch.fnmatch(filename, pattern) for pattern in SKIP_FILE_PATTERNS)


def _detect_language(file_path: Path) -> tuple[str, str]:
    """Return (language, tier) for a file based on its extension."""
    ext = file_path.suffix.lower()
    return LANGUAGE_TIER_MAP.get(ext, ("raw", "2"))
