import pytest
from pathlib import Path
from app.services.ingestion.file_filter import (
    get_filtered_files,
    get_language_stats,
    FileInfo,
    _in_skip_dir,
    _matches_skip_pattern,
    _detect_language,
)


class TestGetFilteredFiles:

    def test_returns_only_eligible_files(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]

        # Tier 1 source files should be included
        assert "main.py" in names
        assert "app.js" in names
        assert "index.ts" in names
        assert "App.tsx" in names
        assert "Main.java" in names
        assert "main.go" in names

        # Nested files should be included
        assert "src/auth/service.py" in names
        assert "src/auth/routes.ts" in names

    def test_skips_node_modules(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]
        assert not any("node_modules" in n for n in names)

    def test_skips_pycache(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]
        assert not any("__pycache__" in n for n in names)

    def test_skips_vendor(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]
        assert not any("vendor" in n for n in names)

    def test_skips_binary_files(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]
        assert "image.png" not in names

    def test_skips_minified_js(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]
        assert "bundle.min.js" not in names

    def test_skips_lock_files(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        names = [f.relative_path for f in files]
        assert "package-lock.json" not in names
        assert "poetry.lock" not in names

    def test_skips_empty_files(self, tmp_path: Path):
        (tmp_path / "empty.py").write_text("")
        (tmp_path / "real.py").write_text("x = 1")

        files = get_filtered_files(tmp_path)
        names = [f.relative_path for f in files]
        assert "empty.py" not in names
        assert "real.py" in names

    def test_skips_large_files(self, tmp_path: Path):
        # Write a file just over the 1MB limit
        (tmp_path / "huge.py").write_bytes(b"x" * (1_000_001))
        (tmp_path / "fine.py").write_text("x = 1")

        files = get_filtered_files(tmp_path)
        names = [f.relative_path for f in files]
        assert "huge.py" not in names
        assert "fine.py" in names

    def test_relative_paths_use_forward_slashes(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        for f in files:
            assert "\\" not in f.relative_path

    def test_returns_file_info_objects(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        assert all(isinstance(f, FileInfo) for f in files)


class TestLanguageDetection:

    @pytest.mark.parametrize("filename,expected_lang,expected_tier", [
        ("script.py",    "python",     "1"),
        ("app.js",       "javascript", "1"),
        ("comp.jsx",     "javascript", "1"),
        ("index.ts",     "typescript", "1"),
        ("App.tsx",      "typescript", "1"),
        ("Main.java",    "java",       "1"),
        ("server.go",    "go",         "1"),
        ("README.md",    "raw",        "2"),
        ("config.yaml",  "raw",        "2"),
        ("Dockerfile",   "raw",        "2"),
        ("script.sh",    "raw",        "2"),
        ("config.toml",  "raw",        "2"),
    ])
    def test_language_detection(self, tmp_path, filename, expected_lang, expected_tier):
        f = tmp_path / filename
        f.write_text("content")
        lang, tier = _detect_language(f)
        assert lang == expected_lang
        assert tier == expected_tier

    def test_tier1_files_have_correct_language(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        by_name = {f.relative_path: f for f in files}

        assert by_name["main.py"].language == "python"
        assert by_name["main.py"].language_tier == "1"

        assert by_name["app.js"].language == "javascript"
        assert by_name["app.js"].language_tier == "1"

        assert by_name["main.go"].language == "go"
        assert by_name["main.go"].language_tier == "1"

    def test_tier2_files_flagged_as_raw(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        by_name = {f.relative_path: f for f in files}

        assert by_name["README.md"].language == "raw"
        assert by_name["README.md"].language_tier == "2"

        assert by_name["Dockerfile"].language == "raw"
        assert by_name["Dockerfile"].language_tier == "2"


class TestSkipHelpers:

    def test_in_skip_dir_node_modules(self):
        assert _in_skip_dir(Path("node_modules/lodash/index.js")) is True

    def test_in_skip_dir_nested(self):
        assert _in_skip_dir(Path("src/vendor/lib/helper.go")) is True

    def test_in_skip_dir_clean(self):
        assert _in_skip_dir(Path("src/auth/service.py")) is False

    @pytest.mark.parametrize("filename,expected", [
        ("bundle.min.js",     True),
        ("styles.min.css",    True),
        ("package-lock.json", True),
        ("poetry.lock",       True),
        ("server.pb.go",      True),
        ("mock_generated.go", True),
        ("app.js",            False),
        ("main.py",           False),
        ("README.md",         False),
    ])
    def test_matches_skip_pattern(self, filename, expected):
        assert _matches_skip_pattern(filename) is expected


class TestLanguageStats:

    def test_returns_language_counts(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        stats = get_language_stats(files)

        assert "python" in stats
        assert "javascript" in stats
        assert "typescript" in stats
        assert "go" in stats
        assert "java" in stats
        assert "raw" in stats

    def test_counts_are_positive_integers(self, tmp_repo: Path):
        files = get_filtered_files(tmp_repo)
        stats = get_language_stats(files)
        assert all(isinstance(v, int) and v > 0 for v in stats.values())
