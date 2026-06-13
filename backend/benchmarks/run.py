"""Reproducible micro-benchmarks for the ingestion hot paths.

These regenerate the numbers shown on the Architecture page's "Measured
performance" section, so the claims are backed by something anyone can run:

    cd backend
    python -m benchmarks.run

What it measures (on local hardware — numbers vary by CPU/file mix):
  • parse time per file   — Tree-sitter AST parse → semantic chunks
  • files / second        — parser throughput over the sample
  • sparse vector latency — vocabulary-free, feature-hashed BM25-style TF

It benchmarks against this backend's own source tree, so it needs no network,
database, or API keys. The embedding / Qdrant steps are intentionally excluded
— those are network/infra-bound, not properties of this code.

The three "config facts" on the page (embedding dims, sparse vocab size, the
20+20→10 retrieval pipeline) are constants, not timings; this script prints
them too so the page and the source agree in one place.
"""
from __future__ import annotations

import statistics
import time
from pathlib import Path

from app.services.ingestion.file_filter import get_filtered_files
from app.services.ingestion.parser import parse_file
from app.services.search.sparse import to_sparse_vector
from app.services.ingestion.embedder import EMBEDDING_DIMS
from app.services.search.sparse import VOCAB_SIZE
from app.services.search.retriever import PREFETCH_LIMIT, RRF_K, DEFAULT_TOP_K

BACKEND_ROOT = Path(__file__).resolve().parent.parent   # backend/
SAMPLE_DIR = BACKEND_ROOT / "app"                       # benchmark our own source
WARMUP_FILES = 5                                        # first parse pays init cost
SPARSE_ITERS = 5000
SPARSE_QUERY = "where is user authentication handled and how are passwords hashed"


def _fmt(seconds: float) -> str:
    ms = seconds * 1000
    if ms >= 1:
        return f"{ms:.2f} ms"
    return f"{ms * 1000:.1f} µs"


def bench_parser() -> None:
    files = [f for f in get_filtered_files(SAMPLE_DIR) if f.language_tier == "1"]
    if not files:
        print("  (no tier-1 source files found to benchmark)")
        return

    for f in files[:WARMUP_FILES]:   # warm tree-sitter / parser imports
        parse_file(f)

    per_file: list[float] = []
    total_chunks = 0
    t0 = time.perf_counter()
    for f in files:
        s = time.perf_counter()
        chunks = parse_file(f)
        per_file.append(time.perf_counter() - s)
        total_chunks += len(chunks)
    wall = time.perf_counter() - t0
    n = len(files)

    print("\n── Parser (Tree-sitter AST → chunks) ──")
    print(f"  files parsed       : {n}")
    print(f"  total chunks       : {total_chunks}")
    print(f"  parse time / file  : mean {_fmt(statistics.mean(per_file))}  "
          f"· median {_fmt(statistics.median(per_file))}")
    print(f"  throughput         : {n / wall:,.0f} files / second")


def bench_sparse() -> None:
    for _ in range(200):             # warm-up
        to_sparse_vector(SPARSE_QUERY)

    times: list[float] = []
    for _ in range(SPARSE_ITERS):
        s = time.perf_counter()
        to_sparse_vector(SPARSE_QUERY)
        times.append(time.perf_counter() - s)

    print("\n── Sparse vectorizer (feature-hashed TF, no IDF) ──")
    print(f"  iterations         : {SPARSE_ITERS:,}")
    print(f"  latency / call     : mean {_fmt(statistics.mean(times))}  "
          f"· median {_fmt(statistics.median(times))}")


def print_config_facts() -> None:
    print("\n── Config facts (constants, verified in source) ──")
    print(f"  embedding dims     : {EMBEDDING_DIMS:,}   (EMBEDDING_DIMS, embedder.py)")
    print(f"  sparse hash vocab  : {VOCAB_SIZE:,}   (VOCAB_SIZE, sparse.py)")
    print(f"  retrieval pipeline : {PREFETCH_LIMIT} dense + {PREFETCH_LIMIT} sparse "
          f"→ RRF(k={RRF_K}) → top {DEFAULT_TOP_K}   (retriever.py)")


def main() -> None:
    print("CodeAtlas ingestion benchmarks — local hardware, no network/DB/API keys.")
    print(f"Sample source tree : {SAMPLE_DIR}")
    bench_parser()
    bench_sparse()
    print_config_facts()
    print("\nNote: timing numbers are hardware-dependent. Re-run on your machine to reproduce.")


if __name__ == "__main__":
    main()
