"""
Property-based tests for dashboard/ops.py — ops pipeline correctness

Property 4: Op Isolation on Failure
  For any op list where one op fails validation, state changes from other (valid) ops
  are applied; the failing op's target keys remain at pre-call values.

Property 5: Op Confluence on Disjoint Keys
  For any two ops A, B with non-overlapping state keys, applying [A, B] produces
  identical receipts and state as [B, A].

Property 6: Text Field Truncation
  For any op payload with arbitrarily long text fields, stored values never exceed
  byte limits and are always valid UTF-8.

Property 9: Content Vocabulary Validation
  For any op setting item.status / kind / platform to an out-of-vocabulary value,
  the op is rejected with an error entry and no state change occurs.

Property 11: Sample Record Preservation
  For any state with mixed sample: True and sample: False records, clear_samples
  removes all and only sample: True records.

Validates: Requirements 4.4, 4.5, 4.6, 5.3, 5.9, 5.12, 11.3
"""

from __future__ import annotations

import asyncio
import copy
import sys
from pathlib import Path

import pytest
from hypothesis import assume, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.ops import (  # noqa: E402
    KINDS,
    MAX_ARTICLE_BYTES,
    MAX_BODY_BYTES,
    MAX_PROMPT_BYTES,
    MAX_TITLE_BYTES,
    PLATFORMS,
    STATUSES,
    apply_ops,
    truncate_utf8,
)
from dashboard.seed import seed_state  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Property 4: Op Isolation on Failure
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 4: Op Isolation on Failure
@h_settings(max_examples=100, deadline=None)
@given(
    valid_title_1=st.text(min_size=1, max_size=30).filter(lambda s: bool(s.strip())),
    valid_title_2=st.text(min_size=1, max_size=30).filter(lambda s: bool(s.strip())),
    invalid_status=st.text(min_size=1, max_size=20).filter(lambda s: s not in STATUSES),
)
def test_op_isolation_on_failure(valid_title_1, valid_title_2, invalid_status):
    """When an intermediate op fails validation, earlier and later valid ops still apply."""
    state = {"items": [], "people": []}

    op1 = {"op": "add_item", "title": valid_title_1, "body": "First body"}
    # op2 is invalid because status is not in vocabulary
    op2 = {"op": "add_item", "title": "Bad item", "status": invalid_status}
    op3 = {"op": "add_item", "title": valid_title_2, "body": "Third body"}

    new_state, receipts, errors = _run(apply_ops(state, [op1, op2, op3]))

    # Valid ops applied
    titles = [it["title"] for it in new_state["items"]]
    assert valid_title_1 in titles
    assert valid_title_2 in titles
    assert "Bad item" not in titles
    assert len(new_state["items"]) == 2

    # Failing op isolated and error recorded
    assert len(errors) == 1
    assert "status" in errors[0].lower()


# ---------------------------------------------------------------------------
# Property 5: Op Confluence on Disjoint Keys
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 5: Op Confluence on Disjoint Keys
@h_settings(max_examples=100, deadline=None)
@given(
    person_name=st.text(min_size=1, max_size=20).filter(lambda s: bool(s.strip())),
    angle_text=st.text(min_size=1, max_size=40).filter(lambda s: bool(s.strip())),
)
def test_op_confluence_on_disjoint_keys(person_name, angle_text):
    """Applying disjoint ops [A, B] produces identical state and receipts as [B, A]."""
    initial_state = {"people": [], "angles": []}

    op_a = {"op": "add_person", "id": "p_fixed_1", "name": person_name, "bio": "Bio"}
    op_b = {"op": "add_angle", "id": "a_fixed_1", "text": angle_text}

    state_ab, receipts_ab, errors_ab = _run(apply_ops(initial_state, [op_a, op_b]))
    state_ba, receipts_ba, errors_ba = _run(apply_ops(initial_state, [op_b, op_a]))

    assert errors_ab == []
    assert errors_ba == []
    assert state_ab == state_ba

    receipts_ab_sorted = sorted(receipts_ab, key=lambda r: r.get("kind", ""))
    receipts_ba_sorted = sorted(receipts_ba, key=lambda r: r.get("kind", ""))
    assert receipts_ab_sorted == receipts_ba_sorted


