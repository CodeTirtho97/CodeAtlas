"""RAG Retrieval Evaluation.

Measures how well the hybrid retriever surfaces the correct source files
for questions that have known, deterministic answers — the "golden set."

Golden question generation strategy:
  Each API endpoint in the repo is an implicit golden question:
    Q: "How does the POST /login endpoint work? What does login() do?"
    Expected file: the file that defines that endpoint (e.g. routes/auth.py)

  This requires no manual labelling and zero extra LLM calls — the endpoints
  are already extracted during ingestion.  The retriever should surface the
  defining file in its top-5 results for any reasonable formulation of the
  question.

Metrics:
  Recall@5  — fraction of questions where the expected file appears in top-5.
  MRR       — Mean Reciprocal Rank (1/rank averaged; higher = better).
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from qdrant_client import AsyncQdrantClient

from app.services.search.retriever import search

log = logging.getLogger(__name__)

MAX_GOLDEN = 8   # Cap so the eval finishes in a few seconds


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class QuestionResult:
    question: str
    endpoint: str            # e.g. "POST /login"
    expected_file: str
    retrieved_files: List[str]
    hit: bool                # expected file in top-5
    rank: Optional[int]      # 1-indexed rank, None if not found
    reciprocal_rank: float   # 1/rank or 0.0


@dataclass
class EvalReport:
    recall_at_5: float
    mrr: float
    total_questions: int
    passed: int
    results: List[QuestionResult] = field(default_factory=list)


# ─── Public API ───────────────────────────────────────────────────────────────

async def run_evaluation(
    repo_id: str,
    api_endpoints_json: List[Dict[str, Any]],
    qdrant_client: AsyncQdrantClient,
) -> EvalReport:
    """Run retrieval eval against the repo's extracted API endpoints.

    Args:
        repo_id:            UUID string used to scope Qdrant search.
        api_endpoints_json: List of endpoint dicts from the repository record.
        qdrant_client:      Live Qdrant client.

    Returns:
        EvalReport with per-question results and aggregate Recall@5 / MRR.
    """
    golden = _build_golden_set(api_endpoints_json)

    if not golden:
        log.warning("Eval: no API endpoints found for repo %s — returning empty report", repo_id)
        return EvalReport(recall_at_5=0.0, mrr=0.0, total_questions=0, passed=0)

    results: List[QuestionResult] = []

    for item in golden:
        try:
            hits = await search(qdrant_client, item["question"], repo_id, top_k=5)
        except Exception as exc:
            log.warning("Eval search failed for question %r: %s", item["question"][:60], exc)
            continue

        retrieved_files = [h.file_path for h in hits]
        expected = item["expected_file"]

        hit = expected in retrieved_files
        rank: Optional[int] = None
        if hit:
            rank = retrieved_files.index(expected) + 1
        rr = (1.0 / rank) if rank else 0.0

        results.append(QuestionResult(
            question=item["question"],
            endpoint=item["endpoint"],
            expected_file=expected,
            retrieved_files=retrieved_files,
            hit=hit,
            rank=rank,
            reciprocal_rank=rr,
        ))

    if not results:
        return EvalReport(recall_at_5=0.0, mrr=0.0, total_questions=0, passed=0)

    recall = sum(1 for r in results if r.hit) / len(results)
    mrr = sum(r.reciprocal_rank for r in results) / len(results)
    passed = sum(1 for r in results if r.hit)

    log.info(
        "Eval complete for repo %s: Recall@5=%.2f, MRR=%.2f (%d/%d)",
        repo_id, recall, mrr, passed, len(results),
    )

    return EvalReport(
        recall_at_5=round(recall, 3),
        mrr=round(mrr, 3),
        total_questions=len(results),
        passed=passed,
        results=results,
    )


# ─── Golden-set builder ───────────────────────────────────────────────────────

def _build_golden_set(api_endpoints: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Convert extracted API endpoints into golden {question, expected_file} pairs.

    Only endpoints with a file_path and path are usable.
    Deduplicates by file_path so each source file is tested at most once.
    """
    seen_files: set = set()
    golden: List[Dict[str, str]] = []

    for ep in (api_endpoints or []):
        if not ep:
            continue
        file_path = (ep.get("file_path") or "").strip()
        path = (ep.get("path") or "").strip()
        method = (ep.get("method") or "HTTP").upper()
        fn = ep.get("function_name") or "this endpoint"

        if not file_path or not path:
            continue
        if file_path in seen_files:
            continue
        seen_files.add(file_path)

        question = (
            f"How does the {method} {path} endpoint work? "
            f"What does {fn} do and where is it implemented?"
        )
        golden.append({
            "question": question,
            "expected_file": file_path,
            "endpoint": f"{method} {path}",
        })

        if len(golden) >= MAX_GOLDEN:
            break

    return golden
