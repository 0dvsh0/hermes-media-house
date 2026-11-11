"""
settings.py — SettingsManager for hermes-media-desk.

Owns all reads and writes to ``settings.json``.

Features:
- Deep-merge with DEFAULTS for missing keys (Requirement 3.1)
- Clamp imageCount [0,4] and shotCount [0,12]; non-finite retains current (Requirement 3.2)
- Reject invalid image.source with HTTP 400 (Requirement 3.3)
- Reject non-HTTP(S) baseUrl with HTTP 400 (Requirement 3.4)
- Reject non-JSON-object image.extra with HTTP 400 (Requirement 3.5)
- Reject mismatched assistant.provider/model with HTTP 400 (Requirement 3.6)
- imageReady logic for http vs tool source (Requirement 3.7)
- Never return raw apiKey; return hasKey + keyHint (Requirement 3.8)
- Silently ignore invalid language values (Requirement 3.9)
- Reject invalid toolSize with HTTP 400 (Requirement 3.10)
- Reject invalid toolQuality with HTTP 400 (Requirement 3.11)
- Atomic write via tmp file + os.replace, permissions 0o600 (Requirement 2.6)

Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 2.6
"""

from __future__ import annotations

import copy
import json
import logging
import math
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# plugin_data_dir helper (same pattern as store.py)
# ---------------------------------------------------------------------------

try:
    from hermes.plugin_utils import plugin_data_dir  # type: ignore[import]
except ImportError:  # pragma: no cover
    def plugin_data_dir(plugin_id: str) -> Path:  # type: ignore[misc]
        """Fallback: resolve to ~/.hermes/plugin_data/<plugin_id>/"""
        return Path.home() / ".hermes" / "plugin_data" / plugin_id

# ---------------------------------------------------------------------------
# HTTPException import — defensive, for validation errors
# ---------------------------------------------------------------------------

try:
    from fastapi import HTTPException  # type: ignore[import]
except ImportError:  # pragma: no cover
    class HTTPException(Exception):  # type: ignore[no-redef]
        """Minimal stand-in when FastAPI is not installed (tests only)."""
        def __init__(self, status_code: int, detail: str = "") -> None:
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

# ---------------------------------------------------------------------------
# Module-level flag for image provider registration
# ---------------------------------------------------------------------------

_TOOL_PROVIDER_REGISTERED: bool = False


def register_image_gen_provider() -> None:
    """Call this when a tool-based image generation provider is registered.

    Sets the module-level flag used by imageReady logic (Requirement 3.7).
    """
    global _TOOL_PROVIDER_REGISTERED
    _TOOL_PROVIDER_REGISTERED = True


# ---------------------------------------------------------------------------
# DEFAULTS
# ---------------------------------------------------------------------------

DEFAULTS: dict[str, Any] = {
    "image": {
        "source": "http",
        "baseUrl": "",
        "model": "",
        "apiKey": "",
        "size": "1536x1024",
        "quality": "",
        "toolSize": "1536x1024",
        "toolQuality": "",
        "extra": "",
    },
    "assistant": {"provider": "", "model": ""},
    "voice": "",
    "exportDir": "",
    "imageCount": 2,
    "shotCount": 6,
    "language": "auto",
}

# ---------------------------------------------------------------------------
# Validation constants
# ---------------------------------------------------------------------------

_VALID_SOURCES = {"http", "tool"}
_VALID_TOOL_SIZES = {"1024x1024", "1024x1536", "1536x1024", "auto"}
_VALID_TOOL_QUALITIES = {"low", "medium", "high", "auto"}
_VALID_LANGUAGES = {"auto", "zh", "en"}


# ---------------------------------------------------------------------------
# Deep-merge helper
# ---------------------------------------------------------------------------

def _deep_merge(base: dict, override: dict) -> dict:
    """Return a new dict that is *base* deep-merged with *override*.

    For nested dicts, recursively merge; scalar values in *override* win.
    """
    result = copy.deepcopy(base)
    for key, value in override.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


