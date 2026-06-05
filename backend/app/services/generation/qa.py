"""Question-Answering pipeline.

Flow:
  1. Embed query (RETRIEVAL_QUERY)
  2. Hybrid search → top-K chunks with metadata
  3. Build context string from retrieved chunks
  4. Gemini prompt → structured JSON {answer, sources}
  5. Return answer text + source citations

The context passed to Gemini is annotated so the model can cite
specific file/function/line references in its answer.
"""
import json
import logging
from typing import List, Optional

from google import genai
from google.genai import types as genai_types
from qdrant_client import AsyncQdrantClient

from app.core.config import settings
from app.services.search.retriever import SearchResult, search

log = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_TOP_K = 10

# Reuse a single async client across all requests
_gemini_client: Optional[genai.Client] = None

def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _gemini_client

_QA_PROMPT = """\
You are an expert on the {repo_name} codebase.

Answer the developer's question using ONLY the code context provided below.
Be specific: reference the exact functions, classes, and files from the context.

After your explanation, list every source chunk you actually used.

Return a JSON object with exactly these fields:
{{
  "answer": "<full natural-language explanation, markdown allowed>",
  "sources": [
    {{
      "file_path": "<exact file path from context>",
      "function_name": "<function or null>",
      "class_name": "<class or null>",
      "line_start": <number or null>,
      "line_end": <number or null>
    }}
  ]
}}

Only include sources you actually referenced in the answer.
If the context does not contain enough information, say so in the answer field.

---
Question: {question}

---
Code Context:
{context}

Return ONLY the JSON object.
"""

_QA_PROMPT_WITH_HISTORY = """\
You are an expert on the {repo_name} codebase.

You are having a conversation with a developer. Below is the conversation history,
followed by the current question and code context.

Use the history to understand context and provide coherent follow-up answers.
Answer using ONLY the code context provided below.
Be specific: reference exact functions, classes, and files.

After your explanation, list every source chunk you actually used.

Return a JSON object with exactly these fields:
{{
  "answer": "<full natural-language explanation, markdown allowed>",
  "sources": [
    {{
      "file_path": "<exact file path from context>",
      "function_name": "<function or null>",
      "class_name": "<class or null>",
      "line_start": <number or null>,
      "line_end": <number or null>
    }}
  ]
}}

Only include sources you actually referenced in the answer.
If the context does not contain enough information, say so in the answer field.

---
CONVERSATION HISTORY:
{history}

---
CURRENT QUESTION: {question}

---
CODE CONTEXT:
{context}

Return ONLY the JSON object.
"""


# ─── Public API ──────────────────────────────────────────────────────────────

async def answer_question(
    client: AsyncQdrantClient,
    question: str,
    repository_id: str,
    repo_name: str,
    top_k: int = DEFAULT_TOP_K,
) -> dict:
    """Run the full Q&A pipeline for one question.

    Returns:
        {
          "answer": str,
          "sources": [{file_path, function_name, class_name, line_start, line_end}]
        }
    """
    # 1. Retrieve relevant chunks
    results = await search(client, question, repository_id, top_k=top_k)

    if not results:
        return {
            "answer": (
                "I couldn't find relevant context for this question "
                "in the indexed repository. Try rephrasing or ask about "
                "a specific file or function."
            ),
            "sources": [],
        }

    # 2. Build annotated context string
    context = _build_context(results)

    # 3. Call Gemini
    prompt = _QA_PROMPT.format(
        repo_name=repo_name,
        question=question,
        context=context,
    )

    raw = await _call_gemini(prompt)
    if raw is None:
        return {
            "answer": "Unable to generate an answer at this time. Please try again.",
            "sources": [],
        }

    # 4. Enrich sources with metadata from search results
    enriched_sources = _enrich_sources(raw.get("sources", []), results)

    return {
        "answer": raw.get("answer", ""),
        "sources": enriched_sources,
    }


