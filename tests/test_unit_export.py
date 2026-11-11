"""Unit and Property tests for dashboard/export.py.

Validates Requirements 14.1-14.12:
- Property 13: Export Filename Safety (Hypothesis)
- Export directory resolution
- Asset copying and missing asset 500 cleanup
- Script markdown generation with ## figure embedding
- Storyboard table generation
- Video cover JPEG magic byte validation
- Reveal production error handling and OS invocation
"""

from __future__ import annotations

import base64
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from hypothesis import given, settings
import hypothesis.strategies as st
import pytest

from dashboard.export import (
    FORBIDDEN_CHARS,
    resolve_export_dir,
    reveal_production,
    sanitize_filename,
    save_production,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ---------------------------------------------------------------------------
# 1. Property 13: Export Filename Safety (Task 13.1, Requirement 14.1)
# ---------------------------------------------------------------------------

@given(
    title=st.text(),
    fallback_id=st.text(min_size=1),
)
@settings(max_examples=200, deadline=None)
def test_property_13_export_filename_safety(title: str, fallback_id: str):
    """Property 13: For any title containing characters from \\ / : * ? " < > |,
    the sanitized name contains none of those characters; if sanitization yields empty
    string, the production id (or clean fallback) is used instead.
    """
    sanitized = sanitize_filename(title, fallback_id=fallback_id)

    # 1. Must never contain any forbidden character
    for forbidden in FORBIDDEN_CHARS:
        assert forbidden not in sanitized

    # 2. Must not be empty
    assert len(sanitized) > 0

    # 3. If title consists entirely of whitespace and forbidden characters,
    # the sanitized fallback should be used.
    raw_cleaned = "".join(c for c in title if c not in FORBIDDEN_CHARS).strip()
    if not raw_cleaned:
        fallback_cleaned = "".join(c for c in fallback_id if c not in FORBIDDEN_CHARS).strip() or "export"
        assert sanitized == fallback_cleaned


def test_sanitize_filename_concrete_cases():
    assert sanitize_filename('My / Cool: Video * "Title"? <Yes> | No') == "My  Cool Video  Title Yes  No"
    assert sanitize_filename("///:::***???") == "export"
    assert sanitize_filename("///:::***???", fallback_id="item_999") == "item_999"
    assert sanitize_filename("", fallback_id="fallback_1") == "fallback_1"
    assert sanitize_filename(None, fallback_id="prod_42") == "prod_42"


# ---------------------------------------------------------------------------
# 2. Export Directory Resolution (Requirements 14.9, 14.10)
# ---------------------------------------------------------------------------

def test_resolve_export_dir_custom_setting(tmp_path: Path):
    custom_dir = str(tmp_path / "custom_exports")
    res = resolve_export_dir(custom_dir, lang="zh")
    assert str(res) == str(Path(custom_dir).resolve())


def test_resolve_export_dir_default(tmp_path: Path):
    with patch("os.path.expanduser", return_value=str(tmp_path / "Documents" / "Media Desk")):
        res = resolve_export_dir(None)
        assert "Media Desk" in str(res)


# ---------------------------------------------------------------------------
# 3. Save Production Tests (Requirements 14.1-14.7, 14.11)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_save_production_empty_article_raises_400():
    prod = {"id": "p1", "title": "Test", "article": ""}
    with pytest.raises(HTTPException) as exc:
        await save_production("item1", prod, {})
    assert exc.value.status_code == 400
    assert "article is empty" in exc.value.detail


@pytest.mark.anyio
async def test_save_production_invalid_video_cover_raises_400():
    prod = {"id": "p1", "title": "Test", "article": "# Headline\n\nBody content"}
    # Invalid JPEG header (PNG magic instead)
    bad_b64 = base64.b64encode(b"\x89PNG\r\n\x1a\n1234").decode()
    with pytest.raises(HTTPException) as exc:
        await save_production("item1", prod, {}, video_cover_b64=bad_b64)
    assert exc.value.status_code == 400
    assert "not a valid JPEG" in exc.value.detail


@pytest.mark.anyio
async def test_save_production_missing_asset_raises_500_and_cleans_up(tmp_path: Path):
    export_base = tmp_path / "exports"
    files_dir = tmp_path / "files"
    files_dir.mkdir(parents=True)

    prod = {
        "id": "p1",
        "title": "My Export Video",
        "article": "## Header 1\n\nContent here.",
        "cover": {"src": "media-desk/files/missing_cover.jpg"},
    }

    settings = {"exportDir": str(export_base)}
    with pytest.raises(HTTPException) as exc:
        await save_production("item1", prod, settings, files_dir=files_dir)

    assert exc.value.status_code == 500
    assert "Asset file missing" in exc.value.detail

    # Folder must have been deleted
    target_folder = export_base / "My Export Video"
    assert not target_folder.exists()


@pytest.mark.anyio
async def test_save_production_success(tmp_path: Path):
    export_base = tmp_path / "exports"
    files_dir = tmp_path / "files"
    files_dir.mkdir(parents=True)

    # Create dummy asset files
    (files_dir / "cover.jpg").write_bytes(b"\xff\xd8\xff\xe0dummy_cover")
    (files_dir / "fig1.png").write_bytes(b"\x89PNGdummy_fig")
    (files_dir / "shot1.jpg").write_bytes(b"\xff\xd8dummy_shot")

    # Valid JPEG for video cover
    valid_video_b64 = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0dummy_video_cover").decode()

    prod = {
        "id": "p1",
        "title": "Media Desk Production: Viral Title",
        "article": "## Key Point 1\n\nFirst paragraph.\n\n## Key Point 2\n\nSecond paragraph.",
        "cover": {"src": "media-desk/files/cover.jpg"},
        "images": [{"src": "media-desk/files/fig1.png"}],
        "shots": [
            {
                "shotNumber": 1,
                "shotSize": "Close-up",
                "duration": 3,
                "visual": "Host holding product close-up",
                "voiceover": "Check out the details of this item",
                "src": "media-desk/files/shot1.jpg",
            }
        ],
    }

    settings = {"exportDir": str(export_base)}
    res = await save_production("item1", prod, settings, video_cover_b64=valid_video_b64, lang="en", files_dir=files_dir)

    assert res["state"] == "saved"
    assert "Media Desk Production Viral Title" in res["path"]
    target_dir = Path(res["path"])
    assert target_dir.is_dir()

    # Check copied files
    assert (target_dir / "cover-original.jpg").exists()
    assert (target_dir / "video-cover.jpg").exists()
    assert (target_dir / "figure-1.png").exists()
    assert (target_dir / "shot-01.jpg").exists()
    assert (target_dir / "script.md").exists()
    assert (target_dir / "storyboard.md").exists()

    # Check script content has embedded figure
    script_txt = (target_dir / "script.md").read_text(encoding="utf-8")
    assert "![figure-1](./figure-1.png)" in script_txt

    # Check storyboard content has table headers and shot row
    sb_txt = (target_dir / "storyboard.md").read_text(encoding="utf-8")
    assert "| Shot | Shot Size | Duration | Visual Description | Voice-Over | Frame |" in sb_txt
    assert "Host holding product close-up" in sb_txt
    assert "![shot-01](./shot-01.jpg)" in sb_txt

    # Verify production updated
    assert prod["savedPath"] == str(target_dir)


@pytest.mark.anyio
async def test_save_production_success_en(tmp_path: Path):
    export_base = tmp_path / "exports"
    files_dir = tmp_path / "files"
    files_dir.mkdir(parents=True)

    (files_dir / "cover.png").write_bytes(b"\x89PNGdummy")

    prod = {
        "id": "p2",
        "title": "English Tech Review",
        "article": "## Introduction\n\nIntro content.",
        "cover": {"src": "media-desk/files/cover.png"},
        "images": [],
        "shots": [],
    }

    settings = {"exportDir": str(export_base)}
    res = await save_production("item2", prod, settings, lang="en", files_dir=files_dir)

    assert res["state"] == "saved"
    target_dir = Path(res["path"])
    assert (target_dir / "cover-original.png").exists()
    assert (target_dir / "script.md").exists()
    assert not (target_dir / "storyboard.md").exists()  # shots were empty


# ---------------------------------------------------------------------------
# 4. Reveal Production Tests (Requirements 14.8, 14.12)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_reveal_production_unsaved_raises_400():
    with pytest.raises(HTTPException) as exc:
        await reveal_production({})
    assert exc.value.status_code == 400
    assert "not been saved yet" in exc.value.detail


@pytest.mark.anyio
async def test_reveal_production_nonexistent_dir_raises_400(tmp_path: Path):
    non_dir = str(tmp_path / "does_not_exist")
    with pytest.raises(HTTPException) as exc:
        await reveal_production({"savedPath": non_dir})
    assert exc.value.status_code == 400
    assert "does not exist" in exc.value.detail


@pytest.mark.anyio
async def test_reveal_production_launches_process(tmp_path: Path):
    target_dir = tmp_path / "saved_export"
    target_dir.mkdir()

    with patch("subprocess.Popen") as mock_popen:
        await reveal_production({"savedPath": str(target_dir)})
        mock_popen.assert_called_once()
