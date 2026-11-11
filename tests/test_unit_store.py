"""
Unit tests for dashboard/store.py — StoreManager

Covers:
- _migrate(): all three forward migrations, idempotency
- _migrate_presets(): stale preset removal, missing built-in addition
- load(): mtime caching, seed on missing file, seed on JSON parse failure
- save() / update(): atomic write, lock serialization
- _ensure_files_dir(): files/ subdir creation on first access
- RuntimeError raised on migration exception

Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Path setup — allow importing from the workspace dashboard package
# ---------------------------------------------------------------------------

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dashboard.store import (
    CURRENT_VERSION,
    PRESET_VERSION,
    StoreManager,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_store(tmp_path: Path) -> StoreManager:
    """Create a StoreManager whose data dir is redirected to *tmp_path*."""
    store = StoreManager.__new__(StoreManager)
    store._path = tmp_path / "state.json"
    store._lock = asyncio.Lock()
    store._cache = None
    store._mtime = None
    store._files_ensured = False
    return store


def _run(coro):
    """Run an async coroutine synchronously in tests."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# _migrate — basic forward migrations
# ---------------------------------------------------------------------------

class TestMigrate:
    def test_v0_to_v3_adds_all_fields(self, tmp_path):
        store = _make_store(tmp_path)
        state = {"version": 0, "items": []}
        result = store._migrate(state)
        assert result["version"] == CURRENT_VERSION
        assert result["sampleCleared"] is False
        assert result["presetVersion"] == 0
        assert result["modelStatus"] == {"ok": True, "error": None}
        assert result["angles"] == []

    def test_v1_to_v3_adds_modelStatus_and_angles(self, tmp_path):
        store = _make_store(tmp_path)
        state = {"version": 1, "sampleCleared": True, "presetVersion": 1}
        result = store._migrate(state)
        assert result["version"] == CURRENT_VERSION
        assert result["modelStatus"] == {"ok": True, "error": None}
        assert result["angles"] == []
        # Existing field preserved
        assert result["sampleCleared"] is True

    def test_v2_to_v3_adds_angles(self, tmp_path):
        store = _make_store(tmp_path)
        state = {
            "version": 2,
            "sampleCleared": False,
            "presetVersion": 0,
            "modelStatus": {"ok": True, "error": None},
        }
        result = store._migrate(state)
        assert result["version"] == CURRENT_VERSION
        assert result["angles"] == []

    def test_v3_unchanged(self, tmp_path):
        store = _make_store(tmp_path)
        angles = [{"id": "a1"}]
        state = {
            "version": CURRENT_VERSION,
            "sampleCleared": False,
            "presetVersion": 0,
            "modelStatus": {"ok": True, "error": None},
            "angles": angles,
        }
        result = store._migrate(state)
        assert result["version"] == CURRENT_VERSION
        assert result["angles"] is angles  # no copy made at this level

    def test_idempotent_v0(self, tmp_path):
        """Calling _migrate twice on the same state must yield the same result."""
        store = _make_store(tmp_path)
        state = {"version": 0}
        result1 = store._migrate(state.copy())
        result2 = store._migrate(result1.copy())
        assert result1 == result2

    def test_idempotent_v3(self, tmp_path):
        store = _make_store(tmp_path)
        state = {
            "version": CURRENT_VERSION,
            "sampleCleared": False,
            "presetVersion": 1,
            "modelStatus": {"ok": True, "error": None},
            "angles": [],
        }
        result1 = store._migrate(state.copy())
        result2 = store._migrate(result1.copy())
        assert result1 == result2

    def test_no_version_key_treated_as_v0(self, tmp_path):
        store = _make_store(tmp_path)
        state = {"items": []}
        result = store._migrate(state)
        assert result["version"] == CURRENT_VERSION
        assert "sampleCleared" in result

    def test_migration_preserves_existing_sampleCleared(self, tmp_path):
        """If sampleCleared is already set, migration must not overwrite it."""
        store = _make_store(tmp_path)
        state = {"version": 0, "sampleCleared": True}
        result = store._migrate(state)
        assert result["sampleCleared"] is True

    def test_migration_preserves_existing_angles(self, tmp_path):
        """If angles already exists in v2 state, it must not be replaced."""
        store = _make_store(tmp_path)
        existing_angles = [{"id": "ang1", "title": "Test"}]
        state = {
            "version": 2,
            "modelStatus": {"ok": True, "error": None},
            "angles": existing_angles,
        }
        result = store._migrate(state)
        assert result["angles"] == existing_angles


