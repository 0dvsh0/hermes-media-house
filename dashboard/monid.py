"""Monid CLI runner, platform normalizers, and short-link resolver.

Provides:
- ``MonidRunner``: CLI discovery, balance checking, and social post importing.
- ``PLATFORM_NORMALIZERS``: Mapping platform responses to common schema for
  Xiaohongshu, Douyin, Bilibili, TikTok, Instagram, X.
- ``resolve_shortlink``: Following short links up to 4 hops with SSRF checks.
- ``validate_platform_url``: Validating and detecting platform URLs.

Requirements: 13.1-13.14
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any, Callable
from urllib.parse import urljoin, urlsplit

from fastapi import HTTPException
import httpx

from dashboard.harvest import validate_target_host

logger = logging.getLogger("hermes_media_desk.monid")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

POST_COUNT = 20

SEARCH_PATHS = [
    "/opt/homebrew/bin",
    "~/.npm-global/bin",
    "~/.local/bin",
    "~/.volta/bin",
    "~/.bun/bin",
]

SHORT_LINK_DOMAINS = {
    "xhslink.com",
    "v.douyin.com",
    "b23.tv",
    "vm.tiktok.com",
    "vt.tiktok.com",
}

SUPPORTED_PLATFORMS = {"X", "YouTube", "LinkedIn", "Substack", "TikTok", "Instagram", "Xiaohongshu", "Douyin", "Bilibili"}

PLATFORM_DOMAIN_PATTERNS: dict[str, list[str]] = {
    "X": ["x.com", "twitter.com"],
    "YouTube": ["youtube.com", "youtu.be"],
    "LinkedIn": ["linkedin.com"],
    "Substack": ["substack.com"],
    "TikTok": ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
    "Instagram": ["instagram.com", "instagr.am"],
    "Xiaohongshu": ["xiaohongshu.com", "xhslink.com"],
    "Douyin": ["douyin.com", "iesdouyin.com", "v.douyin.com"],
    "Bilibili": ["bilibili.com", "b23.tv"],
}

COMMON_SCHEMA_KEYS = (
    "id",
    "title",
    "body",
    "publishedAt",
    "url",
    "cover",
    "views",
    "likes",
    "comments",
    "saves",
    "shares",
)


# ---------------------------------------------------------------------------
# Platform Normalizers (Requirement 13.6)
# ---------------------------------------------------------------------------

def _norm_xiaohongshu(r: dict) -> dict[str, Any]:
    raw_id = r.get("note_id") if r.get("note_id") is not None else r.get("id")
    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("title") or r.get("desc") or None,
        "body": r.get("desc") or None,
        "publishedAt": str(r["time"]) if r.get("time") is not None else (str(r["publishedAt"]) if r.get("publishedAt") is not None else None),
        "url": r.get("note_url") or r.get("url") or None,
        "cover": r.get("cover") or None,
        "views": r.get("view_num") if r.get("view_num") is not None else r.get("views"),
        "likes": r.get("liked_count") if r.get("liked_count") is not None else r.get("likes"),
        "comments": r.get("comment_count") if r.get("comment_count") is not None else r.get("comments"),
        "saves": r.get("collect_count") if r.get("collect_count") is not None else r.get("saves"),
        "shares": r.get("share_count") if r.get("share_count") is not None else r.get("shares"),
    }


def _norm_douyin(r: dict) -> dict[str, Any]:
    raw_id = r.get("aweme_id") if r.get("aweme_id") is not None else r.get("id")
    video = r.get("video") if isinstance(r.get("video"), dict) else {}
    stats = r.get("statistics") if isinstance(r.get("statistics"), dict) else {}
    cover = r.get("cover")
    if not cover and isinstance(video.get("cover"), dict):
        url_list = video["cover"].get("url_list")
        if isinstance(url_list, list) and url_list:
            cover = url_list[0]

    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("desc") or r.get("title") or None,
        "body": r.get("desc") or None,
        "publishedAt": str(r["create_time"]) if r.get("create_time") is not None else (str(r["publishedAt"]) if r.get("publishedAt") is not None else None),
        "url": r.get("share_url") or r.get("url") or None,
        "cover": cover or None,
        "views": stats.get("play_count") if stats.get("play_count") is not None else r.get("views"),
        "likes": stats.get("digg_count") if stats.get("digg_count") is not None else (r.get("digg_count") if r.get("digg_count") is not None else r.get("likes")),
        "comments": stats.get("comment_count") if stats.get("comment_count") is not None else (r.get("comment_count") if r.get("comment_count") is not None else r.get("comments")),
        "saves": stats.get("collect_count") if stats.get("collect_count") is not None else (r.get("collect_count") if r.get("collect_count") is not None else r.get("saves")),
        "shares": stats.get("share_count") if stats.get("share_count") is not None else (r.get("share_count") if r.get("share_count") is not None else r.get("shares")),
    }


def _norm_bilibili(r: dict) -> dict[str, Any]:
    bvid = r.get("bvid")
    raw_id = bvid or r.get("aid") or r.get("id")
    stat = r.get("stat") if isinstance(r.get("stat"), dict) else {}
    url = r.get("url") or (f"https://www.bilibili.com/video/{bvid}" if bvid else None)

    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("title") or None,
        "body": r.get("desc") or r.get("dynamic") or None,
        "publishedAt": str(r["pubdate"]) if r.get("pubdate") is not None else (str(r["publishedAt"]) if r.get("publishedAt") is not None else None),
        "url": url,
        "cover": r.get("pic") or r.get("cover") or None,
        "views": stat.get("view") if stat.get("view") is not None else (r.get("view") if r.get("view") is not None else r.get("views")),
        "likes": stat.get("like") if stat.get("like") is not None else (r.get("like") if r.get("like") is not None else r.get("likes")),
        "comments": stat.get("reply") if stat.get("reply") is not None else (r.get("reply") if r.get("reply") is not None else r.get("comments")),
        "saves": stat.get("favorite") if stat.get("favorite") is not None else (r.get("favorite") if r.get("favorite") is not None else r.get("saves")),
        "shares": stat.get("share") if stat.get("share") is not None else (r.get("share") if r.get("share") is not None else r.get("shares")),
    }


def _norm_tiktok(r: dict) -> dict[str, Any]:
    raw_id = r.get("id") if r.get("id") is not None else r.get("video_id")
    stats = r.get("stats") if isinstance(r.get("stats"), dict) else {}

    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("desc") or r.get("title") or None,
        "body": r.get("desc") or None,
        "publishedAt": str(r["createTime"]) if r.get("createTime") is not None else (str(r["create_time"]) if r.get("create_time") is not None else (str(r["publishedAt"]) if r.get("publishedAt") is not None else None)),
        "url": r.get("url") or r.get("share_url") or None,
        "cover": r.get("cover") or r.get("cover_url") or None,
        "views": stats.get("playCount") if stats.get("playCount") is not None else (r.get("playCount") if r.get("playCount") is not None else r.get("views")),
        "likes": stats.get("diggCount") if stats.get("diggCount") is not None else (r.get("diggCount") if r.get("diggCount") is not None else r.get("likes")),
        "comments": stats.get("commentCount") if stats.get("commentCount") is not None else (r.get("commentCount") if r.get("commentCount") is not None else r.get("comments")),
        "saves": stats.get("collectCount") if stats.get("collectCount") is not None else (r.get("collectCount") if r.get("collectCount") is not None else r.get("saves")),
        "shares": stats.get("shareCount") if stats.get("shareCount") is not None else (r.get("shareCount") if r.get("shareCount") is not None else r.get("shares")),
    }


def _norm_instagram(r: dict) -> dict[str, Any]:
    code = r.get("code")
    raw_id = r.get("id") if r.get("id") is not None else (r.get("pk") if r.get("pk") is not None else code)
    caption = r.get("caption")
    caption_text = caption.get("text") if isinstance(caption, dict) else (caption if isinstance(caption, str) else None)

    imgs = r.get("image_versions2") if isinstance(r.get("image_versions2"), dict) else {}
    candidates = imgs.get("candidates") if isinstance(imgs.get("candidates"), list) and imgs.get("candidates") else [{}]
    cover = candidates[0].get("url") if isinstance(candidates[0], dict) else None
    if not cover:
        cover = r.get("cover") or r.get("thumbnail_url")
    url = r.get("url") or (f"https://www.instagram.com/p/{code}/" if code else None)

    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": caption_text or r.get("title") or None,
        "body": caption_text or None,
        "publishedAt": str(r["taken_at"]) if r.get("taken_at") is not None else (str(r["publishedAt"]) if r.get("publishedAt") is not None else None),
        "url": url,
        "cover": cover or None,
        "views": r.get("view_count") if r.get("view_count") is not None else (r.get("play_count") if r.get("play_count") is not None else r.get("views")),
        "likes": r.get("like_count") if r.get("like_count") is not None else r.get("likes"),
        "comments": r.get("comment_count") if r.get("comment_count") is not None else r.get("comments"),
        "saves": r.get("save_count") if r.get("save_count") is not None else r.get("saves"),
        "shares": r.get("share_count") if r.get("share_count") is not None else r.get("shares"),
    }


def _norm_x(r: dict) -> dict[str, Any]:
    raw_id = r.get("id") if r.get("id") is not None else r.get("id_str")
    tid = str(raw_id) if raw_id is not None else None
    text = r.get("text") or r.get("full_text") or None
    title = text[:80] if text else None

    entities = r.get("entities") if isinstance(r.get("entities"), dict) else {}
    media_list = entities.get("media") if isinstance(entities.get("media"), list) and entities.get("media") else [{}]
    media_cover = media_list[0].get("media_url_https") if isinstance(media_list[0], dict) else None
    cover = media_cover or r.get("cover") or None
    metrics = r.get("public_metrics") if isinstance(r.get("public_metrics"), dict) else {}

    return {
        "id": tid,
        "title": title,
        "body": text,
        "publishedAt": str(r["created_at"]) if r.get("created_at") is not None else (str(r["publishedAt"]) if r.get("publishedAt") is not None else None),
        "url": r.get("url") or (f"https://x.com/i/web/status/{tid}" if tid else None),
        "cover": cover,
        "views": metrics.get("impression_count") if metrics.get("impression_count") is not None else r.get("views"),
        "likes": metrics.get("like_count") if metrics.get("like_count") is not None else (r.get("favorite_count") if r.get("favorite_count") is not None else r.get("likes")),
        "comments": metrics.get("reply_count") if metrics.get("reply_count") is not None else (r.get("reply_count") if r.get("reply_count") is not None else r.get("comments")),
        "saves": metrics.get("bookmark_count") if metrics.get("bookmark_count") is not None else (r.get("bookmark_count") if r.get("bookmark_count") is not None else r.get("saves")),
        "shares": metrics.get("retweet_count") if metrics.get("retweet_count") is not None else (r.get("retweet_count") if r.get("retweet_count") is not None else r.get("shares")),
    }


def _norm_youtube(r: dict) -> dict[str, Any]:
    raw_id = r.get("id") or r.get("videoId")
    snippet = r.get("snippet") if isinstance(r.get("snippet"), dict) else {}
    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("title") or snippet.get("title") or None,
        "body": r.get("description") or r.get("desc") or snippet.get("description") or None,
        "publishedAt": str(r.get("publishedAt") or snippet.get("publishedAt") or "") or None,
        "url": r.get("url") or (f"https://www.youtube.com/watch?v={raw_id}" if raw_id else None),
        "cover": r.get("thumbnail") or r.get("cover") or None,
        "views": r.get("views") or r.get("viewCount"),
        "likes": r.get("likes") or r.get("likeCount"),
        "comments": r.get("comments") or r.get("commentCount"),
        "saves": r.get("saves"),
        "shares": r.get("shares"),
    }


def _norm_linkedin(r: dict) -> dict[str, Any]:
    raw_id = r.get("id") or r.get("urn")
    text = r.get("text") or r.get("commentary") or ""
    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("title") or (text[:80] if text else None),
        "body": text or None,
        "publishedAt": str(r.get("publishedAt") or r.get("createdAt") or "") or None,
        "url": r.get("url") or (f"https://www.linkedin.com/feed/update/{raw_id}" if raw_id else None),
        "cover": r.get("cover") or r.get("mediaUrl") or None,
        "views": r.get("views") or r.get("impressions"),
        "likes": r.get("likes") or r.get("reactions"),
        "comments": r.get("comments"),
        "saves": r.get("saves"),
        "shares": r.get("shares") or r.get("reposts"),
    }


def _norm_substack(r: dict) -> dict[str, Any]:
    raw_id = r.get("id") or r.get("slug")
    return {
        "id": str(raw_id) if raw_id is not None else None,
        "title": r.get("title") or None,
        "body": r.get("subtitle") or r.get("body") or None,
        "publishedAt": str(r.get("post_date") or r.get("publishedAt") or "") or None,
        "url": r.get("canonical_url") or r.get("url"),
        "cover": r.get("cover_image") or r.get("cover") or None,
        "views": r.get("views"),
        "likes": r.get("likes") or r.get("reactions"),
        "comments": r.get("comments") or r.get("comment_count"),
        "saves": r.get("saves"),
        "shares": r.get("shares"),
    }


PLATFORM_NORMALIZERS: dict[str, Callable[[dict], dict[str, Any]]] = {
    "X": _norm_x,
    "YouTube": _norm_youtube,
    "LinkedIn": _norm_linkedin,
    "Substack": _norm_substack,
    "TikTok": _norm_tiktok,
    "Instagram": _norm_instagram,
    "Xiaohongshu": _norm_xiaohongshu,
    "Douyin": _norm_douyin,
    "Bilibili": _norm_bilibili,
}


def normalize_post(platform: str, raw: dict) -> dict[str, Any]:
    """Map platform-specific raw dict to common schema. Missing fields -> None."""
    normalizer = PLATFORM_NORMALIZERS.get(platform)
    if not normalizer:
        # Fallback to direct key extraction
        record = {k: raw.get(k) for k in COMMON_SCHEMA_KEYS}
        return record
    res = normalizer(raw)
    # Ensure all common schema keys are present and missing/None are explicitly None
    return {k: res.get(k) for k in COMMON_SCHEMA_KEYS}


# ---------------------------------------------------------------------------
# Short-Link Resolver & URL Validation (Requirements 13.12, 13.13)
# ---------------------------------------------------------------------------

def is_short_link(url: str) -> bool:
    """Return True if the URL's hostname matches a supported short-link domain."""
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
        return any(host == d or host.endswith(f".{d}") for d in SHORT_LINK_DOMAINS)
    except Exception:
        return False


