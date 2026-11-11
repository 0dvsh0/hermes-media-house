"""
images.py — Image generation (HTTP and Tool provider modes) for hermes-media-desk.

Implements:
- ImageGenerator: generate() dispatching to _generate_via_http or _generate_via_tool.
- Magic byte validation for PNG, JPEG, WebP, GIF.
- HTTP 429 backoff retry logic ([6s, 14s]) with 300s timeout.
- Relative URL 3-candidate resolution (prefix-stripped, mount-prefixed, site-root).
- Same-origin authorization forwarding and cross-origin SSRF checks.

Requirements: 8.1–8.11
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlsplit

from fastapi import HTTPException
import httpx

from dashboard.harvest import ssrf_check

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_IMAGE_SIZE = 40_000_000  # 40 MB
HTTP_TIMEOUT_SECONDS = 300.0
RETRY_DELAYS = [6.0, 14.0]

TEST_IMAGE_PROMPT = (
    "A single paper boat on calm water, black and white pencil line art sketch, "
    "plain white paper background, no text."
)

MAGIC_BYTES = {
    b"\x89PNG": "png",
    b"\xff\xd8": "jpg",
    b"GIF8": "gif",
}


def _validate_image(data: bytes) -> str:
    """Validate image bytes for size limit and recognized magic byte headers.

    Recognized formats:
    - PNG: starts with \\x89PNG
    - JPEG: starts with \\xff\\xd8
    - WebP: starts with RIFF and has WEBP at bytes 8:12
    - GIF: starts with GIF8

    Returns:
        Extension string ("png", "jpg", "webp", "gif").

    Raises:
        ValueError if data exceeds size limit or format is not recognized.
    """
    if not isinstance(data, (bytes, bytearray)):
        raise ValueError("Image data must be bytes")

    if len(data) > MAX_IMAGE_SIZE:
        raise ValueError(f"Image size ({len(data)} bytes) exceeds limit of {MAX_IMAGE_SIZE} bytes")

    if len(data) < 2:
        raise ValueError("Image data too short to identify format")

    # JPEG check (2-byte magic \xff\xd8)
    if data.startswith(b"\xff\xd8"):
        return "jpg"

    # Formats needing at least 4 bytes
    if len(data) < 4:
        raise ValueError("Image data too short to identify format")

    # PNG check
    if data.startswith(b"\x89PNG"):
        return "png"

    # GIF check
    if data.startswith(b"GIF8"):
        return "gif"

    # WebP check: starts with RIFF, bytes 8:12 are WEBP
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return "webp"

    raise ValueError("Unsupported image format: magic bytes did not match PNG, JPEG, WebP, or GIF")


# ---------------------------------------------------------------------------
# ImageGenerator
# ---------------------------------------------------------------------------

class ImageGenerator:
    """Handles image generation via OpenAI-compatible HTTP endpoints or Hermes tool providers."""

    def __init__(self, files_dir: Path | None = None) -> None:
        self.files_dir = files_dir
        self._tool_provider: Any = None

    def register_tool_provider(self, provider: Any) -> None:
        """Register an image generation tool provider callback or object."""
        self._tool_provider = provider

    async def generate(self, prompt: str, settings: dict, ctx: Any = None, **kwargs: Any) -> bytes:
        """Generate image bytes from prompt according to settings.

        Args:
            prompt: Text prompt describing the target image.
            settings: Dictionary with settings["image"] configuration.
            ctx: Optional Hermes context with registered image gen provider.

        Returns:
            Validated image bytes.
        """
        image_cfg = settings.get("image", {}) if isinstance(settings, dict) else {}
        source = image_cfg.get("source", "http")

        if source == "tool":
            return await self._generate_via_tool(prompt, settings, ctx)
        return await self._generate_via_http(prompt, settings)

    def _validate_image(self, data: bytes) -> str:
        """Instance method proxying _validate_image."""
        return _validate_image(data)

    async def _generate_via_tool(self, prompt: str, settings: dict, ctx: Any = None) -> bytes:
        """Delegate generation to registered Hermes provider."""
        provider = self._tool_provider
        if provider is None and ctx is not None:
            # Check for provider on ctx if available
            provider = getattr(ctx, "image_gen_provider", None)
            if provider is None and hasattr(ctx, "get_image_gen_provider"):
                try:
                    provider = ctx.get_image_gen_provider()
                except Exception:
                    provider = None

        if provider is None:
            raise RuntimeError("No image generation provider is available")

        # Invoke provider
        if hasattr(provider, "generate"):
            result = await provider.generate(prompt=prompt, settings=settings)
        elif callable(provider):
            res = provider(prompt=prompt, settings=settings)
            result = await res if asyncio.iscoroutine(res) else res
        else:
            raise RuntimeError("Registered image provider is not callable")

        if not isinstance(result, bytes):
            raise RuntimeError("Tool provider returned non-bytes result")

        self._validate_image(result)
        return result

    async def _generate_via_http(self, prompt: str, settings: dict) -> bytes:
        """Call {baseUrl}/images/generations with backoff retry and URL resolution."""
        image_cfg = settings.get("image", {})
        base_url = (image_cfg.get("baseUrl") or "").strip().rstrip("/")
        model = (image_cfg.get("model") or "").strip()
        api_key = (image_cfg.get("apiKey") or "").strip()

        if not base_url or not model or not api_key:
            raise HTTPException(400, detail="Image configuration missing baseUrl, model, or apiKey")

        endpoint = f"{base_url}/images/generations"
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "n": 1,
        }

        if image_cfg.get("size"):
            payload["size"] = image_cfg["size"]
        if image_cfg.get("quality"):
            payload["quality"] = image_cfg["quality"]

        extra = image_cfg.get("extra")
        if extra:
            if isinstance(extra, str) and extra.strip():
                try:
                    extra_data = json.loads(extra)
                    if isinstance(extra_data, dict):
                        payload.update(extra_data)
                except Exception:
                    pass
            elif isinstance(extra, dict):
                payload.update(extra)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Backoff retry loop for HTTP 429
        attempt = 0
        while True:
            attempt += 1
            try:
                async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
            except httpx.TimeoutException:
                raise HTTPException(400, detail=f"Image generation request timed out after {HTTP_TIMEOUT_SECONDS}s")
            except httpx.RequestError as exc:
                raise HTTPException(400, detail=f"Image generation connection error: {exc}")

            # HTTP 429 handling with max 2 retries (total 3 attempts)
            if resp.status_code == 429:
                if attempt <= len(RETRY_DELAYS):
                    delay = RETRY_DELAYS[attempt - 1]
                    logger.warning("Image API 429 rate limited; retrying in %s seconds (attempt %s)", delay, attempt)
                    await asyncio.sleep(delay)
                    continue
                raise HTTPException(429, detail="Image generation rate limit exceeded after 2 retries")

            # Permanent errors: no retry
            if resp.status_code in (401, 403, 404):
                raise HTTPException(resp.status_code, detail=f"Image API authentication/client error: {resp.text}")

            if resp.status_code >= 400:
                raise HTTPException(resp.status_code, detail=f"Image API HTTP error {resp.status_code}: {resp.text}")

            break

        # Parse response
        try:
            data = resp.json()
        except Exception as exc:
            raise HTTPException(400, detail=f"Invalid JSON response from image API: {exc}")

        image_bytes: bytes | None = None

        if isinstance(data.get("data"), list) and len(data["data"]) > 0:
            first = data["data"][0]
            if isinstance(first, dict):
                if first.get("b64_json"):
                    try:
                        image_bytes = base64.b64decode(first["b64_json"])
                    except Exception as exc:
                        raise HTTPException(400, detail=f"Failed to decode b64_json image: {exc}")
                elif first.get("url"):
                    image_bytes = await self._download_image(first["url"], base_url, api_key)
        elif isinstance(data.get("images"), list) and len(data["images"]) > 0:
            first = data["images"][0]
            if isinstance(first, dict) and first.get("url"):
                image_bytes = await self._download_image(first["url"], base_url, api_key)
            elif isinstance(first, str):
                image_bytes = await self._download_image(first, base_url, api_key)

        if not image_bytes:
            raise HTTPException(400, detail="Image response missing valid b64_json or url field")

        try:
            self._validate_image(image_bytes)
        except ValueError as exc:
            raise HTTPException(400, detail=str(exc))

        return image_bytes

    async def _resolve_relative_url(self, url: str, base_url: str) -> list[str]:
        """Generate 3 candidate URLs in order for relative image URLs:
        1. Prefix-stripped: strip /v1 from base_url
        2. Mount-path-prefixed: baseUrl + url
        3. Site-root-prefixed: scheme://netloc/ + url
        """
        if url.startswith(("http://", "https://")):
            return [url]

        clean_path = url.lstrip("/")
        parsed_base = urlsplit(base_url)

        # 1. Prefix-stripped variant (removes /v1 from base URL path)
        base_without_v1 = re.sub(r"/v1/?$", "", base_url).rstrip("/")
        cand1 = f"{base_without_v1}/{clean_path}"

        # 2. Mount-path-prefixed variant
        cand2 = f"{base_url.rstrip('/')}/{clean_path}"

        # 3. Site-root-prefixed variant
        cand3 = f"{parsed_base.scheme}://{parsed_base.netloc}/{clean_path}"

        return [cand1, cand2, cand3]

    async def _download_image(self, url: str, base_url: str, api_key: str) -> bytes:
        """Download image with same-origin header forwarding or cross-origin SSRF check."""
        candidates = await self._resolve_relative_url(url, base_url)
        parsed_base = urlsplit(base_url)

        for candidate in candidates:
            try:
                parsed_cand = urlsplit(candidate)
                same_origin = (
                    parsed_cand.scheme.lower() == parsed_base.scheme.lower()
                    and parsed_cand.netloc.lower() == parsed_base.netloc.lower()
                )

                if same_origin:
                    headers = {"Authorization": f"Bearer {api_key}"}
                    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
                        resp = await client.get(candidate, headers=headers)
                        if resp.status_code == 200:
                            return resp.content
                else:
                    # Cross-origin: ssrf_check validates safety and downloads
                    content = await ssrf_check(candidate, max_size=MAX_IMAGE_SIZE, timeout=HTTP_TIMEOUT_SECONDS)
                    return content
            except Exception as exc:
                logger.debug("Candidate download failed for %s: %s", candidate, exc)
                continue

        raise HTTPException(400, detail=f"Image URL could not be resolved or downloaded: '{url}'")

    def save_image(self, data: bytes, target_dir: Path | None = None, filename: str | None = None) -> Path:
        """Validate format and save image bytes to disk."""
        ext = self._validate_image(data)
        out_dir = target_dir or self.files_dir
        if out_dir is None:
            raise ValueError("No directory configured to save image")

        out_dir.mkdir(parents=True, exist_ok=True)
        if not filename:
            import uuid
            filename = f"img_{uuid.uuid4().hex[:16]}.{ext}"

        file_path = out_dir / filename
        file_path.write_bytes(data)
        return file_path
