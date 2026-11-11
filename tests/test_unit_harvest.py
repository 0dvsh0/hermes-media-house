"""
Property-based and unit tests for dashboard/harvest.py — SSRF check and URL capture

Property 10: SSRF Safety
  For any URL whose resolved IP falls in RFC 1918 / loopback / link-local ranges,
  ssrf_check raises HTTPException(400) and makes no outbound connection.

Validates: Requirements 9.3, 12.4, 12.5, 19.5, 19.6
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from hypothesis import given
from hypothesis import settings as h_settings
from hypothesis import strategies as st

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PLUGIN_ROOT))

from dashboard.harvest import (  # noqa: E402
    BLOCKED_NETWORKS,
    capture_url,
    ssrf_check,
    validate_target_host,
)


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Strategies for Private / Forbidden IPs
# ---------------------------------------------------------------------------

private_ipv4_strategy = st.one_of(
    # 10.0.0.0/8
    st.integers(min_value=0, max_value=255).flatmap(
        lambda b: st.integers(min_value=0, max_value=255).flatmap(
            lambda c: st.integers(min_value=0, max_value=255).map(
                lambda d: f"10.{b}.{c}.{d}"
            )
        )
    ),
    # 172.16.0.0/12
    st.integers(min_value=16, max_value=31).flatmap(
        lambda b: st.integers(min_value=0, max_value=255).flatmap(
            lambda c: st.integers(min_value=0, max_value=255).map(
                lambda d: f"172.{b}.{c}.{d}"
            )
        )
    ),
    # 192.168.0.0/16
    st.integers(min_value=0, max_value=255).flatmap(
        lambda c: st.integers(min_value=0, max_value=255).map(
            lambda d: f"192.168.{c}.{d}"
        )
    ),
    # 127.0.0.0/8
    st.integers(min_value=0, max_value=255).flatmap(
        lambda b: st.integers(min_value=0, max_value=255).flatmap(
            lambda c: st.integers(min_value=0, max_value=255).map(
                lambda d: f"127.{b}.{c}.{d}"
            )
        )
    ),
    # 169.254.0.0/16
    st.integers(min_value=0, max_value=255).flatmap(
        lambda c: st.integers(min_value=0, max_value=255).map(
            lambda d: f"169.254.{c}.{d}"
        )
    ),
    # IPv6 loopback and private
    st.sampled_from(["::1", "fe80::1", "fc00::1", "fd12:3456:789a::1"]),
)


# ---------------------------------------------------------------------------
# Property 10: SSRF Safety
# ---------------------------------------------------------------------------

# Feature: hermes-media-desk, Property 10: SSRF Safety
@h_settings(max_examples=120, deadline=None)
@given(ip_str=private_ipv4_strategy, path=st.text(alphabet="abcdef1234567890/", max_size=15))
def test_ssrf_safety_direct_ip(ip_str, path):
    """Direct IP URLs in RFC1918/loopback/link-local raise HTTPException(400) without network call."""
    clean_path = path.lstrip("/")
    host_part = f"[{ip_str}]" if ":" in ip_str else ip_str
    url = f"http://{host_part}/{clean_path}"

    with patch("httpx.AsyncClient.send") as mock_send:
        with pytest.raises(HTTPException) as exc_info:
            _run(ssrf_check(url))

        assert exc_info.value.status_code == 400
        mock_send.assert_not_called()


@h_settings(max_examples=100, deadline=None)
@given(
    domain=st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=3, max_size=12),
    resolved_ip=private_ipv4_strategy,
)
def test_ssrf_safety_resolved_dns(domain, resolved_ip):
    """Hostnames that resolve to private/loopback IPs raise HTTPException(400) with no HTTP call."""
    url = f"https://{domain}.example.com/test"

    fake_addrinfo = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (resolved_ip, 0))]

    with patch("socket.getaddrinfo", return_value=fake_addrinfo), patch("httpx.AsyncClient.send") as mock_send:
        with pytest.raises(HTTPException) as exc_info:
            _run(ssrf_check(url))

        assert exc_info.value.status_code == 400
        mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# Unit tests: Scheme, size, redirect, and capture_url parsing
# ---------------------------------------------------------------------------

def test_scheme_validation():
    for bad_url in [
        "ftp://example.com/file",
        "file:///etc/passwd",
        "gopher://example.com",
        "data:text/html,hello",
        "javascript:alert(1)",
    ]:
        with pytest.raises(HTTPException) as exc_info:
            _run(ssrf_check(bad_url))
        assert exc_info.value.status_code == 400


def test_max_redirects_exceeded():
    url = "https://public-site.org/start"

    # Mock public IP for DNS
    public_addrinfo = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]

    # Build a mock redirect response
    def make_redirect_response(location):
        resp = MagicMock()
        resp.is_redirect = True
        resp.headers = {"location": location}
        resp.status_code = 302
        resp.aclose = AsyncMock()
        return resp

    responses = [make_redirect_response(f"/hop{i}") for i in range(1, 10)]

    with patch("socket.getaddrinfo", return_value=public_addrinfo), \
         patch("httpx.AsyncClient.send", side_effect=responses):
        with pytest.raises(HTTPException) as exc_info:
            _run(ssrf_check(url, max_redirects=3))
        assert exc_info.value.status_code == 400
        assert "redirect" in exc_info.value.detail.lower()


def test_max_size_exceeded():
    url = "https://public-site.org/large"
    public_addrinfo = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]

    # Create mock response with 2 MB content
    mock_resp = MagicMock()
    mock_resp.is_redirect = False
    mock_resp.status_code = 200
    mock_resp.headers = {"content-length": "2097152"}
    mock_resp.aclose = AsyncMock()

    with patch("socket.getaddrinfo", return_value=public_addrinfo), \
         patch("httpx.AsyncClient.send", return_value=mock_resp):
        with pytest.raises(HTTPException) as exc_info:
            _run(ssrf_check(url, max_size=1024))
        assert exc_info.value.status_code == 400
        assert "exceeds" in exc_info.value.detail.lower()


def test_capture_url_html_metadata():
    html_content = b"""<!DOCTYPE html>
    <html>
    <head>
        <title>Hermes Workbench Article</title>
        <meta name="description" content="A comprehensive guide to media operations.">
        <meta property="og:image" content="/assets/cover.png">
        <meta property="og:site_name" content="Hermes Tech Blog">
    </head>
    <body>
        <h1>Content here</h1>
    </body>
    </html>
    """

    with patch("dashboard.harvest.ssrf_check", new_callable=AsyncMock) as mock_ssrf:
        mock_ssrf.return_value = html_content
        data = _run(capture_url("https://example.com/posts/1"))

        assert data["title"] == "Hermes Workbench Article"
        assert data["description"] == "A comprehensive guide to media operations."
        assert data["og_image"] == "https://example.com/assets/cover.png"
        assert data["site_name"] == "Hermes Tech Blog"


def test_capture_url_fallback_tags():
    html_content = b"""<!DOCTYPE html>
    <html>
    <head>
        <meta property="og:title" content="OG Title Only">
        <meta property="og:description" content="OG Description">
    </head>
    <body></body>
    </html>
    """

    with patch("dashboard.harvest.ssrf_check", new_callable=AsyncMock) as mock_ssrf:
        mock_ssrf.return_value = html_content
        data = _run(capture_url("https://example.com/sample"))

        assert data["title"] == "OG Title Only"
        assert data["description"] == "OG Description"
        assert data["og_image"] == ""
        assert data["site_name"] == ""