async def resolve_shortlink(
    url: str,
    *,
    timeout: float = 5.0,
    max_redirects: int = 4,
) -> str:
    """Follow redirects up to 4 hops with per-hop SSRF validation.

    Raises HTTPException(400) if any hop fails SSRF check or if redirects exceed 4.
    """
    if not isinstance(url, str) or not url.strip():
        raise HTTPException(400, detail="URL must be a non-empty string")

    current_url = url.strip()
    parts = urlsplit(current_url)
    if parts.scheme not in ("http", "https"):
        raise HTTPException(400, detail="URL must use http or https scheme")

    validate_target_host(parts.hostname or "")

    if not is_short_link(current_url):
        return current_url

    hops = 0
    while hops < max_redirects:
        hops += 1
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                resp = await client.head(current_url)
                if resp.status_code in (301, 302, 303, 307, 308) and "location" in resp.headers:
                    next_url = urljoin(current_url, resp.headers["location"])
                else:
                    # Some shorteners require GET
                    resp = await client.get(current_url)
                    if resp.status_code in (301, 302, 303, 307, 308) and "location" in resp.headers:
                        next_url = urljoin(current_url, resp.headers["location"])
                    else:
                        # Not a redirect, finished
                        return current_url
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(400, detail=f"Failed to follow short link redirect: {exc}")

        next_parts = urlsplit(next_url)
        if next_parts.scheme not in ("http", "https"):
            raise HTTPException(400, detail=f"Redirected to unsupported scheme: {next_url}")

        # Validate next hop host for SSRF
        validate_target_host(next_parts.hostname or "")
        current_url = next_url

        if not is_short_link(current_url):
            return current_url

    if is_short_link(current_url):
        raise HTTPException(400, detail="Redirect limit exceeded while resolving short link")

    return current_url


