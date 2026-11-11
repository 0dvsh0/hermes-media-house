"""
ops.py — Single validated write path for hermes-media-desk.

Implements:
- apply_ops(): sequential execution with whitelist filtering, error isolation,
  and three-way merge undo integration.
- 24 op handlers for all entity mutations (items, people, angles, styles,
  skills, metrics, accounts).
- Vocabulary validation (statuses, kinds, platforms).
- Status transition logic (publishedAt, scheduledAt).
- Field coercions (URL prefix, date parsing, UTF-8 byte boundary truncation).

Requirements: 4.1–4.10, 5.1–5.12, 11.2, 11.3, 11.4
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone
import re
from typing import Any, Callable
import uuid

# ---------------------------------------------------------------------------
# Vocabulary constants (Requirements 4.1, 4.2, 4.3)
# ---------------------------------------------------------------------------

STATUSES = {"idea", "outline", "draft", "ready", "published"}
KINDS = {"image", "video", "web", "quote", "note"}
PLATFORMS = {
    "X", "YouTube", "LinkedIn", "Substack", "TikTok", "Instagram", "Threads",
    "Xiaohongshu", "Douyin", "Bilibili", "WeChat", "WeChat Channels",
}

# Byte truncation limits (Requirement 5.9)
MAX_TITLE_BYTES = 40_000
MAX_BODY_BYTES = 40_000
MAX_ARTICLE_BYTES = 200_000
MAX_PROMPT_BYTES = 1_200


def _utcnow_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Field coercion helpers (Requirements 5.7, 5.8, 5.9)
# ---------------------------------------------------------------------------

def truncate_utf8(text: str | None, max_bytes: int) -> str | None:
    """Truncate text to max_bytes at UTF-8 boundary without producing invalid chars."""
    if text is None:
        return None
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    # Slicing at max_bytes might cut a multibyte char; errors="ignore" safely drops it
    return encoded[:max_bytes].decode("utf-8", errors="ignore")


def validate_url(val: Any) -> str | None:
    """Ensure URL begins with http:// or https://; otherwise return None."""
    if not isinstance(val, str) or not val.strip():
        return None
    val_str = val.strip()
    if re.match(r"^https?://", val_str, re.IGNORECASE):
        return val_str
    return None


def validate_date(val: Any) -> str | None:
    """Validate string as calendar date / ISO datetime; otherwise return None."""
    if not isinstance(val, str) or not val.strip():
        return None
    val_str = val.strip()
    try:
        datetime.fromisoformat(val_str.replace("Z", "+00:00"))
        return val_str
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Op Handlers (all 25 handlers)
# ---------------------------------------------------------------------------

