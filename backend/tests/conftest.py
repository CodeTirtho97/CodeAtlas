import pytest
from pathlib import Path
import tempfile
import os


@pytest.fixture
def tmp_repo(tmp_path: Path) -> Path:
    """Create a minimal fake repository structure for testing."""
    # Tier 1 source files
    (tmp_path / "main.py").write_text("def main(): pass\n")
    (tmp_path / "app.js").write_text("const x = 1;\n")
    (tmp_path / "index.ts").write_text("export const y = 2;\n")
    (tmp_path / "App.tsx").write_text("export default function App() {}\n")
    (tmp_path / "Main.java").write_text("public class Main {}\n")
    (tmp_path / "main.go").write_text("package main\nfunc main() {}\n")

    # Tier 2 / raw files
    (tmp_path / "README.md").write_text("# Readme\n")
    (tmp_path / "Dockerfile").write_text("FROM python:3.11\n")
    (tmp_path / "config.yaml").write_text("key: value\n")

    # Files that should be skipped
    (tmp_path / "bundle.min.js").write_text("!function(e){}\n")
    (tmp_path / "package-lock.json").write_text("{}\n")
    (tmp_path / "poetry.lock").write_text("lock content\n")
    (tmp_path / "image.png").write_bytes(b"\x89PNG\r\n")

    # Directories that should be skipped
    node_modules = tmp_path / "node_modules" / "lodash"
    node_modules.mkdir(parents=True)
    (node_modules / "index.js").write_text("module.exports = {};\n")

    pycache = tmp_path / "__pycache__"
    pycache.mkdir()
    (pycache / "main.cpython-311.pyc").write_bytes(b"\x00\x00\x00\x00")

    vendor = tmp_path / "vendor" / "lib"
    vendor.mkdir(parents=True)
    (vendor / "helper.go").write_text("package lib\n")

    # Nested legitimate files
    src = tmp_path / "src" / "auth"
    src.mkdir(parents=True)
    (src / "service.py").write_text("class AuthService: pass\n")
    (src / "routes.ts").write_text("export const router = {}\n")

    return tmp_path
