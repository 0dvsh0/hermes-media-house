"""Content export and reveal utilities for hermes-media-desk.

Provides:
- ``sanitize_filename``: Strip forbidden filesystem characters and fall back to ID.
- ``save_production``: Create export directory, copy assets, generate Markdown script
  and storyboard table.
- ``reveal_production``: Open export folder in native OS file manager.
- ``resolve_export_dir``: Expand ~/ and determine default export directory.

Requirements: 14.1-14.12
"""

from __future__ import annotations

import base64
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger("hermes_media_desk.export")

FORBIDDEN_CHARS = r'\/:*?"<>|'

FILE_NAMES = {
    "zh": {
        "cover": "cover-original",
        "video_cover": "video-cover.jpg",
        "figure": "figure-{n}",
        "shot": "shot-{n:02d}",
        "script": "script.md",
        "storyboard": "storyboard.md",
    },
    "en": {
        "cover": "cover-original",
        "video_cover": "video-cover.jpg",
        "figure": "figure-{n}",
        "shot": "shot-{n:02d}",
        "script": "script.md",
        "storyboard": "storyboard.md",
    },
}


def sanitize_filename(name: str | None, fallback_id: str = "export") -> str:
    """Sanitize title for use as a filesystem directory name.

    Removes forbidden characters: \\ / : * ? " < > |
    If the result is empty after stripping whitespace, returns fallback_id or 'export'.
    Guarantees no forbidden characters exist in the return value.

    Requirements: 14.1, Property 13.
    """
    sanitized = ""
    if name:
        sanitized = name
        for ch in FORBIDDEN_CHARS:
            sanitized = sanitized.replace(ch, "")
        sanitized = sanitized.strip()

    if not sanitized:
        clean_fallback = str(fallback_id) if fallback_id else "export"
        for ch in FORBIDDEN_CHARS:
            clean_fallback = clean_fallback.replace(ch, "")
        sanitized = clean_fallback.strip() or "export"

    return sanitized


def resolve_export_dir(export_dir_setting: str | None = None, lang: str = "en") -> Path:
    """Resolve base export directory by expanding ~ and applying defaults.

    Requirements: 14.9, 14.10.
    """
    if export_dir_setting and export_dir_setting.strip():
        return Path(os.path.expanduser(export_dir_setting.strip())).resolve()

    return Path(os.path.expanduser("~/Documents/Media Desk")).resolve()


def _get_filename_from_src(src: str | None) -> str | None:
    if not src or not isinstance(src, str):
        return None
    return src.replace("\\", "/").split("/")[-1]


def _build_storyboard_markdown(shots: list[dict[str, Any]], copied_shots: list[str], lang: str = "en") -> str:
    """Generate Markdown storyboard table from shots list."""
    headers = ["Shot", "Shot Size", "Duration", "Visual Description", "Voice-Over", "Frame"]

    lines = [
        f"| {' | '.join(headers)} |",
        "| :---: | :---: | :---: | :--- | :--- | :---: |",
    ]

    for idx, shot in enumerate(shots, start=1):
        shot_num = str(shot.get("shotNumber") or idx)
        shot_size = str(shot.get("shotSize") or shot.get("size") or "")
        dur = shot.get("duration")
        duration_str = f"{dur}s" if dur else ""
        desc = str(shot.get("visual") or shot.get("description") or "").replace("|", "\\|")
        vo = str(shot.get("voiceover") or shot.get("dialogue") or shot.get("narration") or "").replace("|", "\\|")

        frame_str = ""
        if idx - 1 < len(copied_shots) and copied_shots[idx - 1]:
            shot_filename = copied_shots[idx - 1]
            frame_str = f"![shot-{idx:02d}](./{shot_filename})"

        lines.append(f"| {shot_num} | {shot_size} | {duration_str} | {desc} | {vo} | {frame_str} |")

    return "\n".join(lines) + "\n"


def _embed_figures_in_script(article: str, copied_figures: list[str]) -> str:
    """Embed figure images immediately after matching ## heading lines."""
    lines = article.split("\n")
    result_lines: list[str] = []
    heading_count = 0

    for line in lines:
        result_lines.append(line)
        # Check if line is a ## heading (level 2)
        if re.match(r"^##\s+", line.strip()):
            heading_count += 1
            if heading_count <= len(copied_figures) and copied_figures[heading_count - 1]:
                fig_filename = copied_figures[heading_count - 1]
                result_lines.append("")
                result_lines.append(f"![figure-{heading_count}](./{fig_filename})")
                result_lines.append("")

    return "\n".join(result_lines)


