"""
ai.py — LLM prompt builders and callers for hermes-media-desk.

Implements:
- build_voice_block() and build_skills_block() with <rules> prepended before <voice>.
- llm_kwargs(): Provider/model overrides from settings.
- generate_plan(): Structured content plan with light=True and 240s timeout.
- generate_article(): Long-form article generation with light=False and 240s timeout.
- chat_reply(): Interactive revision with JSON parse and local_intent() fallback.
- extract_style(): Writing style card analysis from text materials.
- fallback_plan(): Rule-based minimal plan when LLM is unavailable.

Requirements: 10.1, 10.2, 12.1, 12.2, 12.3, 22.1, 22.2, 22.3, 22.4, 22.6, 22.7
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt assembly helpers (Requirements 12.1, 12.2, 12.3, 22.2)
# ---------------------------------------------------------------------------

def build_voice_block(style: dict | None) -> str:
    """Assemble the <voice> block for system prompts from a StyleCard."""
    if not style:
        return ""
    words = style.get("words", [])
    words_str = ", ".join(words) if isinstance(words, list) else str(words or "")
    avoid = style.get("avoid", [])
    avoid_str = ", ".join(avoid) if isinstance(avoid, list) else str(avoid or "")

    return (
        "<voice>\n"
        f"Tone: {style.get('tone', '')}\n"
        f"Sentence patterns: {style.get('sentences', '')}\n"
        f"Opening: {style.get('opening', '')}\n"
        f"Structure: {style.get('structure', '')}\n"
        f"Words to use: {words_str}\n"
        f"Words to avoid: {avoid_str}\n"
        f"Sample phrases: {style.get('samples', '')}\n"
        "</voice>"
    )


def build_skills_block(skills: list | None) -> str:
    """Assemble the <rules> block for system prompts from active/exported Skills."""
    if not skills:
        return ""
    active = [
        s for s in skills
        if isinstance(s, dict) and s.get("status") in ("active", "exported")
    ]
    if not active:
        return ""
    rules_text = "\n".join(f"- {s.get('text', '')}" for s in active)
    return f"<rules>\n{rules_text}\n</rules>"


def llm_kwargs(settings: dict | None) -> dict[str, str]:
    """Extract assistant provider and model overrides from settings."""
    if not isinstance(settings, dict):
        return {}
    assistant = settings.get("assistant")
    if isinstance(assistant, dict):
        provider = (assistant.get("provider") or "").strip()
        model = (assistant.get("model") or "").strip()
        if provider and model:
            return {"provider": provider, "model": model}
    return {}


# ---------------------------------------------------------------------------
# Fallback and Rule-Based Helpers (Requirements 10.2, 22.6)
# ---------------------------------------------------------------------------

def fallback_plan(item: dict) -> dict:
    """Generate minimal structured plan directly from item title and body."""
    title = (item.get("title") or "Untitled Idea").strip()
    body = (item.get("body") or "").strip()

    facts: list[str] = []
    if body:
        parts = [p.strip() for p in re.split(r"[。\n.!?]", body) if p.strip()]
        facts = parts[:4]
    if not facts:
        facts = [title, "Practical perspective and core takeaway"]

    return {
        "title": title,
        "coverText": title[:30],
        "facts": facts,
        "outline": [
            f"1. Context: Why {title} matters now",
            f"2. Core breakdown: Key insights and case studies",
            f"3. Practical takeaway and reader reflection",
        ],
        "cover": {
            "prompt": f"Minimalist clean graphic illustration representing {title}, high contrast, modern design, no text",
        },
        "images": [
            {"prompt": f"Editorial illustration explaining concept of {title}, clean modern flat design, no text"},
            {"prompt": f"Infographic visual breakdown related to {title}, modern aesthetic, no text"},
        ],
        "shots": [
            {"prompt": f"Storyboard shot 1: establishing scene for {title}, cinematic framing, no text"},
            {"prompt": f"Storyboard shot 2: focus on key dilemma or question in {title}, engaging scene, no text"},
            {"prompt": f"Storyboard shot 3: practical application of {title}, clean composition, no text"},
            {"prompt": f"Storyboard shot 4: visual insight diagram for {title}, modern lighting, no text"},
            {"prompt": f"Storyboard shot 5: emotional or thought-provoking moment for {title}, no text"},
            {"prompt": f"Storyboard shot 6: closing perspective, modern clean background, no text"},
        ],
    }


def local_intent(message: str, item: dict, production: dict | None) -> dict:
    """Rule-based intent parser used when the LLM is unavailable or unparseable."""
    msg = (message or "").strip()
    reply = "Received your revision request (AI offline fallback handling applied)."
    ops: list[dict] = []
    revise: dict[str, Any] = {}
    actions: list[dict] = []

    # Check for title changes
    m_title = re.search(r"(?:change title to[:\s]*|rename to[:\s]*)(.+)$", msg, re.IGNORECASE)
    if m_title:
        new_title = m_title.group(1).strip().strip(":\"'")
        revise["title"] = new_title
        reply = f"Title changed to: {new_title}"

    # Check for produce action
    if re.search(r"(?:produce|generate|create the production)", msg, re.IGNORECASE):
        item_id = item.get("id")
        if item_id:
            actions.append({"type": "produce", "itemId": item_id})
            reply = "Production task triggered."

    return {
        "reply": reply,
        "ops": ops,
        "revise": revise,
        "actions": actions,
        "outage_notice": "AI assistant is temporarily operating in local intent fallback mode.",
    }


# ---------------------------------------------------------------------------
# Core LLM Callers (Requirements 10.1, 10.2, 22.1, 22.3, 22.4)
# ---------------------------------------------------------------------------

def _extract_json_block(text: str) -> dict | None:
    """Safely extract and parse JSON object from markdown fenced code or raw text."""
    if not text:
        return None
    # 1. Look for ```json ... ```
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # 2. Look for any top-level { ... }
    m = re.search(r"(\{.*\})", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    try:
        return json.loads(text)
    except Exception:
        return None


async def generate_plan(
    ctx: Any,
    item: dict,
    style: dict | None,
    skills: list,
    settings: dict | None = None,
) -> dict:
    """Generate a structured content plan using LLM (light=True, timeout=240s)."""
    rules_block = build_skills_block(skills)
    voice_block = build_voice_block(style)
    blocks = [b for b in (rules_block, voice_block) if b]
    rules_and_voice = "\n\n".join(blocks)

    sys_prompt = (
        "You are an expert social media content director. Produce a complete content plan in valid JSON format only.\n"
        f"{rules_and_voice}\n"
        "Write all user-facing content in English.\n"
        "Return a JSON object with: title, coverText, facts (list), outline (list), "
        "cover (dict with 'prompt'), images (list of dicts each with 'prompt'), shots (list of dicts each with 'prompt')."
    )
    user_prompt = (
        f"Create a plan for item:\nTitle: {item.get('title')}\nBody: {item.get('body')}\nPlatform: {item.get('platform')}"
    )

    if ctx is None or not hasattr(ctx, "llm") or ctx.llm is None:
        return fallback_plan(item)

    kwargs = llm_kwargs(settings)
    try:
        resp = await ctx.llm.acomplete(
            prompt=user_prompt,
            system=sys_prompt,
            light=True,
            purpose="content-creation",
            task="generate-plan",
            timeout=240_000,
            **kwargs,
        )
        plan_dict = _extract_json_block(resp)
        if plan_dict and isinstance(plan_dict, dict) and "title" in plan_dict:
            return plan_dict
    except Exception as exc:
        logger.warning("generate_plan LLM call failed (%s); using fallback plan", exc)

    return fallback_plan(item)


async def generate_article(
    ctx: Any,
    plan: dict,
    item: dict,
    style: dict | None,
    skills: list,
    settings: dict | None = None,
) -> str:
    """Generate article body text using LLM (light=False, timeout=240s)."""
    rules_block = build_skills_block(skills)
    voice_block = build_voice_block(style)
    blocks = [b for b in (rules_block, voice_block) if b]
    rules_and_voice = "\n\n".join(blocks)

    sys_prompt = (
        "You are an award-winning content writer. Write a publication-ready article in markdown format.\n"
        "Write all content in English.\n"
        f"{rules_and_voice}"
    )
    user_prompt = (
        f"Write an article based on the plan:\nTitle: {plan.get('title')}\n"
        f"Outline: {plan.get('outline')}\nFacts: {plan.get('facts')}"
    )

    if ctx is None or not hasattr(ctx, "llm") or ctx.llm is None:
        return f"# {plan.get('title', item.get('title'))}\n\n{item.get('body', '')}"

    kwargs = llm_kwargs(settings)
    try:
        resp = await ctx.llm.acomplete(
            prompt=user_prompt,
            system=sys_prompt,
            light=False,
            purpose="content-creation",
            task="generate-article",
            timeout=240_000,
            **kwargs,
        )
        return resp or ""
    except Exception as exc:
        logger.warning("generate_article LLM call failed (%s); returning outline draft", exc)
        return f"# {plan.get('title', item.get('title'))}\n\n" + "\n\n".join(plan.get("outline", []))


async def chat_reply(
    ctx: Any,
    message: str,
    history: list,
    item: dict,
    production: dict | None,
    style: dict | None,
    settings: dict | None = None,
) -> dict:
    """Process user chat revision instruction with LLM (light=True, task='chat-reply')."""
    rules_block = build_skills_block(style.get("skills", []) if style else [])
    voice_block = build_voice_block(style)
    blocks = [b for b in (rules_block, voice_block) if b]
    context_str = "\n\n".join(blocks)

    sys_prompt = (
        "You are an editorial assistant inside Hermes Media Desk. Analyze user feedback and output JSON only with:\n"
        "{\n"
        '  "reply": "Conversational reply to user (in English)",\n'
        '  "ops": [/* ops to apply to state */],\n'
        '  "revise": {\n'
        '    "title": "optional updated title",\n'
        '    "article": "optional updated article content or markdown diff",\n'
        '    "cover": {"prompt": "optional new cover prompt"}\n'
        "  },\n"
        '  "actions": [/* e.g. {"type": "produce"} */]\n'
        "}"
    )
    user_prompt = (
        f"Context:\n{context_str}\n"
        f"Current Item: {item.get('id')} - {item.get('title')}\n"
        f"Production Status: {production.get('status') if production else 'none'}\n"
        f"User message: {message}"
    )

    if ctx is None or not hasattr(ctx, "llm") or ctx.llm is None:
        fallback = local_intent(message, item, production)
        return {**fallback, "modelOk": False, "modelError": "LLM client not available"}

    kwargs = llm_kwargs(settings)
    try:
        resp = await ctx.llm.acomplete(
            prompt=user_prompt,
            system=sys_prompt,
            light=True,
            purpose="content-creation",
            task="chat-reply",
            **kwargs,
        )
        parsed = _extract_json_block(resp)
        required_keys = {"reply", "ops", "revise", "actions"}
        if parsed and isinstance(parsed, dict) and required_keys.issubset(parsed.keys()):
            return {
                "reply": parsed["reply"],
                "ops": parsed["ops"],
                "revise": parsed["revise"],
                "actions": parsed["actions"],
                "modelOk": True,
                "modelError": None,
            }
        # Non-JSON or missing fields -> fallback to local intent
        fallback = local_intent(message, item, production)
        return {**fallback, "modelOk": False, "modelError": "LLM response did not contain required JSON fields"}
    except Exception as exc:
        fallback = local_intent(message, item, production)
        return {**fallback, "modelOk": False, "modelError": str(exc)}


async def extract_style(
    ctx: Any,
    text: str,
    settings: dict | None = None,
) -> dict:
    """Analyze sample writing text and return a structured StyleCard profile."""
    sys_prompt = (
        "You are an expert stylometrist. Analyze the writing style of the text and output a JSON object with:\n"
        "{\n"
        '  "name": "concise style name (in English)",\n'
        '  "tone": "tone description (in English)",\n'
        '  "sentences": "sentence length and rhythm patterns",\n'
        '  "opening": "hook and opening strategy",\n'
        '  "structure": "progression and structure archetype",\n'
        '  "words": ["keyword1", "keyword2", "keyword3"],\n'
        '  "avoid": ["avoid1", "avoid2"],\n'
        '  "samples": "a representative sentence or phrase from the text"\n'
        "}"
    )

    if ctx is None or not hasattr(ctx, "llm") or ctx.llm is None:
        return {
            "name": "Extracted Voice",
            "tone": "Direct, engaging, authentic",
            "sentences": "Varied short and medium sentences with clear transitions",
            "opening": "Leads with a specific observation or question",
            "structure": "Context -> Key Discovery -> Solution -> Takeaway",
            "words": ["insight", "practical", "key takeaway"],
            "avoid": ["jargon", "vague fluff"],
            "samples": text[:120].strip(),
        }

    kwargs = llm_kwargs(settings)
    try:
        # Check if structured completion is available and genuinely callable/async
        if hasattr(ctx.llm, "acomplete_structured"):
            try:
                result = await ctx.llm.acomplete_structured(
                    prompt=f"Text to analyze:\n\n{text}",
                    system=sys_prompt,
                    schema={
                        "name": str, "tone": str, "sentences": str, "opening": str,
                        "structure": str, "words": list, "avoid": list, "samples": str,
                    },
                    **kwargs,
                )
                if isinstance(result, dict) and "name" in result:
                    return result
            except (TypeError, AttributeError):
                pass  # Fall back to standard acomplete

        resp = await ctx.llm.acomplete(
            prompt=f"Analyze style of this text:\n\n{text}",
            system=sys_prompt,
            light=False,
            **kwargs,
        )
        parsed = _extract_json_block(resp)
        if parsed and isinstance(parsed, dict) and "name" in parsed:
            return parsed
    except Exception as exc:
        logger.warning("extract_style LLM call failed (%s); returning heuristics", exc)

    return {
        "name": "Custom Extracted Voice",
        "tone": "Direct, engaging, authentic",
        "sentences": "Varied short and medium sentences with clear transitions",
        "opening": "Leads with a specific observation or question",
        "structure": "Context -> Key Discovery -> Solution -> Takeaway",
        "words": ["insight", "practical", "takeaway"],
        "avoid": ["jargon", "vague filler"],
        "samples": text[:120].strip(),
    }
