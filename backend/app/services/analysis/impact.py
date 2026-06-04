"""Change Impact Analyzer.

Given a symbol (function name, class name, or file path), answers:
  "What will break if I modify this?"

Algorithm:
  1. Find the target file that contains/is the symbol.
  2. BFS over the dependency graph's `used_by` edges to collect
     direct dependents (depth-1) and transitive dependents (depth 2+).
  3. Cross-reference affected files against api_endpoints_json to surface
     which HTTP endpoints are impacted.
  4. Detect test files in the affected set.
  5. Score risk: high / medium / low based on blast radius + API exposure.
  6. Call Gemini for a concise plain-English summary.
"""
import logging
import re
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

from google import genai
from google.genai import types as genai_types
from qdrant_client import AsyncQdrantClient

from app.core.config import settings

log = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"

# BFS limits — avoids runaway traversal on densely connected repos
_MAX_DEPTH = 4
_MAX_FILES = 30

# File patterns treated as test files
_TEST_PATTERNS = re.compile(
    r"(^|/)test[_\-]|[_\-]test\.(py|ts|js|java|go)$"
    r"|\.spec\.(ts|js|tsx|jsx)$"
    r"|(^|/)tests?/",
    re.IGNORECASE,
)


# ─── Public API ───────────────────────────────────────────────────────────────

class ImpactResult:
    def __init__(
        self,
        symbol: str,
        matched_file: Optional[str],
        risk: str,
        direct_dependents: List[str],
        transitive_dependents: List[str],
        affected_endpoints: List[Dict[str, Any]],
        tests_to_run: List[str],
        total_impact: int,
        summary: str,
    ):
        self.symbol = symbol
        self.matched_file = matched_file
        self.risk = risk
        self.direct_dependents = direct_dependents
        self.transitive_dependents = transitive_dependents
        self.affected_endpoints = affected_endpoints
        self.tests_to_run = tests_to_run
        self.total_impact = total_impact
        self.summary = summary


async def analyze_impact(
    symbol: str,
    dependency_json: Dict[str, dict],
    api_endpoints_json: List[Dict[str, Any]],
    repo_name: str,
) -> ImpactResult:
    """Run the full blast-radius analysis for a symbol.

    Args:
        symbol:             Function name, class name, or file path fragment.
        dependency_json:    Repo's pre-built adjacency dict from the DB.
        api_endpoints_json: Repo's extracted API endpoint list from the DB.
        repo_name:          Used in the LLM prompt for context.

    Returns:
        ImpactResult with structured blast-radius data + LLM summary.
    """
    # 1. Find the target file
    target_file = _find_target_file(symbol, dependency_json, api_endpoints_json)

    # 2. BFS over used_by edges
    direct, transitive = ([], [])
    if target_file:
        direct, transitive = _traverse_dependents(target_file, dependency_json)

    # 3. Affected API endpoints
    all_affected: set = set()
    if target_file:
        all_affected.add(target_file)
    all_affected.update(direct)
    all_affected.update(transitive)

    affected_endpoints = [
        ep for ep in (api_endpoints_json or [])
        if ep.get("file_path") in all_affected
    ]

    # 4. Test files
    tests_to_run = sorted(f for f in all_affected if _TEST_PATTERNS.search(f))

    # 5. Risk score
    total_impact = len(direct) + len(transitive)
    if affected_endpoints or total_impact > 5:
        risk = "high"
    elif total_impact >= 2:
        risk = "medium"
    else:
        risk = "low"

    # 6. LLM summary
    summary = await _generate_summary(
        symbol=symbol,
        target_file=target_file,
        direct=direct,
        transitive=transitive,
        affected_endpoints=affected_endpoints,
        risk=risk,
        repo_name=repo_name,
    )

    return ImpactResult(
        symbol=symbol,
        matched_file=target_file,
        risk=risk,
        direct_dependents=direct,
        transitive_dependents=transitive,
        affected_endpoints=affected_endpoints,
        tests_to_run=tests_to_run,
        total_impact=total_impact,
        summary=summary,
    )


# ─── File Finder ─────────────────────────────────────────────────────────────

