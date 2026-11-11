"""
Property-based and unit tests for dashboard/undo.py — three-way merge undo

Property 1: Undo Identity
  revert_change(x, x, c) == c for all JSON-like x and c.

Property 2: Undo Round-Trip
  revert_change(b, a, a) deep-equals b for all JSON-like b, a.

Property 3: Undo Stack Bound
  after any sequence of push calls of arbitrary length, len(stack._entries) <= 30.

Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10
"""

from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.undo import (  # noqa: E402
    MAX_UNDO,
    UndoStack,
    _is_keyed,
    _revert_keyed_array,
    revert_change,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

json_primitive = st.one_of(
    st.none(),
    st.booleans(),
    st.integers(min_value=-1_000_000, max_value=1_000_000),
    st.floats(allow_nan=False, allow_infinity=False),
    st.text(max_size=30),
)

json_strategy = st.recursive(
    json_primitive,
    lambda children: st.one_of(
        st.lists(children, max_size=5),
        st.dictionaries(st.text(max_size=10), children, max_size=5),
    ),
    max_leaves=25,
)

keyed_item_strategy = st.fixed_dictionaries(
    {"id": st.text(alphabet="abcdef0123456789", min_size=1, max_size=8)},
    optional={
        "title": st.text(max_size=20),
        "status": st.sampled_from(["idea", "outline", "draft", "ready", "published"]),
        "val": st.integers(min_value=0, max_value=100),
    },
)

keyed_array_strategy = st.lists(keyed_item_strategy, max_size=8, unique_by=lambda x: x["id"])


# ---------------------------------------------------------------------------
# Property 1: Undo Identity
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 1: Undo Identity
@h_settings(max_examples=150)
@given(x=json_strategy, c=json_strategy)
def test_undo_identity(x, c):
    """revert_change(x, x, c) == c for any JSON-like x and c."""
    result = revert_change(x, x, c)
    assert result == c


# ---------------------------------------------------------------------------
# Property 2: Undo Round-Trip
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 2: Undo Round-Trip
@h_settings(max_examples=150)
@given(b=json_strategy, a=json_strategy)
def test_undo_round_trip(b, a):
    """revert_change(b, a, a) deep-equals b for any JSON-like b, a."""
    result = revert_change(b, a, a)
    assert result == b


# ---------------------------------------------------------------------------
# Property 3: Undo Stack Bound
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 3: Undo Stack Bound
@h_settings(max_examples=100)
@given(
    pushes=st.lists(
        st.tuples(
            st.text(max_size=20),
            st.dictionaries(st.text(max_size=5), st.integers(), max_size=3),
            st.dictionaries(st.text(max_size=5), st.integers(), max_size=3),
        ),
        min_size=0,
        max_size=75,
    )
)
def test_undo_stack_bound(pushes):
    """After any sequence of push calls of arbitrary length, len <= 30."""
    stack = UndoStack()
    for label, before, after in pushes:
        stack.push(label, before, after)
        assert len(stack._entries) <= MAX_UNDO
    assert len(stack._entries) <= 30


# ---------------------------------------------------------------------------
# Unit tests: concrete edge cases and three-way merge semantics
# ---------------------------------------------------------------------------

def test_undo_stack_empty_pop():
    stack = UndoStack()
    current = {"items": [1, 2, 3]}
    label, merged, can_undo = stack.pop(current)
    assert label is None
    assert merged == current
    assert can_undo is False


def test_undo_stack_push_pop_lifecycle():
    stack = UndoStack()
    s0 = {"counter": 0}
    s1 = {"counter": 1}
    s2 = {"counter": 2}

    # No-op push should not add entry
    stack.push("noop", s0, s0)
    assert len(stack._entries) == 0

    stack.push("step 1", s0, s1)
    assert len(stack._entries) == 1

    stack.push("step 2", s1, s2)
    assert len(stack._entries) == 2

    label, merged, can_undo = stack.pop(s2)
    assert label == "step 2"
    assert merged == s1
    assert can_undo is True

    label, merged, can_undo = stack.pop(merged)
    assert label == "step 1"
    assert merged == s0
    assert can_undo is False


def test_undo_stack_drops_oldest_on_cap():
    stack = UndoStack()
    for i in range(35):
        stack.push(f"step_{i}", {"val": i}, {"val": i + 1})
    assert len(stack._entries) == 30
    # The oldest 5 (step_0 to step_4) should have been dropped
    assert stack._entries[0]["label"] == "step_5"
    assert stack._entries[-1]["label"] == "step_34"


def test_revert_dict_three_way_merge():
    # User updated title in step 1, then updated status in step 2.
    # Reverting step 1 should revert title while keeping status.
    before = {"title": "Old Title", "status": "draft"}
    after = {"title": "New Title", "status": "draft"}
    current = {"title": "New Title", "status": "published"}  # concurrent edit

    merged = revert_change(before, after, current)
    assert merged == {"title": "Old Title", "status": "published"}


def test_revert_keyed_array_deletion():
    # Step deleted item "b"
    before = [{"id": "a", "x": 1}, {"id": "b", "x": 2}, {"id": "c", "x": 3}]
    after = [{"id": "a", "x": 1}, {"id": "c", "x": 3}]
    # Current has item "d" added concurrently
    current = [{"id": "a", "x": 1}, {"id": "c", "x": 3}, {"id": "d", "x": 4}]

    merged = revert_change(before, after, current)
    # "b" re-inserted at index 1
    ids = [x["id"] for x in merged]
    assert ids == ["a", "b", "c", "d"]
    assert merged[1] == {"id": "b", "x": 2}


def test_revert_keyed_array_addition():
    # Step added item "x"
    before = [{"id": "a", "v": 1}]
    after = [{"id": "a", "v": 1}, {"id": "x", "v": 99}]
    # Current also modified "a"
    current = [{"id": "a", "v": 2}, {"id": "x", "v": 99}]

    merged = revert_change(before, after, current)
    # "x" removed, "a" kept with current value 2
    assert merged == [{"id": "a", "v": 2}]


def test_revert_keyed_array_modification():
    # Step updated item "a" title
    before = [{"id": "a", "title": "Old"}]
    after = [{"id": "a", "title": "New"}]
    current = [{"id": "a", "title": "New", "other": "keep_me"}]

    merged = revert_change(before, after, current)
    assert merged == [{"id": "a", "title": "Old", "other": "keep_me"}]


def test_revert_non_keyed_array_different_lengths():
    # Lengths differ between after and current -> preserve current
    before = [1, 2]
    after = [1, 2, 3]
    current = [1, 2, 3, 4]

    merged = revert_change(before, after, current)
    assert merged == [1, 2, 3, 4]
