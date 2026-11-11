"""
style.py — Style extraction, writing rules learning, and skill document export.

Implements:
- style_extract(): SSRF-checked multi-URL fetch + text analysis into StyleCard.
- skills_learn(): Data-driven performance analysis proposing up to 10 Skill rules.
- skills_export(): Assembles active rules into media-desk-voice/SKILL.md and marks them exported.

Requirements: 12.4–12.13
"""

from __future__ import annotations

from html.parser import HTMLParser
import json
import logging
from pathlib import Path
import re
from typing import Any
import uuid

from fastapi import HTTPException

from dashboard.ai import extract_style
from dashboard.harvest import ssrf_check

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTML text stripping helper
# ---------------------------------------------------------------------------

class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._ignore = False
        self.chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in ("script", "style", "noscript", "svg"):
            self._ignore = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in ("script", "style", "noscript", "svg"):
            self._ignore = False

    def handle_data(self, data: str) -> None:
        if not self._ignore:
            text = data.strip()
            if text:
                self.chunks.append(text)


def _extract_plain_text(html_bytes: bytes) -> str:
    """Extract plain text readable content from HTML bytes."""
    try:
        content = html_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = html_bytes.decode("latin-1", errors="replace")

    parser = _TextExtractor()
    try:
        parser.feed(content)
        return " ".join(parser.chunks)
    except Exception:
        # Fallback regex strip
        clean = re.sub(r"<[^>]+>", " ", content)
        return " ".join(clean.split())


# ---------------------------------------------------------------------------
# style_extract() (Requirements 12.4–12.8)
# ---------------------------------------------------------------------------

async def style_extract(
    ctx: Any,
    urls: list[str],
    text: str,
    account_key: str | None = None,
    state: dict | None = None,
    lang: str = "en",
    **kwargs: Any,
) -> dict:
    """Fetch text from URLs via SSRF-safe check, concatenate with text, and extract StyleCard.

    Raises:
        HTTPException(400) if any URL fails fetch or total text < 80 characters.
    """
    collected_text_parts: list[str] = []

    # 1. Fetch each URL with SSRF checks (1.5 MiB, 8s, 4 redirects)
    for u in (urls or []):
        url_clean = (u or "").strip()
        if not url_clean:
            continue
        try:
            raw_bytes = await ssrf_check(url_clean, max_size=1_572_864, timeout=8.0, max_redirects=4)
            plain = _extract_plain_text(raw_bytes)
            if plain:
                collected_text_parts.append(plain)
        except Exception as exc:
            raise HTTPException(400, detail=f"Failed to fetch URL '{url_clean}': {exc}")

    if text and text.strip():
        collected_text_parts.append(text.strip())

    combined_text = "\n\n".join(collected_text_parts).strip()

    # Requirement 12.8: minimum 80 characters
    if len(combined_text) < 80:
        raise HTTPException(
            400,
            detail=f"Text too short for style extraction (found {len(combined_text)} chars, minimum 80 required)",
        )

    # 2. Extract style using LLM
    style_data = await extract_style(ctx, combined_text)

    # 3. Upsert into state
    style_card: dict[str, Any]
    target_id: str

    if state is not None:
        styles = state.setdefault("styles", [])
        existing = None
        if account_key:
            existing = next((s for s in styles if s.get("accountKey") == account_key), None)

        if existing:
            target_id = existing["id"]
            existing.update(style_data)
            existing["accountKey"] = account_key
            style_card = existing
        else:
            target_id = f"style_{uuid.uuid4().hex[:8]}"
            style_card = {
                "id": target_id,
                **style_data,
                "accountKey": account_key,
                "preset": False,
                "category": "Custom",
            }
            styles.append(style_card)

        # Requirement 12.6: set state.activeStyleId to the new card's id
        state["activeStyleId"] = target_id
    else:
        target_id = f"style_{uuid.uuid4().hex[:8]}"
        style_card = {
            "id": target_id,
            **style_data,
            "accountKey": account_key,
            "preset": False,
            "category": "Custom",
        }

    return style_card


