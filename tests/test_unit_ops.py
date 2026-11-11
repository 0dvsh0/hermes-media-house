"""
Unit tests for dashboard/ops.py — all 25 op handlers, status transitions, and error handling.

Requirements: 4.1–4.10, 5.1–5.12, 11.2, 11.3, 11.4
"""

from __future__ import annotations

import asyncio
import copy
from datetime import datetime, timezone
import sys
from pathlib import Path

import pytest

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.ops import (  # noqa: E402
    OP_HANDLERS,
    apply_ops,
)
from dashboard.undo import UndoStack  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture
def empty_state():
    return {
        "items": [],
        "people": [],
        "angles": [],
        "styles": [],
        "skills": [],
        "metrics": [],
        "accounts": [],
        "chat": [],
        "activeStyleId": None,
        "sampleCleared": False,
    }


def test_all_25_ops_registered():
    expected_ops = {
        "add_item", "update_item", "delete_item", "schedule_item", "set_status",
        "save_draft", "update_production", "add_person", "update_person", "delete_person",
        "add_angle", "update_angle", "delete_angle", "add_style", "update_style",
        "delete_style", "set_style", "add_skill", "update_skill", "delete_skill",
        "add_metric", "add_account", "update_account", "delete_account", "clear_samples",
    }
    assert set(OP_HANDLERS.keys()) == expected_ops
    assert len(OP_HANDLERS) == 25


def test_add_item_empty_payload_rejected(empty_state):
    op = {"op": "add_item", "title": "", "body": "   ", "media": None}
    state, receipts, errors = _run(apply_ops(empty_state, [op]))
    assert len(errors) == 1
    assert "at least one" in errors[0]
    assert state["items"] == []


def test_add_item_auto_assign_pos(empty_state):
    op1 = {"op": "add_item", "title": "First", "body": "Body 1"}
    op2 = {"op": "add_item", "title": "Second", "body": "Body 2"}
    state, receipts, errors = _run(apply_ops(empty_state, [op1, op2]))

    assert errors == []
    assert len(state["items"]) == 2
    assert state["items"][0]["pos"] == 0
    assert state["items"][1]["pos"] == 1


def test_status_transitions_published(empty_state):
    # Transitioning to published sets publishedAt
    op_add = {"op": "add_item", "id": "it1", "title": "Article", "status": "draft"}
    state, _, _ = _run(apply_ops(empty_state, [op_add]))
    assert state["items"][0].get("publishedAt") is None

    # Set status published
    op_pub = {"op": "set_status", "id": "it1", "status": "published"}
    state, _, _ = _run(apply_ops(state, [op_pub]))
    pub_at = state["items"][0].get("publishedAt")
    assert pub_at is not None

    # Transitioning away from published deletes publishedAt
    op_unpub = {"op": "set_status", "id": "it1", "status": "draft"}
    state, _, _ = _run(apply_ops(state, [op_unpub]))
    assert "publishedAt" not in state["items"][0]


def test_status_transitions_scheduled(empty_state):
    # When scheduledAt is set on idea -> outline
    op1 = {"op": "add_item", "id": "it1", "title": "Idea item", "status": "idea"}
    state, _, _ = _run(apply_ops(empty_state, [op1]))

    op_sched = {"op": "schedule_item", "id": "it1", "scheduledAt": "2026-11-20T10:00:00Z"}
    state, _, _ = _run(apply_ops(state, [op_sched]))
    assert state["items"][0]["status"] == "outline"

    # When scheduledAt is set on draft -> ready
    op2 = {"op": "add_item", "id": "it2", "title": "Draft item", "status": "draft"}
    state, _, _ = _run(apply_ops(state, [op2]))

    op_sched2 = {"op": "schedule_item", "id": "it2", "scheduledAt": "2026-11-20T10:00:00Z"}
    state, _, _ = _run(apply_ops(state, [op_sched2]))
    assert state["items"][1]["status"] == "ready"

    # When scheduledAt is cleared from ready -> draft
    op_unsched = {"op": "schedule_item", "id": "it2", "scheduledAt": None}
    state, _, _ = _run(apply_ops(state, [op_unsched]))
    assert state["items"][1]["status"] == "draft"

    # When scheduledAt is cleared from outline -> idea
    op_unsched1 = {"op": "schedule_item", "id": "it1", "scheduledAt": None}
    state, _, _ = _run(apply_ops(state, [op_unsched1]))
    assert state["items"][0]["status"] == "idea"


def test_delete_item_cascades_metrics_and_children(empty_state):
    state = copy.deepcopy(empty_state)
    state["items"] = [
        {"id": "parent1", "title": "Parent", "parentId": None},
        {"id": "child1", "title": "Child 1", "parentId": "parent1"},
        {"id": "child2", "title": "Child 2", "parentId": "other_parent"},
    ]
    state["metrics"] = [
        {"id": "m1", "itemId": "parent1", "views": 100},
        {"id": "m2", "itemId": "child1", "views": 50},
    ]

    op = {"op": "delete_item", "id": "parent1"}
    new_state, receipts, errors = _run(apply_ops(state, [op]))

    assert errors == []
    # Parent removed
    item_ids = [it["id"] for it in new_state["items"]]
    assert item_ids == ["child1", "child2"]
    # Child 1 parentId nullified
    assert new_state["items"][0]["parentId"] is None
    # Child 2 parentId unchanged
    assert new_state["items"][1]["parentId"] == "other_parent"
    # Metric for parent removed
    metric_ids = [m["id"] for m in new_state["metrics"]]
    assert metric_ids == ["m2"]


def test_sample_flag_preserved_on_updates(empty_state):
    state = copy.deepcopy(empty_state)
    state["items"] = [{"id": "it_sample", "title": "Old", "body": "Old", "sample": True}]
    state["people"] = [{"id": "p_sample", "name": "Old", "bio": "Old", "sample": True}]
    state["styles"] = [{"id": "s_sample", "name": "Old", "sample": True, "preset": True}]

    ops = [
        {"op": "update_item", "id": "it_sample", "title": "New Title"},
        {"op": "update_person", "id": "p_sample", "name": "New Name"},
        {"op": "update_style", "id": "s_sample", "name": "New Style"},
    ]
    new_state, _, errors = _run(apply_ops(state, ops))
    assert errors == []
    assert new_state["items"][0]["sample"] is True
    assert new_state["people"][0]["sample"] is True
    assert new_state["styles"][0]["sample"] is True
    assert new_state["styles"][0]["preset"] is True


def test_whitelist_strips_disallowed_fields(empty_state):
    op = {
        "op": "add_item",
        "title": "Clean Item",
        "body": "Body",
        "secretAdminField": "hacked",
        "maliciousPayload": {"dangerous": True},
    }
    new_state, _, errors = _run(apply_ops(empty_state, [op]))
    assert errors == []
    created = new_state["items"][0]
    assert "secretAdminField" not in created
    assert "maliciousPayload" not in created


def test_undo_stack_integration(empty_state):
    undo_stack = UndoStack()
    op = {"op": "add_item", "id": "it_undo", "title": "Undo Me", "body": "Body"}

    new_state, receipts, errors = _run(apply_ops(empty_state, [op], undo_stack=undo_stack, undoable=True))
    assert errors == []
    assert len(undo_stack._entries) == 1

    label, reverted, can_undo = undo_stack.pop(new_state)
    assert label == "add_item"
    assert reverted["items"] == []
    assert can_undo is False