def validate_platform_url(url: str, platform: str | None = None) -> tuple[str, str]:
    """Validate that the URL belongs to a supported platform and uses HTTP/HTTPS.

    Returns:
        (detected_platform, url)

    Raises:
        HTTPException(400): If URL is not valid HTTP/HTTPS or platform is unsupported.
    """
    if not isinstance(url, str) or not url.strip():
        raise HTTPException(400, detail="Account URL must be a non-empty string")

    clean_url = url.strip()
    try:
        parts = urlsplit(clean_url)
    except Exception:
        raise HTTPException(400, detail="Invalid URL format")

    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise HTTPException(400, detail="Account URL must be a valid HTTP or HTTPS URL")

    hostname = parts.hostname.lower()

    detected_platform: str | None = None
    for p_name, domains in PLATFORM_DOMAIN_PATTERNS.items():
        if any(hostname == d or hostname.endswith(f".{d}") for d in domains):
            detected_platform = p_name
            break

    if not detected_platform:
        raise HTTPException(
            400,
            detail=f"URL '{clean_url}' is not a recognized URL for any supported platform ({', '.join(sorted(SUPPORTED_PLATFORMS))})",
        )

    if platform and platform in SUPPORTED_PLATFORMS and platform != detected_platform:
        # Check if platform was explicitly provided and differs
        raise HTTPException(
            400,
            detail=f"URL '{clean_url}' belongs to {detected_platform}, but requested platform is {platform}",
        )

    return detected_platform, clean_url