def handle_add_item(state: dict, op: dict) -> dict:
    title = truncate_utf8(op.get("title"), MAX_TITLE_BYTES)
    body = truncate_utf8(op.get("body"), MAX_BODY_BYTES)
    media = op.get("media")

    # Requirement 5.5: require at least one of title, body, media non-empty
    has_title = bool(title and title.strip())
    has_body = bool(body and body.strip())
    has_media = bool(media)
    if not (has_title or has_body or has_media):
        raise ValueError("add_item requires at least one of title, body, or media to be non-empty")

    status = op.get("status", "idea")
    if status not in STATUSES:
        raise ValueError(f"Invalid status '{status}'. Accepted: {sorted(STATUSES)}")

    kind = op.get("kind", "note")
    if kind not in KINDS:
        raise ValueError(f"Invalid kind '{kind}'. Accepted: {sorted(KINDS)}")

    platform = op.get("platform")
    if platform is not None and platform not in PLATFORMS:
        raise ValueError(f"Invalid platform '{platform}'. Accepted: {sorted(PLATFORMS)}")

    parent_id = op.get("parentId")
    pos = op.get("pos")

    # Requirement 5.10: auto-assign pos among top-level items when pos and parentId are absent
    if pos is None and parent_id is None:
        top_positions = [
            item["pos"]
            for item in state.get("items", [])
            if not item.get("parentId") and isinstance(item.get("pos"), (int, float))
        ]
        pos = max(top_positions, default=-1) + 1

    scheduled_at = validate_date(op.get("scheduledAt"))
    source = validate_url(op.get("source"))

    # Requirements 4.9 & 4.10: status transitions with scheduledAt
    published_at = None
    if status == "published":
        published_at = _utcnow_iso()
    elif scheduled_at:
        if status in ("ready", "draft"):
            status = "ready"
        else:
            status = "outline"

    item_id = op.get("id") or f"item_{uuid.uuid4().hex[:12]}"
    created_at = _utcnow_iso()

    item = {
        "id": item_id,
        "title": title or "",
        "body": body or "",
        "kind": kind,
        "platform": platform,
        "tags": list(op.get("tags") or []),
        "source": source,
        "media": media,
        "pos": pos,
        "parentId": parent_id,
        "scheduledAt": scheduled_at,
        "status": status,
        "publishedAt": published_at,
        "createdAt": created_at,
        "updatedAt": created_at,
        "drafts": [],
        "production": None,
    }

    state.setdefault("items", []).append(item)
    return {"text": f"Added item: {item['title'] or item_id}", "target": item_id, "kind": "item"}


def handle_update_item(state: dict, op: dict) -> dict:
    item_id = op.get("id")
    if not item_id:
        raise ValueError("update_item requires 'id'")

    items = state.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    # Check status vocabulary
    if "status" in op:
        new_status = op["status"]
        if new_status not in STATUSES:
            raise ValueError(f"Invalid status '{new_status}'. Accepted: {sorted(STATUSES)}")

    # Check kind vocabulary
    if "kind" in op:
        new_kind = op["kind"]
        if new_kind not in KINDS:
            raise ValueError(f"Invalid kind '{new_kind}'. Accepted: {sorted(KINDS)}")

    # Check platform vocabulary
    if "platform" in op:
        new_platform = op["platform"]
        if new_platform is not None and new_platform not in PLATFORMS:
            raise ValueError(f"Invalid platform '{new_platform}'. Accepted: {sorted(PLATFORMS)}")

    # Coerce fields
    if "title" in op:
        item["title"] = truncate_utf8(op["title"], MAX_TITLE_BYTES) or ""
    if "body" in op:
        item["body"] = truncate_utf8(op["body"], MAX_BODY_BYTES) or ""
    if "kind" in op:
        item["kind"] = op["kind"]
    if "platform" in op:
        item["platform"] = op["platform"]
    if "tags" in op:
        item["tags"] = list(op["tags"]) if op["tags"] is not None else []
    if "source" in op:
        item["source"] = validate_url(op["source"])
    if "media" in op:
        item["media"] = op["media"]
    if "pos" in op:
        item["pos"] = op["pos"]
    if "parentId" in op:
        item["parentId"] = op["parentId"]

    # Status & scheduledAt transitions (Requirements 4.7, 4.8, 4.9, 4.10)
    current_status = item.get("status", "idea")
    target_status = op.get("status", current_status)
    status_explicit = "status" in op

    if "scheduledAt" in op:
        new_scheduled = validate_date(op["scheduledAt"])
        item["scheduledAt"] = new_scheduled
        if new_scheduled:
            if target_status != "published":
                if target_status in ("ready", "draft"):
                    target_status = "ready"
                else:
                    target_status = "outline"
        else:
            if not status_explicit:
                if target_status == "ready":
                    target_status = "draft"
                elif target_status == "outline":
                    target_status = "idea"

    # Status publish timestamps
    if target_status == "published":
        if not item.get("publishedAt"):
            item["publishedAt"] = _utcnow_iso()
    else:
        if current_status == "published" and target_status != "published":
            item.pop("publishedAt", None)

    item["status"] = target_status
    item["updatedAt"] = _utcnow_iso()

    return {"text": f"Updated item: {item_id}", "target": item_id, "kind": "item"}


