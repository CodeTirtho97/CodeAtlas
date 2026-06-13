"""Synchronous JSON generation with Gemini primary + Groq fallback.

Shared by the ingestion-time generators (summary, onboarding), which run inline
in the pipeline and so are synchronous. Mirrors the Gemini→Groq fallback used by
the async Q&A pipeline in ``app.services.generation.qa``.

Why gemini-2.0-flash: the 2.5 Flash models enable "thinking" by default, which
consumes the output-token budget on larger structured generations (e.g. the
onboarding guide) and yields empty/truncated JSON. 2.0 Flash is the proven model
for these calls; if it fails for any reason we fall back to Groq.
"""
import json
import logging
from typing import Optional

from google import genai
from google.genai import types as genai_types

from app.core.config import settings

log = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"


def generate_json(
    prompt: str,
    *,
    temperature: float = 0.1,
    label: str = "generation",
) -> Optional[dict]:
    """Generate a JSON object from ``prompt``. Gemini primary, Groq fallback.

    Returns the parsed dict, or None if every provider/attempt failed (callers
    are expected to supply their own fallback content in that case).
    """
    result = _call_gemini(prompt, temperature, label)
    if result is not None:
        return result

    result = _call_groq(prompt, temperature, label)
    if result is not None:
        log.info("%s: recovered via Groq fallback", label)
    return result


def _call_gemini(prompt: str, temperature: float, label: str) -> Optional[dict]:
    if not settings.GOOGLE_API_KEY:
        return None
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    for attempt in range(1, 4):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=temperature,
                ),
            )
            parsed = _parse_json(response.text)
            if parsed is not None:
                return parsed
            # Empty/unparseable (e.g. truncated) — worth another attempt.
            log.warning("%s: Gemini attempt %d/3 returned empty/invalid JSON", label, attempt)
        except Exception as exc:
            log.warning("%s: Gemini attempt %d/3 failed: %s", label, attempt, exc)
    return None


def _call_groq(prompt: str, temperature: float, label: str) -> Optional[dict]:
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import Groq
    except Exception as exc:  # library missing — nothing we can do
        log.warning("%s: groq library unavailable: %s", label, exc)
        return None
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        return _parse_json(response.choices[0].message.content)
    except Exception as exc:
        log.warning("%s: Groq fallback failed: %s", label, exc)
        return None


def _parse_json(text: Optional[str]) -> Optional[dict]:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log.warning("Could not parse LLM JSON: %.200s", text)
        return None
