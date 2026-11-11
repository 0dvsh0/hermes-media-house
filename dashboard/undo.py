"""Three-way merge undo stack for hermes-media-desk.

Provides ``revert_change`` for recursive three-way merging and ``UndoStack``
for managing a capped history of reversible state mutations.
"""

from __future__ import annotations

import copy
from typing import Any

MAX_UNDO = 30


# ---------------------------------------------------------------------------
# Public merge helpers
# ---------------------------------------------------------------------------


def revert_change(before: Any, after: Any, current: Any) -> Any:
    """Recursively revert a single change using three-way merge logic.

    Rules applied in order:
    1. **Identity short-circuit** — when ``before == after`` the step was a
       no-op; return ``current`` unchanged.
    2. **Round-trip** — when ``current == after`` (the user has not diverged
       from the recorded "after" snapshot), return a deep copy of ``before``.
    3. **Dict merge** — recurse into every key present in either ``before`` or
       ``after``; leave keys untouched that exist only in ``current``.
    4. **Keyed-array merge** — when all three values are lists whose elements
       each carry a string ``id``, delegate to ``_revert_keyed_array``.
    5. **Non-keyed array element-wise** — when all three are lists of the same
       length, recurse element-by-element.
    6. **Fallback** — return ``current`` as-is for all other types.

    Args:
        before: Snapshot of the value *before* the recorded step.
        after:  Snapshot of the value *after* the recorded step.
        current: Present value that may have been further modified.

    Returns:
        The merged value with the recorded step reverted.
    """
    # Rule 1: identity short-circuit
    if before == after:
        return current

    # Rule 2: round-trip — current hasn't diverged from after
    if current == after:
        return copy.deepcopy(before)

    # Rule 3: recursive dict merge
    if isinstance(before, dict) and isinstance(after, dict) and isinstance(current, dict):
        result = dict(current)
        for key in set(before) | set(after):
            result[key] = revert_change(
                before.get(key),
                after.get(key),
                current.get(key),
            )
        return result

    # Rules 4 & 5: list handling
    if isinstance(before, list) and isinstance(after, list) and isinstance(current, list):
        # Rule 4: keyed-array merge
        if _is_keyed(before) and _is_keyed(after) and _is_keyed(current):
            return _revert_keyed_array(before, after, current)

        # Rule 5: non-keyed, same-length element-wise
        if len(before) == len(after) == len(current):
            return [revert_change(b, a, c) for b, a, c in zip(before, after, current)]

    # Rule 6: fallback — cannot merge structurally, preserve current
    return current


# ---------------------------------------------------------------------------
# Private keyed-array helpers
# ---------------------------------------------------------------------------


def _is_keyed(arr: list) -> bool:
    """Return True when every element is a dict with a string ``id`` field.

    An empty list is considered keyed (vacuously true), so keyed-array logic
    applies when at least one of ``before``/``after``/``current`` is non-empty
    and all three satisfy this predicate.

    Args:
        arr: The list to test.

    Returns:
        ``True`` if all elements carry a string ``id``; ``False`` otherwise.
    """
    return all(isinstance(x, dict) and isinstance(x.get("id"), str) for x in arr)


def _revert_keyed_array(before: list, after: list, current: list) -> list:
    """Revert a keyed-array mutation using id-based three-way merge.

    Three categories of ids are identified relative to the recorded step:

    * **Added** (in ``after`` but not ``before``) — these rows were *inserted*
      by the step being reverted; remove them from ``current``.
    * **Removed** (in ``before`` but not ``after``) — these rows were *deleted*
      by the step; re-insert them at their original index positions.
    * **Shared** (in both ``before`` and ``after``) — these rows may have been
      *modified* by the step; recurse via ``revert_change`` for each one.

    Args:
        before: Row list as it existed before the recorded step.
        after:  Row list as it existed after the recorded step.
        current: Present row list that may have been further modified.

    Returns:
        The row list with the recorded step reverted.
    """
    before_map: dict[str, dict] = {x["id"]: x for x in before}
    after_map: dict[str, dict] = {x["id"]: x for x in after}

    added_ids: set[str] = set(after_map) - set(before_map)   # inserted by step → remove
    removed_ids: set[str] = set(before_map) - set(after_map)  # deleted by step → re-insert

    # Pass 1: build result without added rows; merge shared rows in-place.
    result: list[dict] = []
    for item in current:
        iid = item["id"]
        if iid in added_ids:
            continue  # drop rows that were added by the step being reverted
        if iid in before_map and iid in after_map:
            result.append(revert_change(before_map[iid], after_map[iid], item))
        else:
            result.append(item)

    # Pass 2: re-insert deleted rows at their original index positions.
    for i, item in enumerate(before):
        if item["id"] in removed_ids:
            pos = min(i, len(result))
            result.insert(pos, copy.deepcopy(item))

    return result


# ---------------------------------------------------------------------------
# UndoStack
# ---------------------------------------------------------------------------


class UndoStack:
    """Capped LIFO stack of reversible state mutations.

    Each entry records the ``label``, ``before`` snapshot, and ``after``
    snapshot for a single logical operation.  ``pop`` uses three-way merge
    via ``revert_change`` so that concurrent edits made *after* a push are
    preserved as much as possible.

    The stack is capped at ``MAX_UNDO`` (30) entries; the oldest entry is
    silently discarded when the cap is reached.
    """

    _entries: list  # list of {label: str, before: dict, after: dict}

    def __init__(self) -> None:
        self._entries = []

    def push(self, label: str, before: dict, after: dict) -> None:
        """Record a new undoable step.

        Args:
            label:  Human-readable description of the operation (used as the
                    undo menu label shown to the user).
            before: Deep snapshot of the state *before* the operation.
            after:  Deep snapshot of the state *after* the operation.

        Notes:
            * No-op when ``before == after`` (nothing actually changed).
            * When the stack is already at ``MAX_UNDO`` entries the oldest
              entry is dropped before the new one is appended.
        """
        if before == after:
            return  # no-op: nothing changed
        if len(self._entries) >= MAX_UNDO:
            self._entries.pop(0)  # discard oldest to stay within cap
        self._entries.append({"label": label, "before": before, "after": after})

    def pop(self, current: dict) -> tuple[str | None, dict, bool]:
        """Revert the most recent undoable step and return the merged state.

        Uses ``revert_change(entry.before, entry.after, current)`` so that
        edits made after the push point are preserved via three-way merge.

        Args:
            current: The present application state (may have diverged from
                     ``entry.after`` due to subsequent mutations).

        Returns:
            A three-tuple ``(label, merged_state, canUndo)`` where:

            * ``label`` — the string label stored with the entry, or ``None``
              when the stack was empty.
            * ``merged_state`` — the state after reverting; equals ``current``
              unchanged when the stack was empty.
            * ``canUndo`` — ``True`` when further undo entries remain after
              this pop; ``False`` when the stack is now empty.
        """
        if not self._entries:
            return None, current, False
        entry = self._entries.pop()
        merged = revert_change(entry["before"], entry["after"], current)
        return entry["label"], merged, bool(self._entries)
