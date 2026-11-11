"""
store.py — StoreManager for hermes-media-desk.

Owns all reads and writes to ``state.json``.

Features:
- Atomic write via tmp file + os.replace (Requirement 2.5)
- mtime-based cache invalidation (Requirement 2.3)
- asyncio.Lock-serialized writes (Requirement 2.4)
- Forward schema migrations, idempotent (Requirement 2.8)
- Preset cleanup migration (Requirement 2.9)
- Seed state on first run / JSON parse failure (Requirements 2.7, 2.10)
- Create files/ subdir on first access (Requirement 2.2)
- Store at plugin_data_dir("hermes-media-desk")/state.json (Requirement 2.1)

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Version constants
# ---------------------------------------------------------------------------

CURRENT_VERSION: int = 4
PRESET_VERSION: int = 2  # v2: no built-in style presets ship with the plugin

# Legacy collections scanned by the v4 sample-data cleanup migration
_SAMPLE_SCANNED_COLLECTIONS = ("items", "people", "angles", "styles", "skills", "metrics", "accounts")
_LEGACY_RECORD_KEYS = ("sample", "otherLang", "_lang", "userEdited")

# ---------------------------------------------------------------------------
# plugin_data_dir helper
# ---------------------------------------------------------------------------

try:
    from hermes.plugin_utils import plugin_data_dir  # type: ignore[import]
except ImportError:  # pragma: no cover
    def plugin_data_dir(plugin_id: str) -> Path:  # type: ignore[misc]
        """Fallback: resolve to ~/.hermes/plugin_data/<plugin_id>/"""
        return Path.home() / ".hermes" / "plugin_data" / plugin_id

# ---------------------------------------------------------------------------
# seed_state import — defensive, Task 5 will provide the real implementation
# ---------------------------------------------------------------------------

try:
    from dashboard.seed import seed_state  # type: ignore[import]
except ImportError:
    def seed_state() -> dict:  # type: ignore[misc]
        return {
            "version": 4,
            "items": [],
            "people": [],
            "angles": [],
            "styles": [],
            "skills": [],
            "accounts": [],
            "metrics": [],
            "chat": [],
            "activeStyleId": None,
            "modelStatus": {"ok": True, "error": None},
            "presetVersion": 0,
        }


# ---------------------------------------------------------------------------
# StoreManager
# ---------------------------------------------------------------------------

class StoreManager:
    """Thread-safe (asyncio) JSON store manager with atomic writes and mtime caching."""

    def __init__(self) -> None:
        data_dir: Path = plugin_data_dir("hermes-media-desk")
        self._path: Path = data_dir / "state.json"
        self._lock: asyncio.Lock = asyncio.Lock()
        self._cache: dict | None = None
        self._mtime: int | None = None          # st_mtime_ns
        self._files_ensured: bool = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def load(self) -> dict:
        """Read state, running migrations. Returns seed state on parse failure.

        Requirements 2.3, 2.7, 2.8, 2.9, 2.10
        """
        self._ensure_files_dir()

        # --- Determine whether we need to (re-)read from disk -----------
        needs_read = self._cache is None

        if not needs_read:
            try:
                current_mtime = self._path.stat().st_mtime_ns
                if current_mtime != self._mtime:
                    needs_read = True
            except FileNotFoundError:
                needs_read = True

        if needs_read:
            raw = await self._read_or_seed()
            self._cache = raw
            try:
                self._mtime = self._path.stat().st_mtime_ns
            except FileNotFoundError:
                self._mtime = None

        # --- Apply migrations to a *copy* of the cached state ----------
        # We always run migrate so callers receive a fully-migrated dict.
        try:
            migrated = self._migrate(dict(self._cache))  # type: ignore[arg-type]
        except Exception as exc:
            raise RuntimeError(f"State migration failed: {exc}") from exc

        # --- Preset migration (applied on every load per Requirement 2.9) ---
        try:
            migrated = self._migrate_presets(migrated)
        except Exception as exc:
            raise RuntimeError(f"State migration failed: {exc}") from exc

        return migrated

    async def save(self, state: dict) -> None:
        """Atomic write via tmp file + os.replace. Serialized through _lock.

        Requirements 2.4, 2.5
        """
        async with self._lock:
            await self._write_atomic(state)

    async def get(self) -> dict:
        """Alias for load()."""
        return await self.load()

    async def put(self, state: dict) -> None:
        """Alias for save()."""
        await self.save(state)

    async def update(self, fn: Callable[[dict], dict]) -> dict:
        """Load → transform → save in one locked operation. Returns new state.

        The entire sequence is executed under the same lock acquisition so that
        no other coroutine can interleave a write between the load and the save.

        Requirement 2.4
        """
        async with self._lock:
            # Read the current state without acquiring the lock again
            current = await self._load_unlocked()
            new_state = fn(current)
            await self._write_atomic(new_state)
            return new_state

    # ------------------------------------------------------------------
    # Migration helpers
    # ------------------------------------------------------------------

    def _migrate(self, state: dict) -> dict:
        """Apply all forward schema migrations. Idempotent.

        Migrations:
          0 → 1: Add ``presetVersion: 0``
          1 → 2: Add ``modelStatus: {ok: true, error: null}``
          2 → 3: Add ``angles: []`` if missing
          3 → 4: Drop sample/demo records and legacy i18n bookkeeping fields

        Requirement 2.8
        """
        version = state.get("version", 0)

        # 0 → 1
        if version < 1:
            if "presetVersion" not in state:
                state["presetVersion"] = 0
            if "sampleCleared" not in state:
                state["sampleCleared"] = False
            state["version"] = 1
            version = 1

        # 1 → 2
        if version < 2:
            if "modelStatus" not in state:
                state["modelStatus"] = {"ok": True, "error": None}
            state["version"] = 2
            version = 2

        # 2 → 3
        if version < 3:
            if "angles" not in state:
                state["angles"] = []
            state["version"] = 3
            version = 3

        # 3 → 4: remove sample/demo data and bilingual plumbing (English-only)
        if version < 4:
            state.pop("sampleLang", None)
            if "sampleCleared" not in state:
                state["sampleCleared"] = False
            for col in _SAMPLE_SCANNED_COLLECTIONS:
                arr = state.get(col)
                if not isinstance(arr, list):
                    continue
                cleaned = []
                for rec in arr:
                    if not isinstance(rec, dict):
                        continue
                    if rec.get("sample"):
                        continue
                    for key in _LEGACY_RECORD_KEYS[1:]:
                        rec.pop(key, None)
                    cleaned.append(rec)
                state[col] = cleaned
            state["version"] = 4

        return state

    def _migrate_presets(self, state: dict) -> dict:
        """Drop built-in style presets; keep user-created styles.

        The plugin no longer ships style presets (no bundled sample data).
        Triggered when ``state.presetVersion`` is absent, null, or below
        ``PRESET_VERSION``.

        Requirement 2.9
        """
        preset_ver = state.get("presetVersion")
        if preset_ver is None or preset_ver < PRESET_VERSION:
            styles: list[dict] = state.get("styles", [])

            # Keep user-created styles only — presets are discarded.
            user_styles = [s for s in styles if not s.get("preset", False)]

            state["styles"] = user_styles
            state["presetVersion"] = PRESET_VERSION

        return state

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _ensure_files_dir(self) -> None:
        """Create the files/ subdir on first access.

        Requirement 2.2
        """
        if self._files_ensured:
            return
        files_dir = self._path.parent / "files"
        files_dir.mkdir(parents=True, exist_ok=True)
        self._files_ensured = True

    async def _read_or_seed(self) -> dict:
        """Read state.json from disk or write seed state if absent/corrupt.

        Requirements 2.7, 2.10
        """
        if not self._path.exists():
            # First run — write seed state
            seed = seed_state()
            await self._write_atomic(seed)
            return seed

        # Attempt to parse existing file
        try:
            text = self._path.read_text(encoding="utf-8")
            return json.loads(text)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning(
                "hermes-media-desk: state.json could not be parsed (%s); "
                "discarding and resetting to seed state.",
                exc,
            )
            seed = seed_state()
            await self._write_atomic(seed)
            return seed

    async def _load_unlocked(self) -> dict:
        """Like load(), but assumes the caller already holds _lock."""
        self._ensure_files_dir()

        needs_read = self._cache is None
        if not needs_read:
            try:
                current_mtime = self._path.stat().st_mtime_ns
                if current_mtime != self._mtime:
                    needs_read = True
            except FileNotFoundError:
                needs_read = True

        if needs_read:
            raw = await self._read_or_seed()
            self._cache = raw
            try:
                self._mtime = self._path.stat().st_mtime_ns
            except FileNotFoundError:
                self._mtime = None

        try:
            migrated = self._migrate(dict(self._cache))  # type: ignore[arg-type]
        except Exception as exc:
            raise RuntimeError(f"State migration failed: {exc}") from exc

        try:
            migrated = self._migrate_presets(migrated)
        except Exception as exc:
            raise RuntimeError(f"State migration failed: {exc}") from exc

        return migrated

    async def _write_atomic(self, state: dict) -> None:
        """Serialize *state* to JSON and atomically replace state.json.

        Steps:
          1. Serialize to JSON string
          2. Write to ``state.json.<pid>.tmp``
          3. ``os.replace(tmp, state.json)``
          4. Update in-process cache + mtime

        Note: caller is responsible for acquiring ``_lock`` when needed.

        Requirement 2.5
        """
        # Ensure the parent directory exists
        self._path.parent.mkdir(parents=True, exist_ok=True)

        pid = os.getpid()
        tmp_path = self._path.parent / f"state.json.{pid}.tmp"

        json_text = json.dumps(state, ensure_ascii=False, indent=2)
        tmp_path.write_text(json_text, encoding="utf-8")

        try:
            os.replace(str(tmp_path), str(self._path))
        except Exception:
            # Clean up the tmp file if replace fails
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise

        # Refresh the in-process cache
        self._cache = state
        try:
            self._mtime = self._path.stat().st_mtime_ns
        except FileNotFoundError:
            self._mtime = None
