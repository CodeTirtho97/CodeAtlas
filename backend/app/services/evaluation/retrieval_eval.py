"""RAG Retrieval Evaluation.

Measures how well the hybrid retriever surfaces the correct source files
for a diverse golden question set built from the repository's own metadata.

Question types generated:
  endpoint   — "How does the POST /login endpoint work?"
  paraphrase — "Where is /login handled?", "Show me the implementation of login()"
  class      — "What does AuthService do?" (from dep-graph keys)
  import     — "Which files depend on auth/service.py?" (from dep-graph used_by edges)

Ablation mode:
  Runs the same golden set against dense-only, sparse-only, and hybrid search.
  This lets you prove hybrid search earns its complexity with measured data.

Generation-quality layer:
  For each golden question the QA pipeline is also run; citation precision
  measures whether the LLM's cited sources include the expected file.

Metrics per mode:
  Recall@5       — fraction of questions where expected file is in top-5
  MRR            — Mean Reciprocal Rank
  Citation prec. — fraction where expected file appears in LLM's source list
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from qdrant_client import AsyncQdrantClient

from app.services.search.retriever import search, SearchMode

log = logging.getLogger(__name__)

MAX_GOLDEN = 20

# Question templates per type
_ENDPOINT_TEMPLATES = [
    "{method} {path} endpoint — how does {fn} work and where is it implemented?",
    "Where is the {path} route handled?",
    "Show me the implementation of {fn}.",
]

_CLASS_TEMPLATE = "What does {class_name} do and what are its responsibilities?"
_IMPORT_TEMPLATE = "Which files depend on {file_path}?"


# ─── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class QuestionResult:
    question: str
    question_type: str        # "endpoint" | "paraphrase" | "class" | "import"
    expected_file: str
    retrieved_files: List[str]
    hit: bool
    rank: Optional[int]
    reciprocal_rank: float
    endpoint: str = ""        # e.g. "POST /login" (empty for non-endpoint types)
    # Generation-quality fields
    answer: Optional[str] = None
    citation_hit: bool = False  # expected_file appears in LLM's cited sources


@dataclass
class AblationResult:
    mode: str
    recall_at_5: float
    mrr: float
    total_questions: int
    passed: int


@dataclass
class EvalReport:
    recall_at_5: float
    mrr: float
    total_questions: int
    passed: int
    results: List[QuestionResult] = field(default_factory=list)
    # Ablation: dense-only / sparse-only / hybrid side-by-side
    ablation: List[AblationResult] = field(default_factory=list)
    # Generation quality
    citation_precision: Optional[float] = None


# ─── Public API ───────────────────────────────────────────────────────────────

async def run_evaluation(
    repo_id: str,
    api_endpoints_json: List[Dict[str, Any]],
    qdrant_client: AsyncQdrantClient,
    dependency_json: Optional[Dict[str, Any]] = None,
    run_ablation: bool = True,
    run_generation_quality: bool = True,
) -> EvalReport:
    """Run retrieval eval with diverse question types, ablation, and citation check.

    Args:
        repo_id:              UUID string used to scope Qdrant search.
        api_endpoints_json:   Endpoint list from the repository record.
        qdrant_client:        Live Qdrant client.
        dependency_json:      Dependency graph for class/import questions.
        run_ablation:         Whether to run dense-only and sparse-only passes.
        run_generation_quality: Whether to run QA pipeline for citation precision.
    """
    golden = _build_golden_set(api_endpoints_json, dependency_json)

    if not golden:
        log.warning("Eval: no golden questions built for repo %s", repo_id)
        return EvalReport(recall_at_5=0.0, mrr=0.0, total_questions=0, passed=0)

    # ── Hybrid pass (primary) ─────────────────────────────────────────────────
    results = await _run_pass(golden, repo_id, qdrant_client, mode=SearchMode.HYBRID)

    if not results:
        return EvalReport(recall_at_5=0.0, mrr=0.0, total_questions=0, passed=0)

    recall = sum(1 for r in results if r.hit) / len(results)
    mrr = sum(r.reciprocal_rank for r in results) / len(results)
    passed = sum(1 for r in results if r.hit)

    # ── Ablation passes ───────────────────────────────────────────────────────
    ablation: List[AblationResult] = []
    if run_ablation:
        ablation.append(AblationResult(
            mode="hybrid",
            recall_at_5=round(recall, 3),
            mrr=round(mrr, 3),
            total_questions=len(results),
            passed=passed,
        ))
        for mode in (SearchMode.DENSE_ONLY, SearchMode.SPARSE_ONLY):
            abl_results = await _run_pass(golden, repo_id, qdrant_client, mode=mode)
            if abl_results:
                abl_recall = sum(1 for r in abl_results if r.hit) / len(abl_results)
                abl_mrr = sum(r.reciprocal_rank for r in abl_results) / len(abl_results)
                ablation.append(AblationResult(
                    mode=mode.value,
                    recall_at_5=round(abl_recall, 3),
                    mrr=round(abl_mrr, 3),
                    total_questions=len(abl_results),
                    passed=sum(1 for r in abl_results if r.hit),
                ))

    # ── Generation-quality pass (citation precision) ──────────────────────────
    citation_precision: Optional[float] = None
    if run_generation_quality:
        results, citation_precision = await _run_citation_check(
            results, repo_id, qdrant_client
        )

    log.info(
        "Eval repo %s: Recall@5=%.2f MRR=%.2f (%d/%d) citation_prec=%s",
        repo_id, recall, mrr, passed, len(results),
        f"{citation_precision:.2f}" if citation_precision is not None else "n/a",
    )

    return EvalReport(
        recall_at_5=round(recall, 3),
        mrr=round(mrr, 3),
        total_questions=len(results),
        passed=passed,
        results=results,
        ablation=ablation,
        citation_precision=round(citation_precision, 3) if citation_precision is not None else None,
    )


# ─── Golden-set builder ───────────────────────────────────────────────────────

def _build_golden_set(
    api_endpoints: Optional[List[Dict[str, Any]]],
    dependency_json: Optional[Dict[str, Any]],
) -> List[Dict[str, str]]:
    """Build a diverse golden set from endpoints + dependency graph."""
    golden: List[Dict[str, str]] = []

    # ── Endpoint questions (3 templates each, 1 file = 1 canonical question) ─
    seen_files: set = set()
    for ep in (api_endpoints or []):
        if not ep:
            continue
        file_path = (ep.get("file_path") or "").strip()
        path = (ep.get("path") or "").strip()
        method = (ep.get("method") or "HTTP").upper()
        fn = ep.get("function_name") or "this endpoint"
        if not file_path or not path:
            continue

        is_first = file_path not in seen_files
        seen_files.add(file_path)

        # Primary endpoint question
        golden.append({
            "question": _ENDPOINT_TEMPLATES[0].format(method=method, path=path, fn=fn),
            "expected_file": file_path,
            "endpoint": f"{method} {path}",
            "question_type": "endpoint",
        })

        # Paraphrase variants (only for the first endpoint per file to avoid saturation)
        if is_first and len(golden) < MAX_GOLDEN - 2:
            golden.append({
                "question": _ENDPOINT_TEMPLATES[1].format(method=method, path=path, fn=fn),
                "expected_file": file_path,
                "endpoint": f"{method} {path}",
                "question_type": "paraphrase",
            })
            golden.append({
                "question": _ENDPOINT_TEMPLATES[2].format(method=method, path=path, fn=fn),
                "expected_file": file_path,
                "endpoint": f"{method} {path}",
                "question_type": "paraphrase",
            })

        if len(golden) >= MAX_GOLDEN:
            break

    # ── Class-based questions from dep-graph basename heuristic ───────────────
    if dependency_json and len(golden) < MAX_GOLDEN:
        for file_path in list(dependency_json.keys()):
            if len(golden) >= MAX_GOLDEN:
                break
            basename = file_path.split("/")[-1]
            for ext in (".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go"):
                basename = basename.replace(ext, "")
            # CamelCase heuristic → treat as a class name candidate
            if basename and basename[0].isupper() and len(basename) > 3:
                golden.append({
                    "question": _CLASS_TEMPLATE.format(class_name=basename),
                    "expected_file": file_path,
                    "endpoint": "",
                    "question_type": "class",
                })

    # ── Import-based questions (files that are heavily used) ──────────────────
    if dependency_json and len(golden) < MAX_GOLDEN:
        # Pick files that have ≥2 dependents — they're likely shared utilities
        hub_files = [
            fp for fp, info in dependency_json.items()
            if len((info or {}).get("used_by", [])) >= 2
        ]
        for file_path in hub_files[:3]:
            if len(golden) >= MAX_GOLDEN:
                break
            golden.append({
                "question": _IMPORT_TEMPLATE.format(file_path=file_path),
                "expected_file": file_path,
                "endpoint": "",
                "question_type": "import",
            })

    return golden[:MAX_GOLDEN]


# ─── Search pass ──────────────────────────────────────────────────────────────

async def _run_pass(
    golden: List[Dict[str, str]],
    repo_id: str,
    qdrant_client: AsyncQdrantClient,
    mode: "SearchMode",
) -> List[QuestionResult]:
    results: List[QuestionResult] = []

    for item in golden:
        try:
            hits = await search(
                qdrant_client, item["question"], repo_id, top_k=5, mode=mode
            )
        except Exception as exc:
            log.warning("Eval search failed for %r (%s): %s", item["question"][:60], mode, exc)
            continue

        retrieved_files = [h.file_path for h in hits]
        expected = item["expected_file"]
        hit = expected in retrieved_files
        rank: Optional[int] = retrieved_files.index(expected) + 1 if hit else None
        rr = (1.0 / rank) if rank else 0.0

        results.append(QuestionResult(
            question=item["question"],
            question_type=item.get("question_type", "endpoint"),
            endpoint=item.get("endpoint", ""),
            expected_file=expected,
            retrieved_files=retrieved_files,
            hit=hit,
            rank=rank,
            reciprocal_rank=rr,
        ))

    return results


# ─── Citation precision ───────────────────────────────────────────────────────

async def _run_citation_check(
    results: List[QuestionResult],
    repo_id: str,
    qdrant_client: AsyncQdrantClient,
) -> tuple:
    """Run QA pipeline on each question; check whether expected_file is cited."""
    from app.services.generation.qa import answer_question

    citation_hits = 0
    checked = 0

    for r in results:
        try:
            qa = await answer_question(
                client=qdrant_client,
                question=r.question,
                repository_id=repo_id,
                repo_name="eval",
                top_k=5,
            )
            r.answer = qa.get("answer", "")
            cited_files = {s.get("file_path", "") for s in qa.get("sources", [])}
            r.citation_hit = r.expected_file in cited_files
            if r.citation_hit:
                citation_hits += 1
            checked += 1
        except Exception as exc:
            log.warning("Citation check failed for %r: %s", r.question[:60], exc)

    citation_precision = citation_hits / checked if checked else None
    return results, citation_precision