def _find_target_file(
    symbol: str,
    dep_graph: Dict[str, dict],
    api_endpoints: List[Dict[str, Any]],
) -> Optional[str]:
    """Resolve a symbol to a file path.

    Searches across both the dependency graph keys AND api_endpoints file paths
    so that files with no import relationships are still reachable.
    """
    clean = symbol.strip()
    lower = clean.lower()

    # Union of all known file paths (dep_graph may omit isolated files)
    all_files: set = set(dep_graph.keys())
    for ep in (api_endpoints or []):
        fp = ep.get("file_path")
        if fp:
            all_files.add(fp)

    # Strategy 1: exact file path
    if clean in all_files:
        return clean

    # Strategy 2: substring match on all known file paths (shortest = most specific)
    matches = [fp for fp in all_files if lower in fp.lower()]
    if matches:
        return min(matches, key=len)

    # Strategy 3: exact or partial function_name match in API endpoints
    # Note: JS/TS parsers store route paths in function_name (e.g. "/login"),
    # so we strip leading slashes before comparing.
    for ep in (api_endpoints or []):
        raw_fn = ep.get("function_name") or ""
        fn = raw_fn.lstrip("/").lower()
        if fn and fn == lower:
            fp = ep.get("file_path")
            if fp:
                return fp

    # Strategy 4: partial function_name match (symbol is contained in name or vice versa)
    for ep in (api_endpoints or []):
        raw_fn = ep.get("function_name") or ""
        fn = raw_fn.lstrip("/").lower()
        if fn and (lower in fn or fn in lower):
            fp = ep.get("file_path")
            if fp:
                return fp

    # Strategy 5: basename match across all known files
    _STRIP_EXTS = (".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go")
    for fp in all_files:
        basename = fp.split("/")[-1]
        for ext in _STRIP_EXTS:
            basename = basename.replace(ext, "")
        if basename.lower() == lower:
            return fp

    return None


# ─── BFS Traversal ───────────────────────────────────────────────────────────

def _traverse_dependents(
    target: str,
    dep_graph: Dict[str, dict],
) -> Tuple[List[str], List[str]]:
    """BFS over `used_by` edges from the target file.

    Returns (direct_dependents, transitive_dependents).
    Direct  = depth 1 (files that directly import the target).
    Transitive = depth 2+ (files that import those importers, etc.).
    """
    direct: List[str] = []
    transitive: List[str] = []
    visited = {target}

    queue: deque = deque()

    # Seed with depth-1 neighbours
    for f in dep_graph.get(target, {}).get("used_by", []):
        if f not in visited:
            visited.add(f)
            direct.append(f)
            queue.append((f, 1))

    # BFS for deeper levels
    while queue and len(visited) <= _MAX_FILES:
        node, depth = queue.popleft()
        if depth >= _MAX_DEPTH:
            continue
        for neighbour in dep_graph.get(node, {}).get("used_by", []):
            if neighbour not in visited:
                visited.add(neighbour)
                transitive.append(neighbour)
                queue.append((neighbour, depth + 1))

    return sorted(direct), sorted(transitive)


# ─── LLM Summary ─────────────────────────────────────────────────────────────

_IMPACT_PROMPT = """\
You are a senior software engineer analysing the impact of a code change.

Symbol being changed: {symbol}
Repository: {repo_name}
Target file: {target_file}
Risk level: {risk}

Direct dependents (files that import the target):
{direct}

Transitive dependents (files affected indirectly):
{transitive}

API endpoints exposed by affected files:
{endpoints}

Write a 2-3 sentence plain English summary that explains:
- What could break
- Which parts of the system are most at risk
- What a developer should check before merging this change

Return ONLY the plain text summary. No markdown, no bullet points, no JSON.
"""


async def _generate_summary(
    symbol: str,
    target_file: Optional[str],
    direct: List[str],
    transitive: List[str],
    affected_endpoints: List[Dict],
    risk: str,
    repo_name: str,
) -> str:
    endpoint_strs = [
        f"{ep.get('method', '?')} {ep.get('path', '?')}"
        for ep in affected_endpoints
    ] or ["none"]

    prompt = _IMPACT_PROMPT.format(
        symbol=symbol,
        repo_name=repo_name,
        target_file=target_file or "unknown",
        risk=risk,
        direct="\n".join(f"  - {f}" for f in direct) or "  none",
        transitive="\n".join(f"  - {f}" for f in transitive) or "  none",
        endpoints="\n".join(f"  - {e}" for e in endpoint_strs),
    )

    try:
        client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=256,
            ),
        )
        return (response.text or "").strip()
    except Exception as exc:
        log.warning("Gemini impact summary failed: %s", exc)
        total = len(direct) + len(transitive)
        return (
            f"Changing {symbol} affects {total} file(s) in this repository. "
            f"Risk is rated {risk}. "
            f"Review the listed dependents before merging."
        )