async def answer_with_history(
    client: AsyncQdrantClient,
    question: str,
    repository_id: str,
    repo_name: str,
    history: List[dict],
    top_k: int = DEFAULT_TOP_K,
) -> dict:
    """Run the Q&A pipeline with conversation history for chat context.

    Args:
        client: Qdrant async client
        question: Current question from user
        repository_id: Repository UUID string
        repo_name: Repository name for context
        history: List of prior messages [{"role": "user"|"assistant", "content": str}, ...]
        top_k: Number of chunks to retrieve

    Returns:
        {
          "answer": str,
          "sources": [{file_path, function_name, class_name, line_start, line_end}]
        }
    """
    # 1. Retrieve relevant chunks
    results = await search(client, question, repository_id, top_k=top_k)

    if not results:
        return {
            "answer": (
                "I couldn't find relevant context for this question "
                "in the indexed repository. Try rephrasing or ask about "
                "a specific file or function."
            ),
            "sources": [],
        }

    # 2. Build annotated context string
    context = _build_context(results)

    # 3. Format conversation history
    history_text = ""
    if history:
        history_lines = []
        for msg in history:
            role_label = "Developer" if msg["role"] == "user" else "Assistant"
            history_lines.append(f"{role_label}: {msg['content']}")
        history_text = "\n".join(history_lines)

    # 4. Call Gemini with history-aware prompt
    prompt = _QA_PROMPT_WITH_HISTORY.format(
        repo_name=repo_name,
        history=history_text,
        question=question,
        context=context,
    )

    raw = await _call_gemini(prompt)
    if raw is None:
        return {
            "answer": "Unable to generate an answer at this time. Please try again.",
            "sources": [],
        }

    # 5. Enrich sources with metadata from search results
    enriched_sources = _enrich_sources(raw.get("sources", []), results)

    return {
        "answer": raw.get("answer", ""),
        "sources": enriched_sources,
    }


# ─── Context Builder ─────────────────────────────────────────────────────────

def _build_context(results: List[SearchResult]) -> str:
    """Annotate retrieved chunks so Gemini can cite exact locations."""
    parts = []
    for i, r in enumerate(results, 1):
        # Build a citation header the model can reference
        name = r.function_name or r.class_name or "module"
        loc = f"L{r.line_start}-{r.line_end}" if r.line_start else ""
        header = f"[{i}] {r.file_path} — {name}  {loc}"
        parts.append(f"{header}\n```{r.language}\n{r.chunk_preview}\n```")
    return "\n\n".join(parts)


# ─── Source Enrichment ────────────────────────────────────────────────────────

def _enrich_sources(
    raw_sources: list,
    search_results: List[SearchResult],
) -> List[dict]:
    """Fill in missing metadata for cited sources from search results."""
    # Build lookup: file_path + function_name → SearchResult
    lookup: dict[str, SearchResult] = {}
    for r in search_results:
        key = f"{r.file_path}:{r.function_name or r.class_name or ''}"
        lookup[key] = r

    enriched = []
    seen = set()

    for source in raw_sources:
        fp = source.get("file_path", "")
        fn = source.get("function_name") or source.get("class_name") or ""
        key = f"{fp}:{fn}"

        if key in seen:
            continue
        seen.add(key)

        # Fill gaps from search result metadata
        matched = lookup.get(key)
        enriched.append({
            "file_path":     fp,
            "function_name": source.get("function_name"),
            "class_name":    source.get("class_name"),
            "line_start":    source.get("line_start") or (matched.line_start if matched else None),
            "line_end":      source.get("line_end")   or (matched.line_end   if matched else None),
            "chunk_type":    matched.chunk_type    if matched else None,
            "chunk_preview": matched.chunk_preview if matched else None,
        })

    return enriched


# ─── Gemini Call ─────────────────────────────────────────────────────────────

async def _call_gemini(prompt: str) -> Optional[dict]:
    client = _get_gemini_client()

    for attempt in range(1, 4):
        try:
            response = await client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                    # Disable extended thinking — context is already retrieved;
                    # deep reasoning adds minutes of latency with no benefit here.
                    thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
                ),
            )
            return _parse_json(response.text)
        except Exception as exc:
            log.warning("Gemini Q&A attempt %d/3 failed: %s", attempt, exc)

    return None


def _parse_json(text: str) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Could not parse Gemini JSON: %.200s", text)
        return None
