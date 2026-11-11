"""
Unit and property-based tests for dashboard/images.py — ImageGenerator and format validation.

Property 12: Image Magic Byte Validation
  For any byte sequence not beginning with a recognized magic prefix (PNG/JPEG/WebP/GIF),
  _validate_image raises ValueError and does not write to the files directory.

Validates: Requirements 8.1–8.11, Requirement 8.6
"""

from __future__ import annotations

import asyncio
import base64
from pathlib import Path
import sys
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from hypothesis import assume, given
from hypothesis import settings as h_settings
from hypothesis import strategies as st
import pytest

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.images import (  # noqa: E402
    ImageGenerator,
    _validate_image,
)


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Property 12: Image Magic Byte Validation
# ---------------------------------------------------------------------------

def _is_valid_magic(data: bytes) -> bool:
    if data.startswith(b"\x89PNG"):
        return True
    if data.startswith(b"\xff\xd8"):
        return True
    if data.startswith(b"GIF8"):
        return True
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return True
    return False


# Feature: hermes-media-desk, Property 12: Image Magic Byte Validation
@h_settings(max_examples=120, deadline=None)
@given(raw_bytes=st.binary(min_size=0, max_size=2048))
def test_image_magic_byte_validation_property(tmp_path_factory, raw_bytes):
    """Any byte sequence not starting with valid magic bytes is rejected and never written."""
    tmp_dir = tmp_path_factory.mktemp("img_test")
    generator = ImageGenerator(files_dir=tmp_dir)

    if _is_valid_magic(raw_bytes):
        # Valid magic bytes must succeed and return valid extension
        ext = _validate_image(raw_bytes)
        assert ext in ("png", "jpg", "webp", "gif")
    else:
        # Invalid magic bytes must raise ValueError
        with pytest.raises(ValueError):
            _validate_image(raw_bytes)

        # And must not write to files/
        with pytest.raises(ValueError):
            generator.save_image(raw_bytes, target_dir=tmp_dir)

        # Directory must remain empty
        assert list(tmp_dir.iterdir()) == []


# ---------------------------------------------------------------------------
# Unit tests: Formats, URL candidate resolution, retries, tool provider
# ---------------------------------------------------------------------------

def test_valid_image_formats():
    png_sample = b"\x89PNG\r\n\x1a\n" + b"\x00" * 30
    jpg_sample = b"\xff\xd8\xff\xe0" + b"\x00" * 30
    webp_sample = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 20
    gif_sample = b"GIF89a" + b"\x00" * 20

    assert _validate_image(png_sample) == "png"
    assert _validate_image(jpg_sample) == "jpg"
    assert _validate_image(webp_sample) == "webp"
    assert _validate_image(gif_sample) == "gif"


def test_image_size_limit():
    huge_bytes = b"\x89PNG" + b"\x00" * (40_000_001)
    with pytest.raises(ValueError) as exc:
        _validate_image(huge_bytes)
    assert "exceeds" in str(exc.value).lower()


def test_relative_url_candidates():
    generator = ImageGenerator()
    base_url = "https://api.example.com/v1"
    rel_url = "outputs/sample.png"

    candidates = _run(generator._resolve_relative_url(rel_url, base_url))
    assert candidates == [
        "https://api.example.com/outputs/sample.png",        # prefix-stripped (/v1 removed)
        "https://api.example.com/v1/outputs/sample.png",     # mount-prefixed
        "https://api.example.com/outputs/sample.png",        # site-root
    ]


def test_generate_via_http_b64(tmp_path):
    generator = ImageGenerator(files_dir=tmp_path)
    png_data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    b64_str = base64.b64encode(png_data).decode("ascii")

    settings = {
        "image": {
            "source": "http",
            "baseUrl": "https://api.openai.com/v1",
            "model": "dall-e-3",
            "apiKey": "sk-secret123",
            "size": "1024x1024",
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"data": [{"b64_json": b64_str}]}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        result = _run(generator.generate("test prompt", settings))

        assert result == png_data
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs["json"]["model"] == "dall-e-3"
        assert call_kwargs["json"]["prompt"] == "test prompt"
        assert call_kwargs["headers"]["Authorization"] == "Bearer sk-secret123"


def test_generate_via_http_permanent_error_no_retry():
    generator = ImageGenerator()
    settings = {
        "image": {
            "source": "http",
            "baseUrl": "https://api.openai.com/v1",
            "model": "dall-e-3",
            "apiKey": "bad-key",
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        with pytest.raises(HTTPException) as exc:
            _run(generator.generate("prompt", settings))

        assert exc.value.status_code == 401
        # Permanent error must not be retried
        assert mock_post.call_count == 1


def test_generate_via_tool_provider_success():
    generator = ImageGenerator()
    png_data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20

    tool_mock = MagicMock()
    tool_mock.generate = AsyncMock(return_value=png_data)
    generator.register_tool_provider(tool_mock)

    settings = {"image": {"source": "tool"}}
    result = _run(generator.generate("test prompt", settings))

    assert result == png_data
    tool_mock.generate.assert_called_once_with(prompt="test prompt", settings=settings)


def test_generate_via_tool_missing_provider():
    generator = ImageGenerator()
    settings = {"image": {"source": "tool"}}

    with pytest.raises(RuntimeError) as exc:
        _run(generator.generate("test prompt", settings))
    assert "no image generation provider" in str(exc.value).lower()