def handle_delete_item(state: dict, op: dict) -> dict:
    item_id = op.get("id")
    if not item_id:
        raise ValueError("delete_item requires 'id'")

    items = state.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    # Requirement 5.6: remove orphaned child metrics
    if "metrics" in state:
        state["metrics"] = [m for m in state["metrics"] if m.get("itemId") != item_id]

    # Requirement 5.6: set orphaned direct child items' parentId to null
    for it in items:
        if it.get("parentId") == item_id:
            it["parentId"] = None

    state["items"] = [it for it in items if it.get("id") != item_id]
    return {"text": f"Deleted item: {item_id}", "target": item_id, "kind": "item"}


def handle_schedule_item(state: dict, op: dict) -> dict:
    item_id = op.get("id")
    if not item_id:
        raise ValueError("schedule_item requires 'id'")

    items = state.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    raw_scheduled = op.get("scheduledAt")
    scheduled_at = validate_date(raw_scheduled)
    item["scheduledAt"] = scheduled_at

    current_status = item.get("status", "idea")
    status_explicit = "status" in op

    if status_explicit:
        target_status = op["status"]
        if target_status not in STATUSES:
            raise ValueError(f"Invalid status '{target_status}'. Accepted: {sorted(STATUSES)}")
    else:
        target_status = current_status

    if scheduled_at:
        if target_status != "published":
            if target_status in ("ready", "draft"):
                target_status = "ready"
            else:
                target_status = "outline"
    else:
        if not status_explicit:
            if target_status == "ready":
                target_status = "draft"
            elif target_status == "outline":
                target_status = "idea"

    if target_status == "published":
        if not item.get("publishedAt"):
            item["publishedAt"] = _utcnow_iso()
    elif current_status == "published":
        item.pop("publishedAt", None)

    if scheduled_at and "platform" in op:
        platform = op.get("platform")
        if platform is not None:
            matched = next((p for p in PLATFORMS if p.lower() == str(platform).lower()), None)
            if matched:
                platform = matched
            elif platform not in PLATFORMS:
                raise ValueError(f"Invalid platform '{platform}'. Accepted: {sorted(PLATFORMS)}")
        item["platform"] = platform

    item["status"] = target_status
    item["updatedAt"] = _utcnow_iso()
    return {"text": f"Scheduled item: {item_id}", "target": item_id, "kind": "item"}


def handle_set_status(state: dict, op: dict) -> dict:
    item_id = op.get("id")
    status = op.get("status")
    if not item_id:
        raise ValueError("set_status requires 'id'")
    if status not in STATUSES:
        raise ValueError(f"Invalid status '{status}'. Accepted: {sorted(STATUSES)}")

    items = state.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    prev_status = item.get("status")
    if status == "published":
        if not item.get("publishedAt"):
            item["publishedAt"] = _utcnow_iso()
    elif prev_status == "published":
        item.pop("publishedAt", None)

    item["status"] = status
    item["updatedAt"] = _utcnow_iso()
    return {"text": f"Status updated: {status}", "target": item_id, "kind": "item"}


def handle_save_draft(state: dict, op: dict) -> dict:
    item_id = op.get("id")
    if not item_id:
        raise ValueError("save_draft requires 'id'")

    items = state.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    article = truncate_utf8(op.get("article"), MAX_ARTICLE_BYTES) or ""
    draft_id = op.get("draftId") or f"draft_{uuid.uuid4().hex[:8]}"
    name = truncate_utf8(op.get("name"), 200) or "Draft"

    draft = {
        "id": draft_id,
        "name": name,
        "article": article,
        "createdAt": _utcnow_iso(),
    }
    item.setdefault("drafts", []).append(draft)
    item["updatedAt"] = _utcnow_iso()
    return {"text": f"Saved draft: {draft_id}", "target": item_id, "kind": "draft"}