# ---------------------------------------------------------------------------
# _migrate_presets
# ---------------------------------------------------------------------------

class TestMigratePresets:
    def _base_state(self) -> dict:
        return {
            "version": 3,
            "styles": [],
            "presetVersion": 0,
        }

    def test_no_migration_when_preset_version_current(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        state["presetVersion"] = PRESET_VERSION
        original_styles = list(state["styles"])
        result = store._migrate_presets(state)
        assert result["presetVersion"] == PRESET_VERSION
        assert result["styles"] == original_styles

    def test_missing_preset_version_triggers_migration(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        del state["presetVersion"]
        result = store._migrate_presets(state)
        assert result["presetVersion"] == PRESET_VERSION

    def test_null_preset_version_triggers_migration(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        state["presetVersion"] = None
        result = store._migrate_presets(state)
        assert result["presetVersion"] == PRESET_VERSION

    def test_stale_preset_removed(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        stale = {"id": "old_stale_preset", "name": "Stale", "preset": True, "sample": True}
        state["styles"] = [stale]
        result = store._migrate_presets(state)
        ids = [s["id"] for s in result["styles"]]
        assert "old_stale_preset" not in ids

    def test_presets_discarded_on_migration(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        preset = {"id": "sample_preset", "name": "Sample Preset", "preset": True}
        state["styles"] = [preset]
        result = store._migrate_presets(state)
        assert result["styles"] == []

    def test_user_styles_always_preserved(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        user_style = {"id": "my-custom-style", "name": "My Style", "preset": False}
        state["styles"] = [user_style]
        result = store._migrate_presets(state)
        ids = [s["id"] for s in result["styles"]]
        assert "my-custom-style" in ids

    def test_no_presets_added_when_empty(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        state["styles"] = []
        result = store._migrate_presets(state)
        assert result["styles"] == []

    def test_idempotent_migration(self, tmp_path):
        store = _make_store(tmp_path)
        state = self._base_state()
        result1 = store._migrate_presets(state.copy())
        result2 = store._migrate_presets(result1.copy())
        # presetVersion should stay at PRESET_VERSION after second call
        assert result1["presetVersion"] == result2["presetVersion"]
        # styles list should be stable (same ids)
        ids1 = sorted(s["id"] for s in result1["styles"])
        ids2 = sorted(s["id"] for s in result2["styles"])
        assert ids1 == ids2


# ---------------------------------------------------------------------------
# _ensure_files_dir
# ---------------------------------------------------------------------------

class TestEnsureFilesDir:
    def test_creates_files_subdir(self, tmp_path):
        store = _make_store(tmp_path)
        files_dir = tmp_path / "files"
        assert not files_dir.exists()
        store._ensure_files_dir()
        assert files_dir.is_dir()

    def test_idempotent_called_twice(self, tmp_path):
        store = _make_store(tmp_path)
        store._ensure_files_dir()
        store._ensure_files_dir()  # must not raise
        assert (tmp_path / "files").is_dir()

    def test_flag_prevents_repeated_mkdir(self, tmp_path):
        store = _make_store(tmp_path)
        store._ensure_files_dir()
        assert store._files_ensured is True
        # Remove directory to prove the flag short-circuits the check
        (tmp_path / "files").rmdir()
        store._ensure_files_dir()  # should NOT recreate because flag is True
        assert not (tmp_path / "files").exists()


# ---------------------------------------------------------------------------
# load() — seed state on missing file
# ---------------------------------------------------------------------------

class TestLoadSeedOnMissingFile:
    def test_seed_written_when_no_state_json(self, tmp_path):
        store = _make_store(tmp_path)
        state = _run(store.load())
        assert isinstance(state, dict)
        assert (tmp_path / "state.json").exists()

    def test_seed_state_has_expected_keys(self, tmp_path):
        store = _make_store(tmp_path)
        state = _run(store.load())
        for key in ("version", "items", "people", "angles", "styles", "skills",
                    "accounts", "metrics", "chat", "sampleCleared", "presetVersion",
                    "modelStatus"):
            assert key in state, f"Missing key in seed state: {key}"

    def test_seed_version_is_current(self, tmp_path):
        store = _make_store(tmp_path)
        state = _run(store.load())
        assert state["version"] == CURRENT_VERSION


# ---------------------------------------------------------------------------
# load() — mtime-based cache invalidation
# ---------------------------------------------------------------------------

class TestLoadMtimeInvalidation:
    def test_cache_used_when_mtime_unchanged(self, tmp_path):
        store = _make_store(tmp_path)
        # First load — writes seed and populates cache
        state1 = _run(store.load())
        # Inject a sentinel value into the cache without touching the file
        store._cache = {"version": 3, "_sentinel": True, "styles": [], "presetVersion": PRESET_VERSION}
        # Second load — mtime is the same, so cache should be used
        state2 = _run(store.load())
        assert state2.get("_sentinel") is True

    def test_disk_re_read_when_mtime_changes(self, tmp_path):
        store = _make_store(tmp_path)
        _run(store.load())  # populate cache

        # Write new content to disk
        new_state = {
            "version": 3,
            "items": [{"id": "new"}],
            "people": [],
            "angles": [],
            "styles": [],
            "skills": [],
            "accounts": [],
            "metrics": [],
            "chat": [],
            "activeStyleId": None,
            "sampleLang": "zh",
            "sampleCleared": False,
            "presetVersion": PRESET_VERSION,
            "modelStatus": {"ok": True, "error": None},
        }
        # Force mtime to change by sleeping a tick then writing
        time.sleep(0.01)
        (tmp_path / "state.json").write_text(
            json.dumps(new_state, ensure_ascii=False), encoding="utf-8"
        )
        # Invalidate cached mtime to simulate changed mtime
        store._mtime = None

        state = _run(store.load())
        assert any(item.get("id") == "new" for item in state.get("items", []))


# ---------------------------------------------------------------------------
# load() — JSON parse failure
# ---------------------------------------------------------------------------

class TestLoadParseFailure:
    def test_corrupt_json_triggers_seed_reset(self, tmp_path):
        store = _make_store(tmp_path)
        # Write corrupt JSON
        (tmp_path / "state.json").write_text("{corrupt json}", encoding="utf-8")
        state = _run(store.load())
        # Should return a valid seed state
        assert isinstance(state, dict)
        assert "version" in state

    def test_seed_written_on_parse_failure(self, tmp_path):
        store = _make_store(tmp_path)
        (tmp_path / "state.json").write_text("not valid json at all!", encoding="utf-8")
        _run(store.load())
        # state.json should now contain valid JSON
        text = (tmp_path / "state.json").read_text(encoding="utf-8")
        parsed = json.loads(text)
        assert isinstance(parsed, dict)
        assert "version" in parsed


# ---------------------------------------------------------------------------
# save() — atomic write
# ---------------------------------------------------------------------------

class TestSave:
    def test_state_written_to_disk(self, tmp_path):
        store = _make_store(tmp_path)
        payload = {
            "version": 3,
            "items": [{"id": "item-1", "title": "Hello"}],
            "people": [],
            "angles": [],
            "styles": [],
            "skills": [],
            "accounts": [],
            "metrics": [],
            "chat": [],
            "activeStyleId": None,
            "sampleLang": "zh",
            "sampleCleared": False,
            "presetVersion": PRESET_VERSION,
            "modelStatus": {"ok": True, "error": None},
        }
        _run(store.save(payload))
        text = (tmp_path / "state.json").read_text(encoding="utf-8")
        loaded = json.loads(text)
        assert loaded["items"][0]["id"] == "item-1"

    def test_no_tmp_file_left_after_save(self, tmp_path):
        store = _make_store(tmp_path)
        _run(store.save({"version": 3, "styles": [], "presetVersion": PRESET_VERSION}))
        pid = os.getpid()
        tmp = tmp_path / f"state.json.{pid}.tmp"
        assert not tmp.exists()

    def test_cache_updated_after_save(self, tmp_path):
        store = _make_store(tmp_path)
        payload = {
            "version": 3,
            "items": [{"id": "saved-item"}],
            "styles": [],
            "presetVersion": PRESET_VERSION,
        }
        _run(store.save(payload))
        assert store._cache is not None
        assert store._cache.get("items", [{}])[0].get("id") == "saved-item"

    def test_mtime_updated_after_save(self, tmp_path):
        store = _make_store(tmp_path)
        _run(store.save({"version": 3, "styles": [], "presetVersion": PRESET_VERSION}))
        assert store._mtime is not None


# ---------------------------------------------------------------------------
# update() — atomic load-transform-save
# ---------------------------------------------------------------------------

class TestUpdate:
    def test_transform_applied_and_persisted(self, tmp_path):
        store = _make_store(tmp_path)
        # Set up initial state
        initial = {
            "version": 3,
            "counter": 0,
            "styles": [],
            "presetVersion": PRESET_VERSION,
        }
        _run(store.save(initial))

        def increment(s: dict) -> dict:
            s = dict(s)
            s["counter"] = s.get("counter", 0) + 1
            return s

        result = _run(store.update(increment))
        assert result["counter"] == 1

        # Verify disk reflects the change
        text = (tmp_path / "state.json").read_text(encoding="utf-8")
        disk = json.loads(text)
        assert disk["counter"] == 1

    def test_update_returns_new_state(self, tmp_path):
        store = _make_store(tmp_path)
        _run(store.save({
            "version": 3,
            "flag": False,
            "styles": [],
            "presetVersion": PRESET_VERSION,
        }))

        def set_flag(s: dict) -> dict:
            s = dict(s)
            s["flag"] = True
            return s

        new_state = _run(store.update(set_flag))
        assert new_state["flag"] is True


# ---------------------------------------------------------------------------
# Migration RuntimeError on failure
# ---------------------------------------------------------------------------

class TestMigrationError:
    def test_broken_migrate_raises_runtime_error(self, tmp_path):
        store = _make_store(tmp_path)
        # Seed the file with valid JSON
        (tmp_path / "state.json").write_text(
            json.dumps({"version": 3, "styles": [], "presetVersion": PRESET_VERSION}),
            encoding="utf-8",
        )

        def bad_migrate(state):
            raise ValueError("intentional failure")

        store._migrate = bad_migrate  # type: ignore[method-assign]
        with pytest.raises(RuntimeError, match="State migration failed"):
            _run(store.load())

    def test_broken_migrate_presets_raises_runtime_error(self, tmp_path):
        store = _make_store(tmp_path)
        (tmp_path / "state.json").write_text(
            json.dumps({"version": 3, "styles": [], "presetVersion": PRESET_VERSION}),
            encoding="utf-8",
        )

        def bad_presets(state):
            raise ValueError("preset migration broke")

        store._migrate_presets = bad_presets  # type: ignore[method-assign]
        with pytest.raises(RuntimeError, match="State migration failed"):
            _run(store.load())


# ---------------------------------------------------------------------------
# Concurrency — async lock prevents concurrent writes
# ---------------------------------------------------------------------------

class TestConcurrency:
    def test_concurrent_saves_do_not_corrupt_state(self, tmp_path):
        """Multiple concurrent save() calls must all complete without corruption."""
        store = _make_store(tmp_path)
        states = [
            {"version": 3, "counter": i, "styles": [], "presetVersion": PRESET_VERSION}
            for i in range(10)
        ]

        async def run():
            await asyncio.gather(*[store.save(s) for s in states])

        asyncio.run(run())

        # Result should be valid JSON — one of the saved states
        text = (tmp_path / "state.json").read_text(encoding="utf-8")
        result = json.loads(text)
        assert isinstance(result, dict)
        assert "counter" in result
