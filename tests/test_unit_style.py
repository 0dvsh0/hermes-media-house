"""
Unit tests for dashboard/style.py — style extraction, skills learning, and skills export.

Requirements: 12.4–12.13
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import sys
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
import pytest

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.style import (  # noqa: E402
    skills_export,
    skills_learn,
    style_extract,
)


def _run(coro):
    return asyncio.run(coro)


def test_style_extract_too_short():
    ctx = MagicMock()
    with pytest.raises(HTTPException) as exc:
        _run(style_extract(ctx, urls=[], text="Short text", account_key=None, lang="en"))

    assert exc.value.status_code == 400
    assert "too short" in exc.value.detail.lower()


def test_style_extract_url_failure():
    ctx = MagicMock()
    with patch("dashboard.style.ssrf_check", new_callable=AsyncMock) as mock_ssrf:
        mock_ssrf.side_effect = HTTPException(400, detail="SSRF blocked")
        with pytest.raises(HTTPException) as exc:
            _run(style_extract(ctx, urls=["https://bad-url.com"], text="More filler text " * 10, account_key=None, lang="en"))

        assert exc.value.status_code == 400
        assert "bad-url.com" in exc.value.detail


def test_style_extract_success_and_upsert():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(
        return_value="""```json
        {
            "name": "Tech Voice",
            "tone": "Direct",
            "sentences": "Concise",
            "opening": "Stat",
            "structure": "A -> B",
            "words": ["tech"],
            "avoid": ["fluff"],
            "samples": "Here is a sample line."
        }
        ```"""
    )

    state = {"styles": [], "activeStyleId": None}
    sample_text = "This is a detailed writing sample text that easily exceeds eighty characters in total length for proper testing."

    card = _run(style_extract(ctx, urls=[], text=sample_text, account_key="acc_1", lang="en", state=state))

    assert card["name"] == "Tech Voice"
    assert card["accountKey"] == "acc_1"
    assert len(state["styles"]) == 1
    assert state["activeStyleId"] == card["id"]

    # Re-extract with same account_key updates existing card
    ctx.llm.acomplete = AsyncMock(
        return_value="""```json
        {
            "name": "Updated Tech Voice",
            "tone": "Polished",
            "sentences": "Concise",
            "opening": "Stat",
            "structure": "A -> B",
            "words": ["tech", "ai"],
            "avoid": ["fluff"],
            "samples": "New sample line."
        }
        ```"""
    )
    updated_card = _run(style_extract(ctx, urls=[], text=sample_text, account_key="acc_1", lang="en", state=state))
    assert updated_card["name"] == "Updated Tech Voice"
    assert len(state["styles"]) == 1  # No duplicate
    assert updated_card["id"] == card["id"]


def test_skills_learn():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(
        return_value='["Rule 1: Hook fast", "Rule 2: Give data", "Rule 3: Call to action"]'
    )

    state = {
        "items": [{"id": "it1", "title": "Viral Post 1"}],
        "metrics": [{"id": "m1", "itemId": "it1", "views": 50000, "likes": 4000}],
        "skills": [],
    }

    proposed = _run(skills_learn(ctx, state, "en"))

    assert len(proposed) == 3
    assert proposed[0]["text"] == "Rule 1: Hook fast"
    assert proposed[0]["status"] == "proposed"
    assert proposed[0]["sample"] is False
    assert len(state["skills"]) == 3


def test_skills_export_empty_fails(tmp_path):
    state = {"skills": [{"id": "sk1", "text": "Sample rule", "sample": True, "status": "active"}]}
    with pytest.raises(HTTPException) as exc:
        _run(skills_export(state, tmp_path, "en"))
    assert exc.value.status_code == 400
    assert "no active" in exc.value.detail.lower()


def test_skills_export_success(tmp_path):
    state = {
        "skills": [
            {"id": "sk1", "text": "Learned writing rule A", "sample": False, "status": "active"},
            {"id": "sk2", "text": "Learned writing rule B", "sample": False, "status": "active"},
            {"id": "sk3", "text": "Sample rule to skip", "sample": True, "status": "active"},
        ]
    }

    out_file = _run(skills_export(state, tmp_path, "en"))

    assert out_file.exists()
    assert out_file.name == "SKILL.md"
    content = out_file.read_text(encoding="utf-8")
    assert "Learned writing rule A" in content
    assert "Learned writing rule B" in content
    assert "Sample rule to skip" not in content

    # Active skills marked as exported
    assert state["skills"][0]["status"] == "exported"
    assert state["skills"][1]["status"] == "exported"
    assert state["skills"][2]["status"] == "active"  # Untouched sample