def handle_update_production(state: dict, op: dict) -> dict:
    item_id = op.get("id")
    if not item_id:
        raise ValueError("update_production requires 'id'")

    items = state.get("items", [])
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise ValueError(f"Item not found: {item_id}")

    production = item.setdefault("production", {}) or {}
    item["production"] = production

    if "title" in op:
        # Title in production clamped to 200 chars for inline title edit or 40K bytes
        title_val = truncate_utf8(op["title"], MAX_TITLE_BYTES) or ""
        production["title"] = title_val

    if "article" in op:
        production["article"] = truncate_utf8(op["article"], MAX_ARTICLE_BYTES) or ""

    if "coverText" in op:
        production["coverText"] = truncate_utf8(op["coverText"], 1_000) or ""

    if "stage" in op:
        production["stage"] = op["stage"]

    if "status" in op:
        production["status"] = op["status"]

    if "cover" in op:
        cover = copy.deepcopy(op["cover"])
        if isinstance(cover, dict) and "prompt" in cover:
            cover["prompt"] = truncate_utf8(cover["prompt"], MAX_PROMPT_BYTES)
        production["cover"] = cover

    if "images" in op:
        images = copy.deepcopy(op["images"])
        if isinstance(images, list):
            for img in images:
                if isinstance(img, dict) and "prompt" in img:
                    img["prompt"] = truncate_utf8(img["prompt"], MAX_PROMPT_BYTES)
        production["images"] = images

    if "shots" in op:
        shots = copy.deepcopy(op["shots"])
        if isinstance(shots, list):
            for shot in shots:
                if isinstance(shot, dict) and "prompt" in shot:
                    shot["prompt"] = truncate_utf8(shot["prompt"], MAX_PROMPT_BYTES)
        production["shots"] = shots

    item["updatedAt"] = _utcnow_iso()
    return {"text": f"Updated production: {item_id}", "target": item_id, "kind": "production"}


def handle_add_person(state: dict, op: dict) -> dict:
    name = truncate_utf8(op.get("name"), MAX_TITLE_BYTES) or ""
    bio = truncate_utf8(op.get("bio"), MAX_BODY_BYTES) or ""
    person_id = op.get("id") or f"person_{uuid.uuid4().hex[:8]}"

    person = {
        "id": person_id,
        "name": name,
        "bio": bio,
        "avatar": validate_url(op.get("avatar")),
    }
    state.setdefault("people", []).append(person)
    return {"text": f"Added person: {name or person_id}", "target": person_id, "kind": "person"}


def handle_update_person(state: dict, op: dict) -> dict:
    person_id = op.get("id")
    if not person_id:
        raise ValueError("update_person requires 'id'")

    people = state.get("people", [])
    person = next((p for p in people if p.get("id") == person_id), None)
    if not person:
        raise ValueError(f"Person not found: {person_id}")

    if "name" in op:
        person["name"] = truncate_utf8(op["name"], MAX_TITLE_BYTES) or ""
    if "bio" in op:
        person["bio"] = truncate_utf8(op["bio"], MAX_BODY_BYTES) or ""
    if "avatar" in op:
        person["avatar"] = validate_url(op["avatar"])

    return {"text": f"Updated person: {person_id}", "target": person_id, "kind": "person"}


def handle_delete_person(state: dict, op: dict) -> dict:
    person_id = op.get("id")
    if not person_id:
        raise ValueError("delete_person requires 'id'")

    people = state.get("people", [])
    exists = any(p.get("id") == person_id for p in people)
    if not exists:
        raise ValueError(f"Person not found: {person_id}")

    state["people"] = [p for p in people if p.get("id") != person_id]
    return {"text": f"Deleted person: {person_id}", "target": person_id, "kind": "person"}