async def save_production(
    item_id: str,
    production: dict[str, Any],
    settings: dict[str, Any],
    video_cover_b64: str | None = None,
    lang: str = "en",
    files_dir: Path | None = None,
) -> dict[str, Any]:
    """Export a production's text, images, and storyboard to disk.

    Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.9, 14.10, 14.11.
    """
    # 1. Validate article non-empty (Requirement 14.11)
    article = production.get("article")
    if not article or not isinstance(article, str) or not article.strip():
        raise HTTPException(400, detail="Production article is empty")

    # 2. Validate video cover JPEG magic bytes if present (Requirements 14.5, 14.6)
    video_cover_bytes: bytes | None = None
    if video_cover_b64 and video_cover_b64.strip():
        raw_b64 = video_cover_b64.strip()
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        try:
            video_cover_bytes = base64.b64decode(raw_b64)
        except Exception:
            raise HTTPException(400, detail="Invalid video cover: base64 decode failed")

        if len(video_cover_bytes) < 2 or video_cover_bytes[:2] != b"\xff\xd8":
            raise HTTPException(400, detail="Invalid video cover: not a valid JPEG")

    # 3. Resolve export directory & folder name (Requirements 14.1, 14.9, 14.10)
    base_export_dir = resolve_export_dir(settings.get("exportDir"), lang=lang)
    title = production.get("title")
    prod_id = production.get("id") or item_id
    folder_name = sanitize_filename(title, fallback_id=prod_id)
    target_dir = base_export_dir / folder_name

    # Overwrite if exists
    target_dir.mkdir(parents=True, exist_ok=True)

    names = FILE_NAMES.get(lang, FILE_NAMES["en"])
    written_files: list[str] = []

    if files_dir is None:
        files_dir = Path("files")

    try:
        # 4. Copy Assets from files_dir (Requirement 14.2)
        # Cover asset
        cover_asset = production.get("cover")
        if isinstance(cover_asset, dict):
            src = cover_asset.get("src")
            if src:
                filename = _get_filename_from_src(src)
                src_path = files_dir / filename if filename else None
                if not src_path or not src_path.is_file():
                    raise FileNotFoundError(filename or "cover")
                ext = src_path.suffix or ".jpg"
                dest_name = f"{names['cover']}{ext}"
                shutil.copy2(src_path, target_dir / dest_name)
                written_files.append(dest_name)

        # Video cover
        if video_cover_bytes:
            v_name = names["video_cover"]
            (target_dir / v_name).write_bytes(video_cover_bytes)
            written_files.append(v_name)

        # Figures (production.images)
        copied_figures: list[str] = []
        images = production.get("images", [])
        for i, fig in enumerate(images, start=1):
            fig_file = ""
            if isinstance(fig, dict):
                src = fig.get("src")
                if src:
                    filename = _get_filename_from_src(src)
                    src_path = files_dir / filename if filename else None
                    if not src_path or not src_path.is_file():
                        raise FileNotFoundError(filename or f"figure_{i}")
                    ext = src_path.suffix or ".jpg"
                    dest_name = f"{names['figure'].format(n=i)}{ext}"
                    shutil.copy2(src_path, target_dir / dest_name)
                    written_files.append(dest_name)
                    fig_file = dest_name
            copied_figures.append(fig_file)

        # Shots (production.shots)
        copied_shots: list[str] = []
        shots = production.get("shots", [])
        for i, shot in enumerate(shots, start=1):
            shot_file = ""
            if isinstance(shot, dict):
                src = shot.get("src") or (shot.get("image", {}).get("src") if isinstance(shot.get("image"), dict) else None)
                if src:
                    filename = _get_filename_from_src(src)
                    src_path = files_dir / filename if filename else None
                    if not src_path or not src_path.is_file():
                        raise FileNotFoundError(filename or f"shot_{i}")
                    ext = src_path.suffix or ".jpg"
                    dest_name = f"{names['shot'].format(n=i)}{ext}"
                    shutil.copy2(src_path, target_dir / dest_name)
                    written_files.append(dest_name)
                    shot_file = dest_name
            copied_shots.append(shot_file)

        # 5. Write script markdown (Requirement 14.3)
        script_content = _embed_figures_in_script(article, copied_figures)
        script_filename = names["script"]
        (target_dir / script_filename).write_text(script_content, encoding="utf-8")
        written_files.append(script_filename)

        # 6. Write storyboard markdown when shots present (Requirement 14.4)
        if shots:
            storyboard_content = _build_storyboard_markdown(shots, copied_shots, lang=lang)
            storyboard_filename = names["storyboard"]
            (target_dir / storyboard_filename).write_text(storyboard_content, encoding="utf-8")
            written_files.append(storyboard_filename)

    except FileNotFoundError as exc:
        # Abort and clean up partial folder (Requirement 14.2)
        shutil.rmtree(target_dir, ignore_errors=True)
        raise HTTPException(500, detail=f"Asset file missing from store: {exc}")
    except Exception as exc:
        shutil.rmtree(target_dir, ignore_errors=True)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(500, detail=f"Export failed: {exc}")

    # Update production savedPath
    production["savedPath"] = str(target_dir)

    return {
        "path": str(target_dir),
        "files": written_files,
        "state": "saved",
    }


async def reveal_production(production: dict[str, Any]) -> None:
    """Open saved export directory in native OS file manager.

    Requirements: 14.8, 14.12.
    """
    saved_path = production.get("savedPath")
    if not saved_path or not str(saved_path).strip():
        raise HTTPException(400, detail="Production has not been saved yet")

    path_obj = Path(saved_path)
    if not path_obj.exists():
        raise HTTPException(400, detail=f"Saved directory does not exist: {saved_path}")

    try:
        if sys.platform == "win32":
            subprocess.Popen(["explorer", str(path_obj.resolve())])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path_obj.resolve())])
        else:
            subprocess.Popen(["xdg-open", str(path_obj.resolve())])
    except Exception as exc:
        logger.warning("Failed to open file manager for '%s': %s", saved_path, exc)