# ---------------------------------------------------------------------------
# skills_learn() (Requirement 12.10)
# ---------------------------------------------------------------------------

async def skills_learn(
    ctx: Any,
    state: dict,
    lang: str = "en",
    **kwargs: Any,
) -> list[dict]:
    """Analyze engagement metrics and items to propose up to 10 new Skill rules."""
    metrics = state.get("metrics", [])
    items = state.get("items", [])

    # Gather high-engagement items
    high_performers: list[str] = []
    item_map = {it.get("id"): it for it in items if it.get("id")}

    sorted_metrics = sorted(metrics, key=lambda m: m.get("views", 0) + m.get("likes", 0) * 5, reverse=True)
    for m in sorted_metrics[:5]:
        it_id = m.get("itemId")
        if it_id in item_map:
            it = item_map[it_id]
            title = it.get("title")
            if title and title not in high_performers:
                high_performers.append(title)

    sample_context = "; ".join(high_performers) if high_performers else "general content creation"

    proposed_rules: list[str] = []

    if ctx is not None and hasattr(ctx, "llm") and ctx.llm is not None:
        sys_prompt = (
            "You are a viral social media strategist. Analyze top performing content and formulate "
            "up to 10 practical writing rules/skills that explain their success. "
            "Write each rule in English. Output a JSON list of strings only: "
            '["Rule 1 text", "Rule 2 text", ...]'
        )
        user_prompt = f"Top performing content topics: {sample_context}"

        try:
            resp = await ctx.llm.acomplete(
                prompt=user_prompt,
                system=sys_prompt,
                light=True,
                purpose="content-creation",
                task="skills-learn",
            )
            # Parse list of strings
            m = re.search(r"(\[.*?\])", resp, re.DOTALL)
            if m:
                parsed = json.loads(m.group(1))
                if isinstance(parsed, list):
                    proposed_rules = [str(r) for r in parsed if r][:10]
        except Exception as exc:
            logger.warning("skills_learn LLM call failed (%s); using heuristic rules", exc)

    if not proposed_rules:
        # Default heuristic rules if LLM not present or failed
        proposed_rules = [
            "Open with a high-contrast thesis in the first sentence",
            "Anchor abstract claims with a concrete metric or real-world example",
            "Maintain paragraphs under 3 lines for clean mobile readability",
            "Include a single low-friction actionable takeaway at the conclusion",
            "Use strong active verbs and cut qualifying adverbs",
        ]

    result: list[dict] = []
    skills = state.setdefault("skills", [])
    for rule in proposed_rules[:10]:
        skill = {
            "id": f"skill_{uuid.uuid4().hex[:8]}",
            "text": rule,
            "status": "proposed",
            "sample": False,
        }
        skills.append(skill)
        result.append(skill)

    return result


# ---------------------------------------------------------------------------
# skills_export() (Requirements 12.11–12.13)
# ---------------------------------------------------------------------------

async def skills_export(
    state: dict,
    skills_root: Path,
    lang: str = "en",
    **kwargs: Any,
) -> Path:
    """Export all active skills to media-desk-voice/SKILL.md."""
    skills = state.get("skills", [])

    # Filter active skills
    exportable = [
        s for s in skills
        if isinstance(s, dict)
        and s.get("status") in ("active", "exported")
        and not s.get("sample", False)
    ]

    # Requirement 12.12: raise HTTPException(400) if no active skills exist
    if not exportable:
        raise HTTPException(400, detail="No active skills available to export")

    target_dir = Path(skills_root) / "media-desk-voice"
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "SKILL.md"

    rules_lines = "\n".join(f"- {s.get('text', '')}" for s in exportable)

    title = "Media Desk Writing Guidelines & Rules"
    desc = "Learned and curated writing guidelines exported from Hermes Media Desk"

    content = (
        "---\n"
        "name: media-desk-voice\n"
        f"description: {desc}\n"
        "---\n\n"
        f"# {title}\n\n"
        f"{rules_lines}\n"
    )

    target_file.write_text(content, encoding="utf-8")

    # Requirement 12.13: update exported skills to status: "exported"
    for s in exportable:
        s["status"] = "exported"

    return target_file