def handle_add_angle(state: dict, op: dict) -> dict:
    text = truncate_utf8(op.get("text"), MAX_TITLE_BYTES) or ""
    angle_id = op.get("id") or f"angle_{uuid.uuid4().hex[:8]}"

    angle = {
        "id": angle_id,
        "text": text,
    }

    state.setdefault("angles", []).append(angle)
    return {"text": f"Added angle: {angle_id}", "target": angle_id, "kind": "angle"}


def handle_update_angle(state: dict, op: dict) -> dict:
    angle_id = op.get("id")
    if not angle_id:
        raise ValueError("update_angle requires 'id'")

    angles = state.get("angles", [])
    angle = next((a for a in angles if a.get("id") == angle_id), None)
    if not angle:
        raise ValueError(f"Angle not found: {angle_id}")

    if "text" in op:
        angle["text"] = truncate_utf8(op["text"], MAX_TITLE_BYTES) or ""

    return {"text": f"Updated angle: {angle_id}", "target": angle_id, "kind": "angle"}


def handle_delete_angle(state: dict, op: dict) -> dict:
    angle_id = op.get("id")
    if not angle_id:
        raise ValueError("delete_angle requires 'id'")

    angles = state.get("angles", [])
    exists = any(a.get("id") == angle_id for a in angles)
    if not exists:
        raise ValueError(f"Angle not found: {angle_id}")

    state["angles"] = [a for a in angles if a.get("id") != angle_id]
    return {"text": f"Deleted angle: {angle_id}", "target": angle_id, "kind": "angle"}


def handle_add_style(state: dict, op: dict) -> dict:
    style_id = op.get("id") or f"style_{uuid.uuid4().hex[:8]}"
    name = truncate_utf8(op.get("name"), MAX_TITLE_BYTES) or ""
    summary = truncate_utf8(op.get("summary"), MAX_BODY_BYTES) or ""

    style = {
        "id": style_id,
        "name": name,
        "summary": summary,
        "tone": truncate_utf8(op.get("tone"), MAX_PROMPT_BYTES) or "",
        "sentences": truncate_utf8(op.get("sentences"), MAX_PROMPT_BYTES) or "",
        "opening": truncate_utf8(op.get("opening"), MAX_PROMPT_BYTES) or "",
        "structure": truncate_utf8(op.get("structure"), MAX_PROMPT_BYTES) or "",
        "words": list(op.get("words") or []),
        "avoid": list(op.get("avoid") or []),
        "samples": truncate_utf8(op.get("samples"), MAX_BODY_BYTES) or "",
        "source": validate_url(op.get("source")),
        "accountKey": op.get("accountKey"),
        "preset": bool(op.get("preset", False)),
        "category": op.get("category", "Custom"),
    }

    state.setdefault("styles", []).append(style)
    return {"text": f"Added style: {name or style_id}", "target": style_id, "kind": "style"}


def handle_update_style(state: dict, op: dict) -> dict:
    style_id = op.get("id")
    if not style_id:
        raise ValueError("update_style requires 'id'")

    styles = state.get("styles", [])
    style = next((s for s in styles if s.get("id") == style_id), None)
    if not style:
        raise ValueError(f"Style not found: {style_id}")

    for field in ("name", "summary", "tone", "sentences", "opening", "structure", "samples"):
        if field in op:
            limit = MAX_PROMPT_BYTES if field in ("tone", "sentences", "opening", "structure") else MAX_BODY_BYTES
            style[field] = truncate_utf8(op[field], limit) or ""

    if "words" in op:
        style["words"] = list(op["words"]) if op["words"] is not None else []
    if "avoid" in op:
        style["avoid"] = list(op["avoid"]) if op["avoid"] is not None else []
    if "source" in op:
        style["source"] = validate_url(op["source"])
    if "accountKey" in op:
        style["accountKey"] = op["accountKey"]
    if "category" in op:
        style["category"] = op["category"]

    return {"text": f"Updated style: {style_id}", "target": style_id, "kind": "style"}


