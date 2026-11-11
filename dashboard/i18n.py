"""
i18n.py - User-facing message strings for hermes-media-desk.

The plugin is English-only. This module provides:
  - ``t(key, **kwargs)``: English message for a key
  - ``get_lang(request)``: always ``"en"`` (kept for API compatibility)

Requirements: 21.1
"""

from __future__ import annotations

from fastapi import Request

# ---------------------------------------------------------------------------
# Exported constant
# ---------------------------------------------------------------------------

LANGS: tuple[str] = ("en",)


def get_lang(request: Request) -> str:
    """Return the active locale for a request.

    The plugin is English-only, so this always returns ``"en"`` regardless of
    headers or system locale.
    """
    return "en"


# ---------------------------------------------------------------------------
# Message map (English)
# ---------------------------------------------------------------------------

_STRINGS: dict[str, str] = {
    # Ops - receipts
    "receipt.item.added": "Item added: {title}",
    "receipt.item.updated": "Item updated: {title}",
    "receipt.item.deleted": "Item deleted: {title}",
    "receipt.item.scheduled": "Item scheduled: {title}",
    "receipt.item.unscheduled": "Item unscheduled: {title}",
    "receipt.status.set": "Status set to {status}",
    "receipt.draft.saved": "Draft saved",
    "receipt.production.updated": "Production updated",
    "receipt.person.added": "Person added: {name}",
    "receipt.person.updated": "Person updated: {name}",
    "receipt.person.deleted": "Person deleted: {name}",
    "receipt.angle.added": "Angle added: {title}",
    "receipt.angle.updated": "Angle updated: {title}",
    "receipt.angle.deleted": "Angle deleted: {title}",
    "receipt.style.added": "Style added: {name}",
    "receipt.style.updated": "Style updated: {name}",
    "receipt.style.deleted": "Style deleted: {name}",
    "receipt.style.set": "Active style set to: {name}",
    "receipt.style.cleared": "Active style cleared",
    "receipt.skill.added": "Skill added",
    "receipt.skill.updated": "Skill updated",
    "receipt.skill.deleted": "Skill deleted",
    "receipt.metric.added": "Metric added",
    "receipt.account.added": "Account added: {nickname}",
    "receipt.account.updated": "Account updated: {nickname}",
    "receipt.account.deleted": "Account deleted: {nickname}",
    # Ops - errors
    "error.op.unknown": "Unknown op type: {op}",
    "error.op.missing_fields": "Op missing required fields: {fields}",
    "error.item.empty": "At least one of title, body, or media must be provided",
    "error.item.not_found": "Item not found (id={id})",
    "error.person.not_found": "Person not found (id={id})",
    "error.angle.not_found": "Angle not found (id={id})",
    "error.style.not_found": "Style not found (id={id})",
    "error.skill.not_found": "Skill not found (id={id})",
    "error.account.not_found": "Account not found (id={id})",
    # Vocabulary validation
    "error.status.invalid": "Invalid status: {value}. Valid values: {valid}",
    "error.kind.invalid": "Invalid kind: {value}. Valid values: {valid}",
    "error.platform.invalid": "Invalid platform: {value}. Valid values: {valid}",
    # Field coercion
    "error.url.invalid": "URL must start with http:// or https://; stored as null",
    "error.date.invalid": "Invalid date format; stored as null",
    # Settings errors
    "error.settings.source.invalid": 'image.source must be "http" or "tool"',
    "error.settings.baseUrl.invalid": "image.baseUrl must start with http:// or https://",
    "error.settings.extra.invalid": "image.extra must be a valid JSON object (not an array)",
    "error.settings.assistant.mismatch": "assistant.provider and assistant.model must both be set or both be empty",
    "error.settings.toolSize.invalid": "toolSize must be one of: {valid}",
    "error.settings.toolQuality.invalid": "toolQuality must be one of: {valid}",
    "notice.settings.saved": "Settings saved",
    "notice.settings.apikey_hint": "API key saved (last 4: {hint})",
    # State / store errors
    "error.state.parse_failed": "state.json could not be parsed; state has been reset",
    "error.state.migration_failed": "State migration failed: {message}",
    "notice.state.reset": "Previous state was unreadable and has been reset",
    # Production pipeline
    "error.produce.already_running": "Production is already running for this item",
    "error.produce.plan_failed": "Plan generation failed; using fallback plan to continue",
    "error.produce.article_failed": "Article generation failed",
    "error.produce.interrupted": "Production was interrupted by a service restart",
    "error.produce.cancelled": "Production cancelled",
    "receipt.produce.started": "Production started",
    "receipt.produce.completed": "Production completed",
    # Image errors
    "error.image.unsupported_format": "Unsupported image format (only PNG, JPEG, WebP, GIF are accepted)",
    "error.image.too_large": "Image exceeds the maximum allowed size of 40 MB",
    "error.image.url_unresolved": "Could not resolve image URL",
    "error.image.no_provider": "No image generation provider is available",
    "error.image.rate_limited": "Image generation rate-limited (429); failed after {retries} retries",
    "error.image.timeout": "Image generation request timed out (300 s)",
    "error.image.auth_failed": "Image generation authentication failed (HTTP {status})",
    "error.image.not_found": "Image generation endpoint returned 404",
    # SSRF / URL errors
    "error.ssrf.blocked": "URL not allowed: {reason}",
    "error.ssrf.private_ip": "Target address is in a private network range and is not allowed",
    "error.ssrf.invalid_scheme": "URL must use http:// or https:// scheme",
    "error.ssrf.timeout": "Request timed out ({timeout} s)",
    "error.ssrf.too_large": "Response body exceeds size limit ({limit} bytes)",
    "error.ssrf.too_many_redirects": "Too many redirects (max {max})",
    # Monid errors
    "error.monid.missing": "Monid CLI not found; please install it first",
    "error.monid.no_key": "Monid has no API key configured",
    "error.monid.unsupported_platform": "Unsupported platform: {platform}",
    "error.monid.invalid_url": "Invalid account URL: {reason}",
    "error.monid.redirect_limit": "Short-link redirect limit exceeded (max {max})",
    "error.monid.import_in_progress": "Import already in progress; please try again later",
    "error.monid.cli_unavailable": "Monid CLI is unavailable",
    # Export errors
    "error.export.missing_asset": "Export failed: asset file not found: {filename}",
    "error.export.empty_article": "Cannot export: article is empty",
    "error.export.invalid_video_cover": "Video cover failed JPEG magic byte validation",
    "error.export.path_not_saved": "Production has not been saved yet",
    "receipt.export.saved": "Exported to: {path}",
    # Style / skills errors
    "error.style.text_too_short": "Text is too short for style extraction (minimum 80 characters)",
    "error.style.url_fetch_failed": "Failed to fetch URL: {url}",
    "error.skills.none_active": "No active skills available to export",
    "receipt.skills.learned": "Proposed {count} new skill rule(s)",
    "receipt.skills.exported": "Exported {count} skill rule(s) to {path}",
    # Upload errors
    "error.upload.too_large": "Upload exceeds 250 MB limit",
    "error.upload.unsupported_mime": "Unsupported media type: {mime}",
    "error.upload.invalid_filename": "Invalid filename",
    # LLM / model errors
    "error.llm.failed": "LLM call failed: {message}",
    "error.llm.invalid_response": "LLM returned an invalid response; falling back to local parsing",
    # Chat
    "notice.chat.revision_unavailable": "Revision is only available for completed productions",
    "receipt.chat.cleared": "Chat history cleared",
    # Settings test image
    "error.settings.test_failed": "Test image generation failed",
    "receipt.settings.test_ok": "Test image generated successfully",
    # Generic / fallback
    "error.internal": "Internal server error",
    "error.forbidden": "Forbidden",
    "error.request_too_large": "Request body too large",
}


# ---------------------------------------------------------------------------
# Message helper
# ---------------------------------------------------------------------------

def t(key: str, *args: object, **kwargs: object) -> str:
    """Return the English message for *key*.

    - Falls back to the raw *key* string when the key is absent from the map.
    - Performs ``str.format_map(kwargs)`` substitution when kwargs are provided.
    - Accepts optional positional args (e.g. legacy lang) for compatibility.
    """
    template = _STRINGS.get(key, key)

    if kwargs:
        try:
            return template.format_map(kwargs)
        except (KeyError, IndexError):
            return template

    return template
