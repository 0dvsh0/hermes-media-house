"""
Unit tests for dashboard/ai.py — prompt assembly, fallback plans, and LLM callers.

Requirements: 10.1, 10.2, 12.1, 12.2, 12.3, 22.1, 22.2, 22.3, 22.4, 22.6, 22.7
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.ai import (  # noqa: E402
    build_skills_block,
    build_voice_block,
    chat_reply,
    extract_style,
    fallback_plan,
    generate_article,
    generate_plan,
    llm_kwargs,
    local_intent,
)


def _run(coro):
    return asyncio.run(coro)


def test_build_voice_block():
    assert build_voice_block(None) == ""
    assert build_voice_block({}) == ""

    style = {
        "tone": "Casual and witty",
        "sentences": "Short punches",
        "opening": "Surprise stat",
        "structure": "Problem -> Twist -> Solution",
        "words": ["actually", "truth is"],
        "avoid": ["synergy", "paradigm"],
        "samples": "Here is what happened next.",
    }
    block = build_voice_block(style)
    assert "<voice>" in block
    assert "</voice>" in block
    assert "Tone: Casual and witty" in block
    assert "actually, truth is" in block
    assert "synergy, paradigm" in block


def test_build_skills_block():
    assert build_skills_block(None) == ""
    assert build_skills_block([]) == ""

    skills = [
        {"text": "Rule 1 active", "status": "active"},
        {"text": "Rule 2 exported", "status": "exported"},
        {"text": "Rule 3 proposed", "status": "proposed"},
        {"text": "Rule 4 inactive", "status": "inactive"},
    ]
    block = build_skills_block(skills)
    assert "<rules>" in block
    assert "</rules>" in block
    assert "- Rule 1 active" in block
    assert "- Rule 2 exported" in block
    assert "Rule 3 proposed" not in block
    assert "Rule 4 inactive" not in block


def test_llm_kwargs():
    assert llm_kwargs(None) == {}
    assert llm_kwargs({}) == {}
    assert llm_kwargs({"assistant": {"provider": "openai", "model": ""}}) == {}
    assert llm_kwargs({"assistant": {"provider": "", "model": "gpt-4"}}) == {}
    assert llm_kwargs({"assistant": {"provider": "anthropic", "model": "claude-3-5-sonnet"}}) == {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet",
    }


def test_fallback_plan():
    item = {
        "title": "Quantum Computing 101",
        "body": "Superposition is magical. Entanglement connects particles across space.",
    }
    plan = fallback_plan(item)
    assert plan["title"] == "Quantum Computing 101"
    assert len(plan["facts"]) >= 1
    assert len(plan["outline"]) >= 3
    assert "cover" in plan and "prompt" in plan["cover"]
    assert "images" in plan and len(plan["images"]) >= 1
    assert "shots" in plan and len(plan["shots"]) >= 1


def test_generate_plan_llm_success():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(
        return_value="""```json
        {
            "title": "AI in 2026",
            "coverText": "Future of AI",
            "facts": ["Fact 1", "Fact 2"],
            "outline": ["Intro", "Body", "Outro"],
            "cover": {"prompt": "robot painting"},
            "images": [{"prompt": "neural net"}],
            "shots": [{"prompt": "shot 1"}]
        }
        ```"""
    )

    item = {"title": "AI in 2026", "body": "Exploration"}
    plan = _run(generate_plan(ctx, item, None, [], "zh"))

    assert plan["title"] == "AI in 2026"
    assert plan["coverText"] == "Future of AI"
    ctx.llm.acomplete.assert_called_once()
    kwargs = ctx.llm.acomplete.call_args[1]
    assert kwargs["light"] is True
    assert kwargs["purpose"] == "content-creation"
    assert kwargs["task"] == "generate-plan"
    assert kwargs["timeout"] == 240_000


def test_generate_plan_llm_failure_falls_back():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(side_effect=RuntimeError("API down"))

    item = {"title": "Backup Topic", "body": "Details here"}
    plan = _run(generate_plan(ctx, item, None, [], "en"))

    assert plan["title"] == "Backup Topic"
    assert len(plan["outline"]) >= 1


def test_generate_article():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(return_value="# My Article\n\nFull generated text.")

    plan = {"title": "Title", "outline": ["1", "2"], "facts": ["f1"]}
    item = {"title": "Title", "body": "Body"}
    result = _run(generate_article(ctx, plan, item, None, [], "en"))

    assert result == "# My Article\n\nFull generated text."
    ctx.llm.acomplete.assert_called_once()
    kwargs = ctx.llm.acomplete.call_args[1]
    assert kwargs["light"] is False
    assert kwargs["purpose"] == "content-creation"
    assert kwargs["task"] == "generate-article"


def test_chat_reply_llm_success():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(
        return_value='{"reply": "Updated title", "ops": [], "revise": {"title": "New Title"}, "actions": []}'
    )

    item = {"id": "it1", "title": "Old"}
    resp = _run(chat_reply(ctx, "change title", [], item, None, None, "zh"))

    assert resp["reply"] == "Updated title"
    assert resp["revise"] == {"title": "New Title"}
    assert resp["modelOk"] is True
    assert resp["modelError"] is None


def test_chat_reply_llm_failure_local_intent_fallback():
    ctx = MagicMock()
    ctx.llm.acomplete = AsyncMock(side_effect=RuntimeError("LLM offline"))

    item = {"id": "it1", "title": "Old"}
    resp = _run(chat_reply(ctx, "Change title to: Novel Tech Review", [], item, None, None, "en"))

    assert resp["modelOk"] is False
    assert "LLM offline" in resp["modelError"]
    assert resp["revise"]["title"] == "Novel Tech Review"
    assert "outage_notice" in resp