def handle_delete_style(state: dict, op: dict) -> dict:
    style_id = op.get("id")
    if not style_id:
        raise ValueError("delete_style requires 'id'")

    styles = state.get("styles", [])
    exists = any(s.get("id") == style_id for s in styles)
    if not exists:
        raise ValueError(f"Style not found: {style_id}")

    state["styles"] = [s for s in styles if s.get("id") != style_id]
    if state.get("activeStyleId") == style_id:
        state["activeStyleId"] = None

    return {"text": f"Deleted style: {style_id}", "target": style_id, "kind": "style"}


def handle_set_style(state: dict, op: dict) -> dict:
    style_id = op.get("id")
    state["activeStyleId"] = style_id
    return {"text": f"Active style set to {style_id}", "target": style_id, "kind": "style"}


def handle_add_skill(state: dict, op: dict) -> dict:
    skill_id = op.get("id") or f"skill_{uuid.uuid4().hex[:8]}"
    text = truncate_utf8(op.get("text"), MAX_TITLE_BYTES) or ""
    status = op.get("status", "active")

    skill = {
        "id": skill_id,
        "text": text,
        "status": status,
    }

    state.setdefault("skills", []).append(skill)
    return {"text": f"Added skill: {skill_id}", "target": skill_id, "kind": "skill"}


def handle_update_skill(state: dict, op: dict) -> dict:
    skill_id = op.get("id")
    if not skill_id:
        raise ValueError("update_skill requires 'id'")

    skills = state.get("skills", [])
    skill = next((s for s in skills if s.get("id") == skill_id), None)
    if not skill:
        raise ValueError(f"Skill not found: {skill_id}")

    if "text" in op:
        skill["text"] = truncate_utf8(op["text"], MAX_TITLE_BYTES) or ""
    if "status" in op:
        skill["status"] = op["status"]

    return {"text": f"Updated skill: {skill_id}", "target": skill_id, "kind": "skill"}


def handle_delete_skill(state: dict, op: dict) -> dict:
    skill_id = op.get("id")
    if not skill_id:
        raise ValueError("delete_skill requires 'id'")

    skills = state.get("skills", [])
    exists = any(s.get("id") == skill_id for s in skills)
    if not exists:
        raise ValueError(f"Skill not found: {skill_id}")

    state["skills"] = [s for s in skills if s.get("id") != skill_id]
    return {"text": f"Deleted skill: {skill_id}", "target": skill_id, "kind": "skill"}


def handle_add_metric(state: dict, op: dict) -> dict:
    metric_id = op.get("id") or f"metric_{uuid.uuid4().hex[:8]}"
    metric = {
        "id": metric_id,
        "itemId": op.get("itemId"),
        "date": validate_date(op.get("date")),
        "views": int(op.get("views", 0)),
        "likes": int(op.get("likes", 0)),
        "comments": int(op.get("comments", 0)),
        "shares": int(op.get("shares", 0)),
        "saves": int(op.get("saves", 0)),
    }
    state.setdefault("metrics", []).append(metric)
    return {"text": f"Added metric: {metric_id}", "target": metric_id, "kind": "metric"}


def handle_add_account(state: dict, op: dict) -> dict:
    platform = op.get("platform")
    if platform is not None and platform not in PLATFORMS:
        raise ValueError(f"Invalid platform '{platform}'. Accepted: {sorted(PLATFORMS)}")

    account_id = op.get("id") or f"account_{uuid.uuid4().hex[:8]}"
    nickname = truncate_utf8(op.get("nickname"), MAX_TITLE_BYTES) or ""

    account = {
        "id": account_id,
        "platform": platform,
        "nickname": nickname,
        "url": validate_url(op.get("url")),
        "avatar": validate_url(op.get("avatar")),
    }

    state.setdefault("accounts", []).append(account)
    return {"text": f"Added account: {nickname or account_id}", "target": account_id, "kind": "account"}


