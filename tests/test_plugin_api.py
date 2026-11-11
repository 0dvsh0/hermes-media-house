"""Tests for dashboard/plugin_api.py — FastAPI route definitions, security, and responses.

Validates Requirements 1.4-1.6, 7.13, 9.1-9.12, 10.1-10.12, 11.4-11.6, 11.10, 20.1, 20.4, 21.1, 22.5
"""

from __future__ import annotations

import base64
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from dashboard.plugin_api import (
    ALLOWED_UPLOAD_TYPES,
    FILES_DIR,
    init_plugin,
    pipeline,
    router,
    settings_mgr,
    store,
    undo_stack,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def app_client(tmp_path: Path):
    app = FastAPI()
    app.include_router(router)
    init_plugin(None, data_dir=tmp_path)
    client = TestClient(app)
    return client, tmp_path


# ---------------------------------------------------------------------------
# 1. Security & Origin Tests (Requirement 9.3)
# ---------------------------------------------------------------------------

def test_origin_security_absent_header(app_client):
    client, _ = app_client
    # Absent Sec-Fetch-Site header on POST (standard for desktop IPC and local clients) is allowed
    resp = client.post("/ops", json={"ops": []})
    assert resp.status_code == 200


def test_origin_security_cross_site(app_client):
    client, _ = app_client
    resp = client.post("/ops", json={"ops": []}, headers={"sec-fetch-site": "cross-site"})
    assert resp.status_code == 403
    assert resp.json() == {"error": "Forbidden"}


def test_origin_security_allowed(app_client):
    client, _ = app_client
    for site in ("same-origin", "none", "SAME-ORIGIN"):
        resp = client.post("/ops", json={"ops": []}, headers={"sec-fetch-site": site})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 2. GET Routes (Requirements 9.1, 9.7-9.11)
# ---------------------------------------------------------------------------

def test_get_state(app_client):
    client, _ = app_client
    resp = client.get("/state")
    assert resp.status_code == 200
    assert resp.headers.get("cache-control") == "no-store"
    data = resp.json()
    assert "items" in data
    assert "metrics" in data


def test_get_settings(app_client):
    client, _ = app_client
    resp = client.get("/settings")
    assert resp.status_code == 200
    assert resp.headers.get("cache-control") == "no-store"
    data = resp.json()
    assert "image" in data
    assert "voice" in data


def test_get_models(app_client):
    client, _ = app_client
    resp = client.get("/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert "default" in data
    assert "current" in data


def test_get_insights(app_client):
    client, _ = app_client
    resp = client.get("/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "totals" in data


def test_get_monid_status(app_client):
    client, _ = app_client
    with patch("dashboard.monid.MonidRunner.balance", return_value={"state": "missing"}):
        resp = client.get("/monid/status")
        assert resp.status_code == 200
        assert resp.json() == {"state": "missing"}


def test_get_production_not_found(app_client):
    client, _ = app_client
    resp = client.get("/production?id=nonexistent")
    assert resp.status_code == 404


def test_serve_files_invalid_filename(app_client):
    client, _ = app_client
    for bad_name in ("bad*name.jpg", "invalid@name!.png", "illegal|name.mp4"):
        resp = client.get(f"/files/{bad_name}")
        assert resp.status_code == 400
        assert resp.json() == {"error": "Invalid filename"}


def test_serve_files_not_found(app_client):
    client, _ = app_client
    resp = client.get("/files/valid-name-not-found.jpg")
    assert resp.status_code == 404
    assert resp.json() == {"error": "File not found"}


def test_serve_files_success_and_range(app_client):
    client, tmp_path = app_client
    test_file = tmp_path / "files" / "sample.txt"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    content = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    test_file.write_bytes(content)

    # Full request
    resp = client.get("/files/sample.txt")
    assert resp.status_code == 200
    assert resp.content == content
    assert resp.headers.get("accept-ranges") == "bytes"
    assert "private" in resp.headers.get("cache-control", "")
    assert resp.headers.get("x-content-type-options") == "nosniff"

    # Range request (bytes=0-9)
    resp_range = client.get("/files/sample.txt", headers={"range": "bytes=0-9"})
    assert resp_range.status_code == 206
    assert resp_range.content == b"0123456789"
    assert resp_range.headers.get("content-range") == f"bytes 0-9/{len(content)}"


# ---------------------------------------------------------------------------
# 3. POST Routes (Requirements 9.2, 9.4-9.6)
# ---------------------------------------------------------------------------

def test_post_upload_unsupported_media_type(app_client):
    client, _ = app_client
    resp = client.post(
        "/upload",
        content=b"plain text",
        headers={"sec-fetch-site": "same-origin", "content-type": "text/plain"},
    )
    assert resp.status_code == 415
    assert resp.json() == {"error": "Unsupported media type"}


def test_post_upload_success(app_client):
    client, _ = app_client
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
    resp = client.post(
        "/upload",
        content=png_bytes,
        headers={"sec-fetch-site": "same-origin", "content-type": "image/png"},
    )
    assert resp.status_code == 200
    assert resp.headers.get("cache-control") == "no-store"
    data = resp.json()
    assert "src" in data
    assert data["src"].startswith("media-desk/files/upload_")


def test_post_upload_too_large(app_client):
    client, _ = app_client
    # Content-Length exceeds 250 MB
    resp = client.post(
        "/upload",
        content=b"",
        headers={
            "sec-fetch-site": "same-origin",
            "content-type": "image/png",
            "content-length": str(250_000_001),
        },
    )
    assert resp.status_code == 413
    assert "250MB" in resp.json().get("error", "")


def test_post_ops_body_too_large(app_client):
    client, _ = app_client
    resp = client.post(
        "/ops",
        content=b"{}",
        headers={
            "sec-fetch-site": "same-origin",
            "content-length": str(4_000_001),
        },
    )
    assert resp.status_code == 413
    assert resp.json() == {"error": "Request body too large"}


def test_post_ops_and_undo_flow(app_client):
    client, _ = app_client
    headers = {"sec-fetch-site": "same-origin"}

    # Add an item
    op = {
        "op": "add_item",
        "title": "Ops Route Title",
        "body": "Ops Route Body",
        "kind": "image",
    }
    resp = client.post("/ops", json={"ops": [op]}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["receipts"]) == 1
    new_item = next((i for i in data["state"]["items"] if i.get("title") == "Ops Route Title"), None)
    assert new_item is not None

    # Undo
    undo_resp = client.post("/undo", headers=headers)
    assert undo_resp.status_code == 200
    undo_data = undo_resp.json()
    assert undo_data["label"] == "add_item"
    assert not any(i.get("title") == "Ops Route Title" for i in undo_data["state"]["items"])


def test_post_produce_flow(app_client):
    client, _ = app_client
    headers = {"sec-fetch-site": "same-origin"}

    # Missing ID
    resp_bad = client.post("/produce", json={}, headers=headers)
    assert resp_bad.status_code == 400

    # Start produce
    with patch.object(pipeline, "start", return_value=True):
        resp = client.post("/produce", json={"id": "item_123"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["started"] is True

    # Cancel produce
    with patch.object(pipeline, "cancel"):
        resp_cancel = client.post("/produce/cancel", json={"id": "item_123"}, headers=headers)
        assert resp_cancel.status_code == 200
        assert resp_cancel.json()["cancelled"] is True


def test_post_chat_clear(app_client):
    client, _ = app_client
    headers = {"sec-fetch-site": "same-origin"}

    resp = client.post("/chat/clear", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["chat"] == []


def test_post_settings_flow(app_client):
    client, _ = app_client
    headers = {"sec-fetch-site": "same-origin"}

    update = {"lang": "en", "imageCount": 4}
    resp = client.post("/settings", json=update, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["lang"] == "en"
    assert data["imageCount"] == 4


def test_post_capture_url_missing_url(app_client):
    client, _ = app_client
    headers = {"sec-fetch-site": "same-origin"}
    resp = client.post("/capture-url", json={}, headers=headers)
    assert resp.status_code == 400


def test_asset_serving_variants_and_data_url(app_client):
    """Test /asset endpoint with media-desk/assets/*, assets/*, media-desk/files/*, files/*."""
    client, _ = app_client

    # Test each supported path prefix for an asset that exists in repo root assets/
    for prefix in ("media-desk/assets/", "assets/", "media-desk/files/", "files/"):
        resp = client.get(f"/asset?src={prefix}hills.jpg")
        assert resp.status_code == 200, f"Failed for {prefix}: {resp.text}"
        data = resp.json()
        assert "dataUrl" in data
        assert data["dataUrl"].startswith("data:image/jpeg;base64,")

    # Nonexistent file -> 404
    resp_404 = client.get("/asset?src=media-desk/assets/nonexistent_xyz.jpg")
    assert resp_404.status_code == 404

    # Invalid path -> 400
    resp_bad = client.get("/asset?src=invalid/path/evil.jpg")
    assert resp_bad.status_code == 400


def test_serve_file_asset_and_media_desk_routes(app_client):
    """Test /assets/{filename} and /media-desk/assets/{filename} routes."""
    client, _ = app_client

    resp1 = client.get("/assets/hills.jpg")
    assert resp1.status_code == 200
    assert len(resp1.content) > 0

    resp2 = client.get("/media-desk/assets/hills.jpg")
    assert resp2.status_code == 200
    assert len(resp2.content) > 0

