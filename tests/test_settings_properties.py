"""
Property-based tests for dashboard/settings.py — SettingsManager

Property 7: Settings Integer Clamping
  For any imageCount / shotCount value (int, float, inf, nan, None, string),
  the stored value is always an integer in [0, 4] / [0, 12] OR the
  previously stored default value (when input is non-finite / non-numeric).

Property 8: Settings API Key Masking
  For any non-empty apiKey string, get_public() never contains the raw key;
  always contains hasKey: True; keyHint is at most 4 chars and equals the
  last 4 chars (or "" when len < 4).
  When apiKey is "", hasKey is False and keyHint is "".

Validates: Requirements 3.2, 3.8
"""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path

import pytest
from hypothesis import HealthCheck, assume
from hypothesis import given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Path setup — allow importing from the plugin root
# ---------------------------------------------------------------------------

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.settings import (  # noqa: E402
    DEFAULTS,
    SettingsManager,
    _clamp_int,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(coro):
    """Run an async coroutine synchronously in tests."""
    return asyncio.run(coro)


def _make_manager(tmp_dir: str) -> SettingsManager:
    """Create a SettingsManager whose settings file lives in *tmp_dir*."""
    mgr = SettingsManager.__new__(SettingsManager)
    mgr._path = Path(tmp_dir) / "settings.json"
    return mgr


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# A broad numeric strategy covering int, float, inf, nan
_numeric_st = st.one_of(
    st.integers(min_value=-(2**31), max_value=2**31),
    st.floats(allow_nan=True, allow_infinity=True),
)

# Any value that could arrive as imageCount / shotCount
_count_value_st = st.one_of(
    _numeric_st,
    st.none(),
    st.text(max_size=20),   # strings like "3", "abc", ""
    st.booleans(),          # True/False are ints in Python
)

# Non-empty printable ASCII strings for API keys
_api_key_st = st.text(
    alphabet=st.characters(min_codepoint=33, max_codepoint=126),
    min_size=1,
    max_size=128,
)

# Short API keys (1–3 chars) for the "hint empty when key too short" test
_short_api_key_st = st.text(
    alphabet=st.characters(min_codepoint=33, max_codepoint=126),
    min_size=1,
    max_size=3,
)


# ---------------------------------------------------------------------------
# Property 7: Settings Integer Clamping — imageCount
# ---------------------------------------------------------------------------

class TestProperty7ImageCount:
    """
    **Validates: Requirements 3.2**

    For any imageCount value, after save() the stored imageCount is always
    an integer in [0, 4] OR the previously stored default (2) if the value
    was non-finite / non-numeric.
    """

    @given(value=_count_value_st)
    @h_settings(
        max_examples=200,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_imageCount_always_valid(self, value):
        """Stored imageCount is always an int in [0, 4]."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            try:
                result = _run(mgr.save({"imageCount": value}))
            except Exception as exc:
                pytest.fail(
                    f"save() raised unexpectedly for imageCount={value!r}: {exc}"
                )

            stored = result["imageCount"]
            assert isinstance(stored, int), (
                f"imageCount should be int, got {type(stored).__name__!r} "
                f"for input {value!r}"
            )
            assert 0 <= stored <= 4, (
                f"imageCount {stored} is out of [0, 4] for input {value!r}"
            )

    @given(value=_count_value_st)
    @h_settings(
        max_examples=200,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_imageCount_non_numeric_retains_default(self, value):
        """When value is non-finite/non-numeric, stored value equals prior/default."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            clamped = _clamp_int(value, 0, 4)
            result = _run(mgr.save({"imageCount": value}))
            stored = result["imageCount"]

            if clamped is None:
                assert stored == DEFAULTS["imageCount"], (
                    f"Expected default {DEFAULTS['imageCount']} but got {stored} "
                    f"for non-numeric imageCount={value!r}"
                )
            else:
                assert stored == clamped, (
                    f"Expected clamped {clamped} but got {stored} "
                    f"for imageCount={value!r}"
                )


# ---------------------------------------------------------------------------
# Property 7: Settings Integer Clamping — shotCount
# ---------------------------------------------------------------------------

class TestProperty7ShotCount:
    """
    **Validates: Requirements 3.2**

    For any shotCount value, after save() the stored shotCount is always
    an integer in [0, 12] OR the previously stored default (6) if the value
    was non-finite / non-numeric.
    """

    @given(value=_count_value_st)
    @h_settings(
        max_examples=200,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_shotCount_always_valid(self, value):
        """Stored shotCount is always an int in [0, 12]."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            try:
                result = _run(mgr.save({"shotCount": value}))
            except Exception as exc:
                pytest.fail(
                    f"save() raised unexpectedly for shotCount={value!r}: {exc}"
                )

            stored = result["shotCount"]
            assert isinstance(stored, int), (
                f"shotCount should be int, got {type(stored).__name__!r} "
                f"for input {value!r}"
            )
            assert 0 <= stored <= 12, (
                f"shotCount {stored} is out of [0, 12] for input {value!r}"
            )

    @given(value=_count_value_st)
    @h_settings(
        max_examples=200,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_shotCount_non_numeric_retains_default(self, value):
        """When value is non-finite/non-numeric, stored value equals prior/default."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            clamped = _clamp_int(value, 0, 12)
            result = _run(mgr.save({"shotCount": value}))
            stored = result["shotCount"]

            if clamped is None:
                assert stored == DEFAULTS["shotCount"], (
                    f"Expected default {DEFAULTS['shotCount']} but got {stored} "
                    f"for non-numeric shotCount={value!r}"
                )
            else:
                assert stored == clamped, (
                    f"Expected clamped {clamped} but got {stored} "
                    f"for shotCount={value!r}"
                )

    @given(value=st.integers(min_value=0, max_value=12))
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_shotCount_in_range_preserved_exactly(self, value):
        """Integer values already in [0, 12] are preserved exactly."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            result = _run(mgr.save({"shotCount": value}))
            assert result["shotCount"] == value

    @given(value=st.integers(min_value=0, max_value=4))
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_imageCount_in_range_preserved_exactly(self, value):
        """Integer values already in [0, 4] are preserved exactly."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            result = _run(mgr.save({"imageCount": value}))
            assert result["imageCount"] == value

    @given(value=st.integers(min_value=5, max_value=1000))
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_imageCount_above_max_clamped_to_4(self, value):
        """imageCount values above 4 are clamped to 4."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            result = _run(mgr.save({"imageCount": value}))
            assert result["imageCount"] == 4

    @given(value=st.integers(min_value=13, max_value=1000))
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_shotCount_above_max_clamped_to_12(self, value):
        """shotCount values above 12 are clamped to 12."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            result = _run(mgr.save({"shotCount": value}))
            assert result["shotCount"] == 12

    @given(value=st.integers(min_value=-1000, max_value=-1))
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_negative_counts_clamped_to_zero(self, value):
        """Negative values for imageCount / shotCount are clamped to 0."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            r1 = _run(mgr.save({"imageCount": value}))
            assert r1["imageCount"] == 0

        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr2 = _make_manager(tmp_dir)
            r2 = _run(mgr2.save({"shotCount": value}))
            assert r2["shotCount"] == 0


# ---------------------------------------------------------------------------
# Property 8: Settings API Key Masking
# ---------------------------------------------------------------------------

class TestProperty8ApiKeyMasking:
    """
    **Validates: Requirements 3.8**

    For any non-empty apiKey string, get_public() never contains the raw key;
    always contains hasKey: True; keyHint is the last 4 chars (or "" when
    len < 4).
    When apiKey is "", hasKey is False and keyHint is "".
    """

    @given(api_key=_api_key_st)
    @h_settings(
        max_examples=300,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_raw_api_key_never_returned(self, api_key):
        """get_public() must never expose the raw apiKey value."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            _run(mgr.save({"image": {"apiKey": api_key}}))
            public = _run(mgr.get_public())
            image = public.get("image", {})
            assert "apiKey" not in image, (
                f"Raw apiKey found in get_public() response for key {api_key!r}"
            )

    @given(api_key=_api_key_st)
    @h_settings(
        max_examples=300,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_has_key_true_for_non_empty_key(self, api_key):
        """hasKey must be True when apiKey is non-empty."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            _run(mgr.save({"image": {"apiKey": api_key}}))
            public = _run(mgr.get_public())
            assert public["image"]["hasKey"] is True, (
                f"hasKey should be True for non-empty apiKey={api_key!r}"
            )

    @given(api_key=_api_key_st)
    @h_settings(
        max_examples=300,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_key_hint_at_most_4_chars(self, api_key):
        """keyHint must be at most 4 characters long."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            _run(mgr.save({"image": {"apiKey": api_key}}))
            public = _run(mgr.get_public())
            hint = public["image"]["keyHint"]
            assert isinstance(hint, str), f"keyHint should be str, got {type(hint)}"
            assert len(hint) <= 4, f"keyHint {hint!r} is longer than 4 chars"

    @given(api_key=_api_key_st)
    @h_settings(
        max_examples=300,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_key_hint_equals_last_4_chars_when_long_enough(self, api_key):
        """When len(apiKey) >= 4, keyHint equals the last 4 chars."""
        assume(len(api_key) >= 4)
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            _run(mgr.save({"image": {"apiKey": api_key}}))
            public = _run(mgr.get_public())
            expected_hint = api_key[-4:]
            assert public["image"]["keyHint"] == expected_hint, (
                f"Expected keyHint={expected_hint!r}, "
                f"got {public['image']['keyHint']!r}"
            )

    @given(api_key=_short_api_key_st)
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_key_hint_empty_when_key_too_short(self, api_key):
        """When len(apiKey) < 4, keyHint is empty string."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            _run(mgr.save({"image": {"apiKey": api_key}}))
            public = _run(mgr.get_public())
            assert public["image"]["keyHint"] == "", (
                f"Expected empty keyHint for short key {api_key!r}, "
                f"got {public['image']['keyHint']!r}"
            )

    def test_empty_api_key_has_key_false(self, tmp_path):
        """When apiKey is empty string, hasKey must be False and keyHint must be ''."""
        mgr = _make_manager(str(tmp_path))
        _run(mgr.save({"image": {"apiKey": ""}}))
        public = _run(mgr.get_public())
        assert public["image"]["hasKey"] is False, "hasKey should be False for empty apiKey"
        assert public["image"]["keyHint"] == "", "keyHint should be '' for empty apiKey"
        assert "apiKey" not in public["image"], "apiKey must not be present in public response"

    @given(api_key=_api_key_st)
    @h_settings(
        max_examples=100,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_image_ready_true_in_http_mode_with_all_fields(self, api_key):
        """imageReady is True in http mode when baseUrl, model, and apiKey are all set."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            mgr = _make_manager(tmp_dir)
            _run(mgr.save({
                "image": {
                    "source": "http",
                    "baseUrl": "https://api.example.com",
                    "model": "dall-e-3",
                    "apiKey": api_key,
                }
            }))
            public = _run(mgr.get_public())
            assert public["imageReady"] is True

    def test_image_ready_false_when_api_key_missing(self, tmp_path):
        """imageReady is False in http mode when apiKey is empty."""
        mgr = _make_manager(str(tmp_path))
        _run(mgr.save({
            "image": {
                "source": "http",
                "baseUrl": "https://api.example.com",
                "model": "dall-e-3",
                "apiKey": "",
            }
        }))
        public = _run(mgr.get_public())
        assert public["imageReady"] is False