def handle_update_account(state: dict, op: dict) -> dict:
    account_id = op.get("id")
    if not account_id:
        raise ValueError("update_account requires 'id'")

    accounts = state.get("accounts", [])
    account = next((a for a in accounts if a.get("id") == account_id), None)
    if not account:
        raise ValueError(f"Account not found: {account_id}")

    if "platform" in op:
        platform = op["platform"]
        if platform is not None and platform not in PLATFORMS:
            raise ValueError(f"Invalid platform '{platform}'. Accepted: {sorted(PLATFORMS)}")
        account["platform"] = platform

    if "nickname" in op:
        account["nickname"] = truncate_utf8(op["nickname"], MAX_TITLE_BYTES) or ""
    if "url" in op:
        account["url"] = validate_url(op["url"])
    if "avatar" in op:
        account["avatar"] = validate_url(op["avatar"])

    return {"text": f"Updated account: {account_id}", "target": account_id, "kind": "account"}


def handle_delete_account(state: dict, op: dict) -> dict:
    account_id = op.get("id")
    if not account_id:
        raise ValueError("delete_account requires 'id'")

    accounts = state.get("accounts", [])
    exists = any(a.get("id") == account_id for a in accounts)
    if not exists:
        raise ValueError(f"Account not found: {account_id}")

    state["accounts"] = [a for a in accounts if a.get("id") != account_id]
    return {"text": f"Deleted account: {account_id}", "target": account_id, "kind": "account"}


def handle_clear_samples(state: dict, op: dict) -> dict:
    collections = ("items", "people", "angles", "styles", "skills", "metrics", "accounts")
    count = 0
    for col in collections:
        arr = state.get(col, [])
        if isinstance(arr, list):
            non_samples = [x for x in arr if not (isinstance(x, dict) and x.get("sample") is True)]
            count += len(arr) - len(non_samples)
            state[col] = non_samples

    # If activeStyleId pointed to a removed style, reset to None
    styles = state.get("styles", [])
    if isinstance(styles, list):
        if not any(isinstance(s, dict) and s.get("id") == state.get("activeStyleId") for s in styles):
            state["activeStyleId"] = None

    # Disconnect parentId if parent item was removed
    items = state.get("items", [])
    if isinstance(items, list):
        item_ids = {it.get("id") for it in items if isinstance(it, dict) and "id" in it}
        for it in items:
            if isinstance(it, dict) and it.get("parentId") and it["parentId"] not in item_ids:
                it["parentId"] = None

    state["sampleCleared"] = True
    return {"text": f"Cleared {count} sample items", "target": "all", "kind": "samples"}


# ---------------------------------------------------------------------------
# OP_HANDLERS map and FIELD_WHITELISTS
# ---------------------------------------------------------------------------

OP_HANDLERS: dict[str, Callable[[dict, dict], dict]] = {
    "add_item": handle_add_item,
    "update_item": handle_update_item,
    "delete_item": handle_delete_item,
    "schedule_item": handle_schedule_item,
    "set_status": handle_set_status,
    "save_draft": handle_save_draft,
    "update_production": handle_update_production,
    "add_person": handle_add_person,
    "update_person": handle_update_person,
    "delete_person": handle_delete_person,
    "add_angle": handle_add_angle,
    "update_angle": handle_update_angle,
    "delete_angle": handle_delete_angle,
    "add_style": handle_add_style,
    "update_style": handle_update_style,
    "delete_style": handle_delete_style,
    "set_style": handle_set_style,
    "add_skill": handle_add_skill,
    "update_skill": handle_update_skill,
    "delete_skill": handle_delete_skill,
    "add_metric": handle_add_metric,
    "add_account": handle_add_account,
    "update_account": handle_update_account,
    "delete_account": handle_delete_account,
    "clear_samples": handle_clear_samples,
}