# ---------------------------------------------------------------------------
# SettingsManager
# ---------------------------------------------------------------------------

class SettingsManager:
    """Manages settings.json with validation and atomic writes."""

    def __init__(self) -> None:
        data_dir: Path = plugin_data_dir("hermes-media-desk")
        self._path: Path = data_dir / "settings.json"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def load(self) -> dict:
        """Read settings.json, deep-merge with DEFAULTS for missing keys.

        Returns merged dict. If file is absent or corrupt, returns DEFAULTS copy.

        Requirement 3.1
        """
        if not self._path.exists():
            return copy.deepcopy(DEFAULTS)

        try:
            text = self._path.read_text(encoding="utf-8")
            stored = json.loads(text)
        except (json.JSONDecodeError, ValueError, OSError) as exc:
            logger.warning(
                "hermes-media-desk: settings.json could not be read (%s); "
                "falling back to defaults.",
                exc,
            )
            return copy.deepcopy(DEFAULTS)

        return _deep_merge(DEFAULTS, stored)

    async def save(self, patch: dict) -> dict:
        """Validate patch, merge into current settings, write atomically.

        Calls _validate(patch) first (raises HTTPException on invalid input).
        Clamps imageCount / shotCount after validation.
        Writes to settings.json with permissions 0o600 via tmp+rename.

        Returns the full updated settings dict.

        Requirements 2.6, 3.2, 3.3–3.11
        """
        # Work on a shallow copy so we can strip invalid keys without
        # modifying the caller's dict.
        patch = dict(patch)

        # Strip / silently ignore invalid language (Requirement 3.9)
        # _validate() already does this; we do it once here and pass clean patch.
        self._validate(patch)

        # Clamp imageCount (Requirement 3.2)
        if "imageCount" in patch:
            clamped = _clamp_int(patch["imageCount"], lo=0, hi=4)
            if clamped is None:
                del patch["imageCount"]
            else:
                patch["imageCount"] = clamped

        # Clamp shotCount (Requirement 3.2)
        if "shotCount" in patch:
            clamped = _clamp_int(patch["shotCount"], lo=0, hi=12)
            if clamped is None:
                del patch["shotCount"]
            else:
                patch["shotCount"] = clamped

        current = await self.load()
        updated = _deep_merge(current, patch)
        await self._write_atomic(updated)
        return updated

    async def get_public(self) -> dict:
        """Return settings with apiKey masked and imageReady computed.

        - Removes image.apiKey
        - Adds image.hasKey: bool (True when apiKey is non-empty)
        - Adds image.keyHint: str (last 4 chars if len >= 4, else "")
        - Adds top-level imageReady: bool

        Requirement 3.7, 3.8
        """
        settings = await self.load()
        public = copy.deepcopy(settings)

        image = public.get("image", {})
        api_key: str = image.pop("apiKey", "")

        image["hasKey"] = len(api_key) > 0
        image["keyHint"] = api_key[-4:] if len(api_key) >= 4 else ""
        public["image"] = image

        # imageReady logic (Requirement 3.7)
        source = image.get("source", "http")
        if source == "tool":
            public["imageReady"] = _TOOL_PROVIDER_REGISTERED
        else:
            # http mode: all three must be non-empty
            public["imageReady"] = bool(
                api_key
                and image.get("baseUrl", "")
                and image.get("model", "")
            )

        return public

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _validate(self, patch: dict) -> None:
        """Raise HTTPException(400) for invalid fields in *patch*.

        Silently strips invalid ``language`` values rather than raising.

        Requirements 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11
        """
        image = patch.get("image", {})
        if not isinstance(image, dict):
            image = {}

        # --- image.source (Requirement 3.3) ---
        source = image.get("source")
        if source is not None and source not in _VALID_SOURCES:
            raise HTTPException(
                status_code=400,
                detail=f"image.source must be one of {sorted(_VALID_SOURCES)}; got {source!r}",
            )

        # --- image.baseUrl (Requirement 3.4) ---
        base_url = image.get("baseUrl")
        if base_url is not None and base_url != "":
            if not (base_url.startswith("http://") or base_url.startswith("https://")):
                raise HTTPException(
                    status_code=400,
                    detail="image.baseUrl must start with 'http://' or 'https://'",
                )

        # --- image.extra (Requirement 3.5) ---
        extra = image.get("extra")
        if extra is not None and extra != "":
            try:
                parsed = json.loads(extra)
            except (json.JSONDecodeError, ValueError):
                raise HTTPException(
                    status_code=400,
                    detail="image.extra must be a valid JSON object string",
                )
            if not isinstance(parsed, dict):
                raise HTTPException(
                    status_code=400,
                    detail="image.extra must be a JSON object (not an array or scalar)",
                )

        # --- image.toolSize (Requirement 3.10) ---
        tool_size = image.get("toolSize")
        if tool_size is not None and tool_size != "" and tool_size not in _VALID_TOOL_SIZES:
            raise HTTPException(
                status_code=400,
                detail=f"image.toolSize must be one of {sorted(_VALID_TOOL_SIZES)}; got {tool_size!r}",
            )

        # --- image.toolQuality (Requirement 3.11) ---
        tool_quality = image.get("toolQuality")
        if tool_quality is not None and tool_quality != "" and tool_quality not in _VALID_TOOL_QUALITIES:
            raise HTTPException(
                status_code=400,
                detail=f"image.toolQuality must be one of {sorted(_VALID_TOOL_QUALITIES)}; got {tool_quality!r}",
            )

        # --- assistant.provider / assistant.model (Requirement 3.6) ---
        assistant = patch.get("assistant", {})
        if isinstance(assistant, dict):
            provider = assistant.get("provider")
            model = assistant.get("model")
            # Only validate when at least one of them is present in the patch
            if provider is not None or model is not None:
                p_empty = not provider  # None or ""
                m_empty = not model     # None or ""
                if p_empty != m_empty:
                    raise HTTPException(
                        status_code=400,
                        detail="assistant.provider and assistant.model must both be set or both be empty",
                    )

        # --- language: silently ignore invalid values (Requirement 3.9) ---
        lang = patch.get("language")
        if lang is not None and lang not in _VALID_LANGUAGES:
            # Strip the invalid value so it won't overwrite the stored one
            del patch["language"]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _write_atomic(self, settings: dict) -> None:
        """Serialize *settings* to JSON and atomically replace settings.json.

        Steps:
          1. Ensure parent directory exists
          2. Write to ``settings.json.<pid>.tmp``
          3. ``os.replace(tmp, settings.json)``
          4. ``os.chmod(settings.json, 0o600)``

        Requirement 2.6
        """
        self._path.parent.mkdir(parents=True, exist_ok=True)

        pid = os.getpid()
        tmp_path = self._path.parent / f"settings.json.{pid}.tmp"

        json_text = json.dumps(settings, ensure_ascii=False, indent=2)
        tmp_path.write_text(json_text, encoding="utf-8")

        try:
            os.replace(str(tmp_path), str(self._path))
        except Exception:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise

        try:
            os.chmod(str(self._path), 0o600)
        except OSError:
            # Windows may not support chmod — not fatal
            pass


# ---------------------------------------------------------------------------
# Integer clamping helper
# ---------------------------------------------------------------------------

def _clamp_int(value: Any, lo: int, hi: int) -> int | None:
    """Try to convert *value* to int and clamp to [lo, hi].

    Returns the clamped int, or ``None`` when value is non-finite,
    None, or cannot be converted to int.

    Requirement 3.2
    """
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(f):
        return None
    return int(max(lo, min(hi, int(f))))
