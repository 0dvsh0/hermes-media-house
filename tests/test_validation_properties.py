"""Property tests for validation constraints: Properties 9, 10, 11, 12, 13.

- Property 9: Content Vocabulary Validation (Requirements 4.4, 4.5, 4.6)
- Property 10: SSRF Safety Range (Requirements 9.3)
- Property 11: Sample Record Preservation (Requirements 11.3)
- Property 12: Image Magic Byte Validation (Requirements 8.6)
- Property 13: Export Filename Safety (Requirements 14.1)
"""

from __future__ import annotations

import asyncio
import ipaddress
from hypothesis import assume, given, settings
import hypothesis.strategies as st
import pytest
from fastapi import HTTPException

from dashboard.export import FORBIDDEN_CHARS, sanitize_filename
from dashboard.harvest import _is_ip_blocked
from dashboard.images import _validate_image
from dashboard.ops import (
    KINDS,
    PLATFORMS,
    STATUSES,
    apply_ops,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _run_async(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Property 9: Content Vocabulary Validation
# ---------------------------------------------------------------------------

@settings(max_examples=100, deadline=None)
@given(
    bad_val=st.text(min_size=1, max_size=30),
    field_to_test=st.sampled_from(["status", "kind", "platform"]),
)
def test_property_9_vocabulary_validation(bad_val: str, field_to_test: str):
    """Property 9: Setting status, kind, or platform to out-of-vocabulary value is rejected."""
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

    new_state, receipts, errors = _run_async(apply_ops(initial_state, [op]))

    assert len(errors) == 1
    assert field_to_test in errors[0].lower()
    assert new_state["items"] == []
    assert receipts == []


# ---------------------------------------------------------------------------
# Property 10: SSRF Safety Range
# ---------------------------------------------------------------------------

private_ip_strategy = st.one_of(
    st.sampled_from(["10.0.0.1", "10.255.4.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "127.0.0.1", "127.1.2.3", "169.254.169.254", "0.0.0.0"]),
    st.sampled_from(["::1", "fe80::1", "fc00::1", "fd12:3456:789a::1"]),
)

@given(ip_str=private_ip_strategy)
@settings(max_examples=100, deadline=None)
def test_property_10_ssrf_safety(ip_str: str):
    """Property 10: For any IPv4 or IPv6 address in private/loopback/link-local ranges,
    _is_ip_blocked returns True.
    """
    ip = ipaddress.ip_address(ip_str)
    assert _is_ip_blocked(ip) is True


# ---------------------------------------------------------------------------
# Property 11: Sample Record Preservation
# ---------------------------------------------------------------------------

@settings(max_examples=100, deadline=None)
@given(
    sample_flags=st.lists(st.booleans(), min_size=1, max_size=20),
)
def test_property_11_sample_preservation(sample_flags: list[bool]):
    """Property 11: clear_samples removes all and only sample: True records."""
    state = {
        "items": [{"id": f"item_{i}", "sample": flag, "title": f"T{i}"} for i, flag in enumerate(sample_flags)],
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

    new_state, receipts, errors = _run_async(apply_ops(state, [{"op": "clear_samples"}]))

    assert errors == []
    assert new_state["sampleCleared"] is True

    for col, expected_ids in expected_non_sample_ids.items():
        actual_ids = [x["id"] for x in new_state[col]]
        assert actual_ids == expected_ids
        for item in new_state[col]:
            assert item.get("sample") is not True


# ---------------------------------------------------------------------------
# Property 12: Image Magic Byte Validation
# ---------------------------------------------------------------------------

@given(data=st.binary(min_size=0, max_size=1000))
@settings(max_examples=100, deadline=None)
def test_property_12_image_magic_bytes(data: bytes):
    """Property 12: Any byte sequence not starting with a recognized magic prefix
    raises HTTPException.
    """
    is_png = data.startswith(b"\x89PNG")
    is_jpg = data.startswith(b"\xff\xd8")
    is_gif = data.startswith(b"GIF8")
    is_webp = data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP"

    if not (is_png or is_jpg or is_gif or is_webp):
        with pytest.raises(ValueError):
            _validate_image(data)
    else:
        fmt = _validate_image(data)
        assert fmt in ("png", "jpg", "gif", "webp")


# ---------------------------------------------------------------------------
# Property 13: Export Filename Safety
# ---------------------------------------------------------------------------

@given(
    title=st.text(),
    fallback_id=st.text(min_size=1),
)
@settings(max_examples=100, deadline=None)
def test_property_13_export_filename_safety(title: str, fallback_id: str):
    """Property 13: For any title containing characters from \\ / : * ? " < > |,
    sanitized name contains none of those characters.
    """
    sanitized = sanitize_filename(title, fallback_id=fallback_id)
    for forbidden in FORBIDDEN_CHARS:
        assert forbidden not in sanitized
    assert len(sanitized) > 0