FIELD_WHITELISTS: dict[str, set[str]] = {
    "add_item": {
        "id", "title", "body", "kind", "platform", "tags", "source", "media",
        "pos", "parentId", "scheduledAt", "status",
    },
    "update_item": {
        "id", "title", "body", "kind", "platform", "tags", "source", "media",
        "pos", "parentId", "scheduledAt", "status",
    },
    "delete_item": {"id"},
    "schedule_item": {"id", "scheduledAt", "status", "platform"},
    "set_status": {"id", "status"},
    "save_draft": {"id", "article", "name", "draftId"},
    "update_production": {
        "id", "title", "article", "coverText", "cover", "images", "shots", "stage", "status",
    },
    "add_person": {"id", "name", "bio", "avatar"},
    "update_person": {"id", "name", "bio", "avatar"},
    "delete_person": {"id"},
    "add_angle": {"id", "text"},
    "update_angle": {"id", "text"},
    "delete_angle": {"id"},
    "add_style": {
        "id", "name", "summary", "tone", "sentences", "opening", "structure",
        "words", "avoid", "samples", "source", "accountKey", "preset",
        "category",
    },
    "update_style": {
        "id", "name", "summary", "tone", "sentences", "opening", "structure",
        "words", "avoid", "samples", "source", "accountKey", "category",
    },
    "delete_style": {"id"},
    "set_style": {"id"},
    "add_skill": {"id", "text", "status"},
    "update_skill": {"id", "text", "status"},
    "delete_skill": {"id"},
    "add_metric": {"id", "itemId", "date", "views", "likes", "comments", "shares", "saves"},
    "add_account": {"id", "platform", "nickname", "url", "avatar"},
    "update_account": {"id", "platform", "nickname", "url", "avatar"},
    "delete_account": {"id"},
    "clear_samples": set(),
}


# ---------------------------------------------------------------------------
# apply_ops() — pipeline entry point
# ---------------------------------------------------------------------------

async def apply_ops(
    state: dict,
    ops: list[dict],
    undo_stack: Any = None,
    undoable: bool = True,
) -> tuple[dict, list[dict], list[str]]:
    """Apply a sequential list of operations to state.

    Args:
        state: The current store state.
        ops: List of op dictionaries, each with an 'op' field.
        undo_stack: Optional UndoStack instance to record reversible steps.
        undoable: When True and undo_stack provided, pushes an UndoEntry if state changes.

    Returns:
        (new_state, receipts, errors)
    """
    before_state = copy.deepcopy(state)
    working_state = copy.deepcopy(state)
    receipts: list[dict] = []
    errors: list[str] = []

    for idx, raw_op in enumerate(ops):
        if not isinstance(raw_op, dict):
            errors.append(f"Op at index {idx} must be a dictionary")
            continue

        op_name = raw_op.get("op")
        if not op_name or op_name not in OP_HANDLERS:
            errors.append(f"Unknown operation: '{op_name}' at index {idx}")
            continue

        handler = OP_HANDLERS[op_name]
        whitelist = FIELD_WHITELISTS.get(op_name, set())

        # Strip op payload to only whitelisted fields
        payload = {k: v for k, v in raw_op.items() if k in whitelist or k == "id"}

        # Preserve state before this specific op for per-op error isolation
        op_before = copy.deepcopy(working_state)

        try:
            receipt = handler(working_state, payload)
            if receipt:
                receipts.append(receipt)
        except Exception as exc:
            # Op isolation: revert state changes from this failing op
            working_state = op_before
            errors.append(f"Error executing '{op_name}': {exc}")

    # Record undo entry if state mutated and undoable
    if undoable and undo_stack is not None and working_state != before_state:
        label = ops[0].get("op", "mutation") if ops else "mutation"
        undo_stack.push(label, before_state, working_state)

    return working_state, receipts, errors
