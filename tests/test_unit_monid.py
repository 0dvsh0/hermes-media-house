"""Unit tests for dashboard/monid.py.

Validates Requirements 13.1-13.14:
- Monid CLI discovery & Windows .cmd shim resolution
- Monid balance status reporting
- Short link resolution with SSRF checks
- Platform URL validation
- Platform normalizers for all 6 platforms
- Post upserting, metric updates, title/body divergence preservation
- Concurrency 409 handling
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
import httpx
import pytest

from dashboard.monid import (
    COMMON_SCHEMA_KEYS,
    MonidRunner,
    PLATFORM_NORMALIZERS,
    is_short_link,
    normalize_post,
    resolve_shortlink,
    validate_platform_url,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ---------------------------------------------------------------------------
# 1. Platform Normalizer Tests (Requirement 13.6)
# ---------------------------------------------------------------------------

def test_all_platforms_covered():
    assert set(PLATFORM_NORMALIZERS.keys()) == {
        "Xiaohongshu", "Douyin", "Bilibili", "TikTok", "Instagram", "X",
        "YouTube", "LinkedIn", "Substack",
    }


def test_xiaohongshu_normalizer():
    raw = {
        "note_id": "xhs_123",
        "title": "Red Note Title",
        "desc": "Red Note Body",
        "time": "2026-03-01T12:00:00Z",
        "note_url": "https://www.xiaohongshu.com/discovery/item/xhs_123",
        "cover": "https://sns-img.xhscdn.com/cover.jpg",
        "view_num": 1000,
        "liked_count": 80,
        "comment_count": 20,
        "collect_count": 50,
        "share_count": 30,
    }
    norm = normalize_post("Xiaohongshu", raw)
    for k in COMMON_SCHEMA_KEYS:
        assert k in norm

    assert norm["id"] == "xhs_123"
    assert norm["title"] == "Red Note Title"
    assert norm["body"] == "Red Note Body"
    assert norm["views"] == 1000
    assert norm["likes"] == 80
    assert norm["saves"] == 50
    assert norm["shares"] == 30

    # Missing fields default to None
    empty_norm = normalize_post("Xiaohongshu", {})
    assert empty_norm["id"] is None
    assert empty_norm["title"] is None
    assert empty_norm["views"] is None
    assert empty_norm["saves"] is None


def test_douyin_normalizer():
    raw = {
        "aweme_id": "dy_456",
        "desc": "Douyin Video Description",
        "create_time": 1700000000,
        "share_url": "https://www.douyin.com/video/dy_456",
        "video": {
            "cover": {"url_list": ["https://p3.douyinpic.com/cover.jpg"]}
        },
        "statistics": {
            "play_count": 5000,
            "digg_count": 400,
            "comment_count": 100,
            "collect_count": 250,
            "share_count": 150,
        },
    }
    norm = normalize_post("Douyin", raw)
    assert norm["id"] == "dy_456"
    assert norm["title"] == "Douyin Video Description"
    assert norm["body"] == "Douyin Video Description"
    assert norm["cover"] == "https://p3.douyinpic.com/cover.jpg"
    assert norm["views"] == 5000
    assert norm["likes"] == 400
    assert norm["comments"] == 100
    assert norm["saves"] == 250
    assert norm["shares"] == 150


def test_bilibili_normalizer():
    raw = {
        "bvid": "BV1xx411c7X",
        "aid": 123456,
        "title": "Bilibili Video Title",
        "desc": "Bilibili Video Description",
        "pubdate": 1700000000,
        "pic": "https://i0.hdslb.com/bfs/archive/cover.jpg",
        "stat": {
            "view": 12000,
            "like": 900,
            "reply": 150,
            "favorite": 600,
            "share": 200,
        },
    }
    norm = normalize_post("Bilibili", raw)
    assert norm["id"] == "BV1xx411c7X"
    assert norm["title"] == "Bilibili Video Title"
    assert norm["body"] == "Bilibili Video Description"
    assert norm["url"] == "https://www.bilibili.com/video/BV1xx411c7X"
    assert norm["cover"] == "https://i0.hdslb.com/bfs/archive/cover.jpg"
    assert norm["views"] == 12000
    assert norm["likes"] == 900
    assert norm["comments"] == 150
    assert norm["saves"] == 600
    assert norm["shares"] == 200


def test_tiktok_normalizer():
    raw = {
        "id": "tt_789",
        "desc": "TikTok Dance Trend",
        "createTime": 1700000000,
        "url": "https://www.tiktok.com/@user/video/tt_789",
        "cover": "https://p16-va.tiktokcdn.com/cover.jpg",
        "stats": {
            "playCount": 8000,
            "diggCount": 640,
            "commentCount": 160,
            "collectCount": 400,
            "shareCount": 240,
        },
    }
    norm = normalize_post("TikTok", raw)
    assert norm["id"] == "tt_789"
    assert norm["title"] == "TikTok Dance Trend"
    assert norm["views"] == 8000
    assert norm["likes"] == 640
    assert norm["saves"] == 400


def test_instagram_normalizer():
    raw = {
        "code": "C12345",
        "caption": {"text": "Sunset at the beach"},
        "taken_at": 1700000000,
        "image_versions2": {
            "candidates": [{"url": "https://instagram.com/p/pic.jpg"}]
        },
        "like_count": 350,
        "comment_count": 45,
    }
    norm = normalize_post("Instagram", raw)
    assert norm["id"] == "C12345"
    assert norm["title"] == "Sunset at the beach"
    assert norm["url"] == "https://www.instagram.com/p/C12345/"
    assert norm["cover"] == "https://instagram.com/p/pic.jpg"
    assert norm["likes"] == 350
    assert norm["comments"] == 45
    assert norm["views"] is None


def test_x_normalizer():
    raw = {
        "id_str": "1800000000000",
        "full_text": "Excited to launch our new feature! Check it out here: https://...",
        "created_at": "Wed Oct 10 20:19:24 +0000 2026",
        "entities": {
            "media": [{"media_url_https": "https://pbs.twimg.com/media/xyz.jpg"}]
        },
        "public_metrics": {
            "impression_count": 15000,
            "like_count": 420,
            "reply_count": 85,
            "retweet_count": 120,
            "bookmark_count": 95,
        },
    }
    norm = normalize_post("X", raw)
    assert norm["id"] == "1800000000000"
    assert "Excited to launch" in norm["title"]
    assert norm["url"] == "https://x.com/i/web/status/1800000000000"
    assert norm["cover"] == "https://pbs.twimg.com/media/xyz.jpg"
    assert norm["views"] == 15000
    assert norm["likes"] == 420
    assert norm["comments"] == 85
    assert norm["shares"] == 120
    assert norm["saves"] == 95


# ---------------------------------------------------------------------------
# 2. Platform URL Validation & Short Links (Requirements 13.12, 13.13)
# ---------------------------------------------------------------------------

def test_validate_platform_url_valid():
    cases = [
        ("https://www.xiaohongshu.com/user/profile/123", "Xiaohongshu"),
        ("https://v.douyin.com/abc1234/", "Douyin"),
        ("https://space.bilibili.com/45678", "Bilibili"),
        ("https://www.tiktok.com/@creator", "TikTok"),
        ("https://www.instagram.com/creator/", "Instagram"),
        ("https://x.com/username", "X"),
        ("https://twitter.com/username", "X"),
    ]
    for url, expected_plat in cases:
        plat, u = validate_platform_url(url)
        assert plat == expected_plat
        assert u == url


def test_validate_platform_url_invalid():
    # Non-http scheme
    with pytest.raises(HTTPException) as exc:
        validate_platform_url("ftp://example.com")
    assert exc.value.status_code == 400

    # Unsupported platform
    with pytest.raises(HTTPException) as exc:
        validate_platform_url("https://unknown-platform.com/user")
    assert exc.value.status_code == 400

    # Platform mismatch
    with pytest.raises(HTTPException) as exc:
        validate_platform_url("https://x.com/user", platform="Douyin")
    assert exc.value.status_code == 400


def test_is_short_link():
    assert is_short_link("https://xhslink.com/a/b")
    assert is_short_link("https://v.douyin.com/xyz/")
    assert is_short_link("https://b23.tv/abc")
    assert is_short_link("https://vm.tiktok.com/xyz")
    assert is_short_link("https://vt.tiktok.com/xyz")
    assert not is_short_link("https://www.bilibili.com/video/BV123")


@pytest.mark.anyio
async def test_resolve_shortlink_direct():
    # Non-shortlink returns immediately without requests
    with patch("dashboard.monid.validate_target_host") as mock_val:
        res = await resolve_shortlink("https://www.bilibili.com/video/BV123")
        assert res == "https://www.bilibili.com/video/BV123"
        mock_val.assert_called_once_with("www.bilibili.com")


@pytest.mark.anyio
async def test_resolve_shortlink_redirect_chain():
    # Mock redirect chain: b23.tv -> bilibili.com
    with patch("dashboard.monid.validate_target_host"):
        mock_resp = MagicMock()
        mock_resp.status_code = 302
        mock_resp.headers = {"location": "https://www.bilibili.com/video/BV123"}

        mock_client = AsyncMock()
        mock_client.head.return_value = mock_resp
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False

        with patch("httpx.AsyncClient", return_value=mock_client):
            res = await resolve_shortlink("https://b23.tv/short")
            assert res == "https://www.bilibili.com/video/BV123"


@pytest.mark.anyio
async def test_resolve_shortlink_redirect_limit():
    # 5 redirects should exceed max_redirects=4
    with patch("dashboard.monid.validate_target_host"):
        mock_resp = MagicMock()
        mock_resp.status_code = 302
        mock_resp.headers = {"location": "https://b23.tv/next"}

        mock_client = AsyncMock()
        mock_client.head.return_value = mock_resp
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False

        with patch("httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc:
                await resolve_shortlink("https://b23.tv/start")
            assert exc.value.status_code == 400
            assert "Redirect limit exceeded" in exc.value.detail


# ---------------------------------------------------------------------------
# 3. MonidRunner Balance & Discovery Tests (Requirements 13.1, 13.2, 13.3, 13.11)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_balance_missing_exe():
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=None):
        status = await runner.balance()
        assert status == {"state": "missing"}


@pytest.mark.anyio
async def test_balance_ready():
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=["monid"]):
        mock_proc = AsyncMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = (b'{"balance": 150.5, "currency": "CNY"}', b"")

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            status = await runner.balance()
            assert status["state"] == "ready"
            assert status["balance"] == 150.5


@pytest.mark.anyio
async def test_balance_nokey():
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=["monid"]):
        mock_proc = AsyncMock()
        mock_proc.returncode = 1
        mock_proc.communicate.return_value = (b"", b"Error: No API key configured. Run monid auth.")

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            status = await runner.balance()
            assert status["state"] == "nokey"


@pytest.mark.anyio
async def test_balance_error():
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=["monid"]):
        mock_proc = AsyncMock()
        mock_proc.returncode = 1
        mock_proc.communicate.return_value = (b"", b"Network connection refused")

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            status = await runner.balance()
            assert status["state"] == "error"
            assert "connection refused" in status["message"]


def test_windows_cmd_shim_resolution(tmp_path: Path):
    runner = MonidRunner()
    cmd_file = tmp_path / "monid.cmd"
    js_file = tmp_path / "node_modules" / "monid" / "bin" / "monid.js"
    js_file.parent.mkdir(parents=True)
    js_file.write_text("// entry js", encoding="utf-8")

    # Sample npm-generated .cmd
    cmd_file.write_text(
        '@ECHO off\n"%_prog%" "%~dp0\\node_modules\\monid\\bin\\monid.js" %*\n',
        encoding="utf-8",
    )

    resolved = runner._resolve_windows_cmd_shim(str(cmd_file))
    assert resolved is not None
    assert resolved[0].lower().endswith(("node", "node.exe"))
    assert str(js_file.resolve()) == resolved[1]


# ---------------------------------------------------------------------------
# 4. MonidRunner Import Posts Tests (Requirements 13.4, 13.5, 13.7, 13.9, 13.10, 13.14)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_import_posts_missing_exe_raises_503():
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=None):
        with pytest.raises(HTTPException) as exc:
            await runner.import_posts("Xiaohongshu", "https://www.xiaohongshu.com/user/123")
        assert exc.value.status_code == 503
        assert "unavailable" in exc.value.detail


@pytest.mark.anyio
async def test_import_posts_concurrency_409():
    runner = MonidRunner()
    runner._import_running = True
    with pytest.raises(HTTPException) as exc:
        await runner.import_posts("Xiaohongshu", "https://www.xiaohongshu.com/user/123")
    assert exc.value.status_code == 409
    assert "already in progress" in exc.value.detail


@pytest.mark.anyio
async def test_import_posts_success_and_upsert():
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=["monid"]), \
         patch("dashboard.monid.validate_target_host"):

        # Mock CLI stdout
        mock_output = {
            "nickname": "TestCreator",
            "cost": 0.5,
            "posts": [
                {
                    "note_id": "post_1",
                    "title": "Post 1 Title",
                    "desc": "Post 1 Description body",
                    "view_num": 500,
                    "liked_count": 40,
                },
                {
                    "note_id": "post_2",
                    "title": "Post 2 Title",
                    "desc": "Post 2 Description body",
                    "view_num": 1200,
                    "liked_count": 100,
                },
            ]
        }

        mock_proc = AsyncMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = (json.dumps(mock_output).encode(), b"")

        store_state = {"items": [], "metrics": []}
        mock_store = AsyncMock()
        mock_store.get.return_value = store_state

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            receipt = await runner.import_posts(
                platform="Xiaohongshu",
                url="https://www.xiaohongshu.com/user/123",
                store=mock_store,
            )

            assert receipt["state"] == "done"
            assert receipt["count"] == 2
            assert receipt["added"] == 2
            assert receipt["nickname"] == "TestCreator"
            assert receipt["cost"] == 0.5

            # Verify store items
            assert len(store_state["items"]) == 2
            assert store_state["items"][0]["id"] == "Xiaohongshu:post_1"
            assert store_state["items"][0]["title"] == "Post 1 Title"
            assert store_state["items"][0]["_lastImportedTitle"] == "Post 1 Title"

            # Verify metrics
            assert len(store_state["metrics"]) == 2
            assert store_state["metrics"][0]["itemId"] == "Xiaohongshu:post_1"
            assert store_state["metrics"][0]["views"] == 500


@pytest.mark.anyio
async def test_import_posts_reimport_preserves_user_edit():
    """Requirement 13.7: On re-import, preserve title/body if diverged from last-imported."""
    runner = MonidRunner()
    with patch.object(runner, "find_exe", return_value=["monid"]), \
         patch("dashboard.monid.validate_target_host"):

        # Existing item where user edited the title
        existing_item = {
            "id": "Xiaohongshu:post_1",
            "title": "User Modified Title",
            "body": "Post 1 Description body",
            "_lastImportedTitle": "Original Post 1 Title",
            "_lastImportedBody": "Post 1 Description body",
        }

        store_state = {
            "items": [existing_item],
            "metrics": [{"itemId": "Xiaohongshu:post_1", "views": 100, "likes": 10}],
        }
        mock_store = AsyncMock()
        mock_store.get.return_value = store_state

        mock_output = {
            "posts": [
                {
                    "note_id": "post_1",
                    "title": "New Title From Platform",
                    "desc": "New Description From Platform",
                    "view_num": 800,
                    "liked_count": 90,
                }
            ]
        }
        mock_proc = AsyncMock()
        mock_proc.returncode = 0
        mock_proc.communicate.return_value = (json.dumps(mock_output).encode(), b"")

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            receipt = await runner.import_posts(
                platform="Xiaohongshu",
                url="https://www.xiaohongshu.com/user/123",
                store=mock_store,
            )

            assert receipt["added"] == 0
            # Title was edited by user: MUST be preserved!
            assert existing_item["title"] == "User Modified Title"
            # Body was NOT edited by user: updated to new body!
            assert existing_item["body"] == "New Description From Platform"
            # Metric updated
            assert store_state["metrics"][0]["views"] == 800
            assert store_state["metrics"][0]["likes"] == 90