# ---------------------------------------------------------------------------
# Property 6: Text Field Truncation
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 6: Text Field Truncation
@h_settings(max_examples=100, deadline=None)
@given(
    long_text=st.text(min_size=0, max_size=50_000),
    max_bytes=st.sampled_from([MAX_TITLE_BYTES, MAX_BODY_BYTES, MAX_ARTICLE_BYTES, MAX_PROMPT_BYTES]),
)
def test_text_field_truncation(long_text, max_bytes):
    """Truncated text never exceeds max_bytes and is always valid UTF-8."""
    result = truncate_utf8(long_text, max_bytes)
    assert result is not None
    encoded = result.encode("utf-8")
    assert len(encoded) <= max_bytes
    # Valid UTF-8 check
    assert encoded.decode("utf-8") == result


# ---------------------------------------------------------------------------
# Property 9: Content Vocabulary Validation
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 9: Content Vocabulary Validation
@h_settings(max_examples=100, deadline=None)
@given(
    bad_val=st.text(min_size=1, max_size=30),
    field_to_test=st.sampled_from(["status", "kind", "platform"]),
)
def test_content_vocabulary_validation(bad_val, field_to_test):
    """Setting status, kind, or platform to out-of-vocabulary value is rejected."""
    if field_to_test == "status":
        assume(bad_val not in STATUSES)
    elif field_to_test == "kind":
        assume(bad_val not in KINDS)
    elif field_to_test == "platform":
        assume(bad_val not in PLATFORMS)

    initial_state = {"items": []}
    op = {
        "op": "add_item",
        "title": "Test Title",
        "body": "Test Body",
        field_to_test: bad_val,
    }

    new_state, receipts, errors = _run(apply_ops(initial_state, [op]))

    # Must be rejected with error
    assert len(errors) == 1
    assert field_to_test in errors[0].lower()
    # State must be unchanged
    assert new_state["items"] == []
    assert receipts == []


# ---------------------------------------------------------------------------
# Property 11: Sample Record Preservation
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 11: Sample Record Preservation
@h_settings(max_examples=100, deadline=None)
@given(
    sample_flags=st.lists(st.booleans(), min_size=1, max_size=20),
)
def test_sample_record_preservation(sample_flags):
    """clear_samples removes all and only sample: True records across all collections."""
    state = {
        "items": [{"id": f"item_{i}", "sample": flag, "title": f"T{i}", "body": f"B{i}"} for i, flag in enumerate(sample_flags)],
        "people": [{"id": f"p_{i}", "sample": flag, "name": f"P{i}"} for i, flag in enumerate(sample_flags)],
        "angles": [{"id": f"a_{i}", "sample": flag, "text": f"A{i}"} for i, flag in enumerate(sample_flags)],
        "styles": [{"id": f"s_{i}", "sample": flag, "name": f"S{i}"} for i, flag in enumerate(sample_flags)],
        "skills": [{"id": f"sk_{i}", "sample": flag, "text": f"SK{i}"} for i, flag in enumerate(sample_flags)],
        "metrics": [{"id": f"m_{i}", "sample": flag, "views": i} for i, flag in enumerate(sample_flags)],
        "accounts": [{"id": f"acc_{i}", "sample": flag, "nickname": f"ACC{i}"} for i, flag in enumerate(sample_flags)],
        "sampleCleared": False,
    }

    expected_non_sample_ids = {
        col: [x["id"] for x in state[col] if not x["sample"]]
        for col in ("items", "people", "angles", "styles", "skills", "metrics", "accounts")
    }

    new_state, receipts, errors = _run(apply_ops(state, [{"op": "clear_samples"}]))

    assert errors == []
    assert new_state["sampleCleared"] is True

    for col, expected_ids in expected_non_sample_ids.items():
        actual_ids = [x["id"] for x in new_state[col]]
        assert actual_ids == expected_ids
        for item in new_state[col]:
            assert item.get("sample") is not True