# ---------------------------------------------------------------------------
# MonidRunner (Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8, 13.9, 13.10, 13.11, 13.14)
# ---------------------------------------------------------------------------

class MonidRunner:
    """Manages CLI discovery, account balance querying, and post importing."""

    def __init__(self) -> None:
        self._exe_cmd: list[str] | None = None
        self._import_running: bool = False
        self._lock = asyncio.Lock()

    def _resolve_windows_cmd_shim(self, cmd_path: str) -> list[str] | None:
        """Parse a Windows .cmd shim to find the underlying Node.js entry file."""
        try:
            p = Path(cmd_path)
            content = p.read_text(encoding="utf-8", errors="ignore")
            # Look for: "%~dp0\node_modules\..." or "%dp0%\..." pointing to a .js file
            matches = re.findall(r'["\']?([^"\']+\.js)["\']?', content)
            cmd_dir = p.parent
            for match in matches:
                # Replace %~dp0 or %dp0% with the directory
                resolved_match = match.replace("%~dp0", str(cmd_dir) + "\\").replace("%dp0%", str(cmd_dir) + "\\")
                js_candidate = Path(resolved_match)
                if not js_candidate.is_absolute():
                    js_candidate = cmd_dir / js_candidate
                if js_candidate.is_file():
                    node_exe = shutil.which("node") or "node"
                    return [node_exe, str(js_candidate.resolve())]
        except Exception as exc:
            logger.debug("Failed to resolve Windows .cmd shim '%s': %s", cmd_path, exc)
        return None

    async def find_exe(self) -> list[str] | None:
        """Locate the Monid CLI executable or Node entry script.

        Searches:
        1. PATH
        2. Common install directories
        3. Login shell query
        4. Windows .cmd shim resolution to Node.js entry file
        """
        if self._exe_cmd:
            return self._exe_cmd

        # 1. Search PATH
        exe_path = shutil.which("monid")
        if exe_path:
            if sys.platform == "win32" and exe_path.lower().endswith((".cmd", ".bat")):
                shim_cmd = self._resolve_windows_cmd_shim(exe_path)
                if shim_cmd:
                    self._exe_cmd = shim_cmd
                    return self._exe_cmd
            self._exe_cmd = [exe_path]
            return self._exe_cmd

        # 2. Search common install paths
        for dir_template in SEARCH_PATHS:
            expanded = Path(os.path.expanduser(dir_template))
            for cand in ["monid", "monid.cmd", "monid.exe", "monid.bat"]:
                cand_path = expanded / cand
                if cand_path.is_file():
                    cand_str = str(cand_path)
                    if sys.platform == "win32" and cand_str.lower().endswith((".cmd", ".bat")):
                        shim_cmd = self._resolve_windows_cmd_shim(cand_str)
                        if shim_cmd:
                            self._exe_cmd = shim_cmd
                            return self._exe_cmd
                    self._exe_cmd = [cand_str]
                    return self._exe_cmd

        # 3. Query login shell
        try:
            if sys.platform == "win32":
                proc = await asyncio.create_subprocess_exec(
                    "where",
                    "monid",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            else:
                proc = await asyncio.create_subprocess_exec(
                    "sh",
                    "-l",
                    "-c",
                    "which monid",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            if proc.returncode == 0 and stdout:
                found_path = stdout.decode().strip().splitlines()[0].strip()
                if found_path and os.path.exists(found_path):
                    if sys.platform == "win32" and found_path.lower().endswith((".cmd", ".bat")):
                        shim_cmd = self._resolve_windows_cmd_shim(found_path)
                        if shim_cmd:
                            self._exe_cmd = shim_cmd
                            return self._exe_cmd
                    self._exe_cmd = [found_path]
                    return self._exe_cmd
        except Exception:
            pass

        return None

    async def balance(self) -> dict[str, Any]:
        """Run: monid balance -j -> parse JSON -> return status dict.

        Returns one of:
        - { state: "missing" }
        - { state: "nokey" }
        - { state: "error", message: str }
        - { state: "ready", balance?: Any }
        """
        cmd_prefix = await self.find_exe()
        if not cmd_prefix:
            return {"state": "missing"}

        full_cmd = list(cmd_prefix) + ["balance", "-j"]
        env = dict(os.environ)
        if cmd_prefix[0] == "node" or cmd_prefix[0].lower().endswith("node.exe"):
            env["ELECTRON_RUN_AS_NODE"] = "1"

        try:
            proc = await asyncio.create_subprocess_exec(
                *full_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=15.0)
        except Exception as exc:
            return {"state": "error", "message": f"Failed to execute monid balance: {exc}"}

        out_str = stdout_bytes.decode(errors="replace").strip()
        err_str = stderr_bytes.decode(errors="replace").strip()

        if proc.returncode != 0:
            combined = (err_str or out_str).lower()
            if any(k in combined for k in ["no key", "nokey", "api key", "not configured", "missing key", "unauthorized"]):
                return {"state": "nokey"}
            return {"state": "error", "message": err_str or out_str or f"Process exited with code {proc.returncode}"}

        try:
            data = json.loads(out_str)
        except Exception:
            return {"state": "error", "message": f"Invalid JSON output from monid balance: {out_str}"}

        if not isinstance(data, dict):
            return {"state": "ready", "balance": data}

        st = data.get("state")
        if st in ("missing", "nokey"):
            return {"state": st}
        if st == "error":
            return {"state": "error", "message": data.get("message", "Unknown error")}

        # Check for nokey indicators
        if data.get("nokey") or data.get("apiKey") is None and data.get("balance") is None and "balance" not in data:
            if "nokey" in str(data).lower():
                return {"state": "nokey"}

        result: dict[str, Any] = {"state": "ready"}
        if "balance" in data:
            result["balance"] = data["balance"]
        elif "amount" in data:
            result["balance"] = data["amount"]
        else:
            result["balance"] = data
        return result

    async def _download_covers(
        self,
        posts: list[dict[str, Any]],
        files_dir: Path,
        platform: str,
    ) -> None:
        """Download cover images concurrently (up to 4 workers, 10s per-image timeout)."""
        sem = asyncio.Semaphore(4)

        async def _fetch_one(post: dict[str, Any]) -> None:
            cover_url = post.get("cover")
            if not cover_url or not isinstance(cover_url, str) or not cover_url.startswith("http"):
                return
            post_id = post.get("id") or "post"
            ext = ".jpg"
            if ".png" in cover_url.lower():
                ext = ".png"
            elif ".webp" in cover_url.lower():
                ext = ".webp"
            filename = f"monid_{platform}_{post_id}_cover{ext}"
            target_path = files_dir / filename

            async with sem:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.get(cover_url)
                        if resp.status_code == 200 and resp.content:
                            target_path.write_bytes(resp.content)
                            post["cover"] = f"media-desk/files/{filename}"
                except Exception as exc:
                    logger.debug("Cover download skipped for post %s: %s", post_id, exc)

        tasks = [_fetch_one(p) for p in posts]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def import_posts(
        self,
        platform: str,
        url: str,
        count: int = POST_COUNT,
        ctx: Any = None,
        store: Any = None,
        settings: dict | None = None,
        files_dir: Path | None = None,
        lang: str = "en",
    ) -> dict[str, Any]:
        """Fetch posts from platform via Monid CLI, normalize, upsert, and optionally extract style.

        Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.12, 13.13, 13.14.
        """
        async with self._lock:
            if self._import_running:
                raise HTTPException(409, detail="Import already in progress")
            self._import_running = True

        try:
            return await self._import_posts_impl(
                platform=platform,
                url=url,
                count=count,
                ctx=ctx,
                store=store,
                settings=settings,
                files_dir=files_dir,
                lang=lang,
            )
        finally:
            self._import_running = False

    async def _import_posts_impl(
        self,
        platform: str,
        url: str,
        count: int,
        ctx: Any,
        store: Any,
        settings: dict | None,
        files_dir: Path | None,
        lang: str,
    ) -> dict[str, Any]:
        # 1. Check CLI availability (Requirement 13.14)
        cmd_prefix = await self.find_exe()
        if not cmd_prefix:
            raise HTTPException(503, detail="Monid CLI is unavailable")

        # 2. Validate URL and resolve short links (Requirements 13.12, 13.13)
        resolved_url = await resolve_shortlink(url)
        detected_platform, valid_url = validate_platform_url(resolved_url, platform=platform)
        target_platform = detected_platform or platform

        # 3. Clamp count (Requirement 13.5)
        effective_count = max(1, min(int(count), POST_COUNT))

        # 4. Invoke CLI (Requirement 13.1)
        full_cmd = list(cmd_prefix) + ["fetch", target_platform, valid_url, "--count", str(effective_count), "--json"]
        env = dict(os.environ)
        if cmd_prefix[0] == "node" or cmd_prefix[0].lower().endswith("node.exe"):
            env["ELECTRON_RUN_AS_NODE"] = "1"

        try:
            proc = await asyncio.create_subprocess_exec(
                *full_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=60.0)
        except Exception as exc:
            return {
                "platform": target_platform,
                "nickname": None,
                "count": 0,
                "added": 0,
                "cost": 0,
                "styleName": None,
                "styleError": None,
                "state": "error",
            }

        if proc.returncode != 0:
            err_msg = stderr_bytes.decode(errors="replace").strip() or stdout_bytes.decode(errors="replace").strip()
            logger.warning("Monid fetch failed with code %s: %s", proc.returncode, err_msg)
            return {
                "platform": target_platform,
                "nickname": None,
                "count": 0,
                "added": 0,
                "cost": 0,
                "styleName": None,
                "styleError": None,
                "state": "error",
            }

        try:
            raw_data = json.loads(stdout_bytes.decode(errors="replace").strip())
        except Exception as exc:
            logger.warning("Failed to parse monid fetch JSON: %s", exc)
            return {
                "platform": target_platform,
                "nickname": None,
                "count": 0,
                "added": 0,
                "cost": 0,
                "styleName": None,
                "styleError": None,
                "state": "error",
            }

        raw_posts: list[dict[str, Any]] = []
        nickname: str | None = None
        cost: float | int = 0

        if isinstance(raw_data, list):
            raw_posts = raw_data
        elif isinstance(raw_data, dict):
            raw_posts = raw_data.get("posts") or raw_data.get("items") or raw_data.get("data") or []
            nickname = raw_data.get("nickname") or raw_data.get("author") or raw_data.get("user")
            cost = raw_data.get("cost") or 0

        # Normalize posts (Requirement 13.6)
        normalized_posts = [normalize_post(target_platform, p) for p in raw_posts if isinstance(p, dict)]
        total_count = len(normalized_posts)

        # Download covers concurrently (Requirement 13.8)
        if files_dir:
            files_dir.mkdir(parents=True, exist_ok=True)
            await self._download_covers(normalized_posts, files_dir, target_platform)

        # Upsert into store (Requirement 13.7)
        added_count = 0
        state = await store.get() if store else {}
        items = state.setdefault("items", [])
        metrics = state.setdefault("metrics", [])

        now_iso = datetime.now(timezone.utc).isoformat()

        for post in normalized_posts:
            post_id = post["id"] or f"imported_{uuid_short()}"
            upsert_key = f"{target_platform}:{post_id}"

            existing_item = next((i for i in items if i.get("id") == upsert_key), None)

            if existing_item:
                # Update metrics
                # Preserve title/body if diverged from last-imported value
                last_title = existing_item.get("_lastImportedTitle")
                last_body = existing_item.get("_lastImportedBody")

                if last_title is None or existing_item.get("title") == last_title:
                    existing_item["title"] = post["title"]
                    existing_item["_lastImportedTitle"] = post["title"]

                if last_body is None or existing_item.get("body") == last_body:
                    existing_item["body"] = post["body"]
                    existing_item["_lastImportedBody"] = post["body"]

                if post.get("cover"):
                    existing_item["media"] = {"src": post["cover"]}
                if post.get("url"):
                    existing_item["url"] = post["url"]
                if post.get("publishedAt"):
                    existing_item["publishedAt"] = post["publishedAt"]
            else:
                # Newly added item
                added_count += 1
                new_item = {
                    "id": upsert_key,
                    "title": post["title"] or f"{target_platform} post",
                    "body": post["body"] or "",
                    "kind": "post",
                    "status": "ready",
                    "platform": target_platform,
                    "tags": [],
                    "source": post.get("url"),
                    "media": {"src": post["cover"]} if post.get("cover") else None,
                    "pos": len(items),
                    "parentId": None,
                    "scheduledAt": None,
                    "publishedAt": post.get("publishedAt") or now_iso,
                    "production": None,
                    "drafts": [],
                    "sample": False,
                    "_lastImportedTitle": post["title"],
                    "_lastImportedBody": post["body"],
                }
                items.append(new_item)

            # Update or insert metrics
            metric_entry = next((m for m in metrics if m.get("itemId") == upsert_key), None)
            if metric_entry:
                if post.get("views") is not None:
                    metric_entry["views"] = post["views"]
                if post.get("likes") is not None:
                    metric_entry["likes"] = post["likes"]
                if post.get("comments") is not None:
                    metric_entry["comments"] = post["comments"]
                if post.get("saves") is not None:
                    metric_entry["saves"] = post["saves"]
                if post.get("shares") is not None:
                    metric_entry["shares"] = post["shares"]
            else:
                metrics.append({
                    "id": f"metric_{upsert_key}",
                    "itemId": upsert_key,
                    "date": now_iso[:10],
                    "views": post.get("views") or 0,
                    "likes": post.get("likes") or 0,
                    "comments": post.get("comments") or 0,
                    "saves": post.get("saves") or 0,
                    "shares": post.get("shares") or 0,
                })

        # Save store if available
        if store:
            await store.put(state)

        # Style Extraction (Requirement 13.9)
        style_name: str | None = None
        style_error: str | None = None

        concat_text = " ".join([
            f"{p.get('title') or ''} {p.get('body') or ''}".strip()
            for p in normalized_posts
        ]).strip()

        if len(concat_text) >= 80 and ctx and hasattr(ctx, "llm"):
            try:
                from dashboard.style import style_extract
                acc_key = f"{target_platform}:{nickname or valid_url}"
                card = await style_extract(
                    ctx=ctx,
                    urls=[],
                    text=concat_text,
                    account_key=acc_key,
                    lang=lang,
                    state=state,
                )
                style_name = card.get("name")
                if store:
                    await store.put(state)
            except Exception as exc:
                style_error = str(exc)

        # Final state determination (Requirement 13.10)
        final_state = "done"
        if total_count == 0:
            final_state = "error"
        elif style_error:
            final_state = "partial"

        return {
            "platform": target_platform,
            "nickname": nickname,
            "count": total_count,
            "added": added_count,
            "cost": cost,
            "styleName": style_name,
            "styleError": style_error,
            "state": final_state,
        }


def uuid_short() -> str:
    import uuid
    return uuid.uuid4().hex[:8]
