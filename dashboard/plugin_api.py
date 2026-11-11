"""FastAPI route definitions and controller endpoints for hermes-media-desk.

Provides:
- 4 MB body limit for POST routes, 250 MB for file uploads.
- Asset and file serving: binary streaming with Range support, plus a JSON
  ``/asset`` endpoint returning base64 data URLs for authenticated desktop
  clients that cannot attach credentials to ``<img>`` requests.
- State management, ops queue execution, 3-way undo, produce pipeline control,
  export, and Monid import.
- Event broadcasting for UI reactivity.

Requirements: 1.4-1.6, 7.13, 9.1-9.12, 10.1-10.12, 11.4-11.6, 11.10, 20.1, 20.4, 21.1, 22.5
"""

from __future__ import annotations

import asyncio
import base64
import copy
from datetime import datetime, timezone
import json
import logging
import mimetypes
import os
from pathlib import Path
import re
import shutil
import sys
from typing import Any, Callable
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.routing import APIRoute

# ---------------------------------------------------------------------------
# Import bootstrap: the Hermes web server mounts this file directly by path
# (see manifest.json "api"), so the repository root is not on sys.path in that
# process. Without this, `from dashboard import ...` fails on first import.
# ---------------------------------------------------------------------------
_PLUGIN_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_PLUGIN_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_PLUGIN_REPO_ROOT))

from dashboard import ai
from dashboard.export import reveal_production, save_production
from dashboard.harvest import capture_url
from dashboard.images import TEST_IMAGE_PROMPT, ImageGenerator
from dashboard.monid import MonidRunner
from dashboard.ops import apply_ops
from dashboard.produce import ProductionPipeline
from dashboard.settings import SettingsManager
from dashboard.store import StoreManager
from dashboard.style import skills_export, skills_learn, style_extract
from dashboard.undo import UndoStack

logger = logging.getLogger("hermes_media_desk.api")

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------

MAX_JSON_BODY_BYTES = 4_000_000        # 4 MB (Requirement 9.4)
MAX_UPLOAD_BYTES = 250_000_000         # 250 MB (Requirement 9.5)

ALLOWED_UPLOAD_TYPES = {
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
}

_env_data_dir = os.getenv("MEDIA_DESK_DATA_DIR")
if _env_data_dir:
    DATA_DIR = Path(_env_data_dir)
else:
    try:
        from dashboard.store import plugin_data_dir
        DATA_DIR = plugin_data_dir("hermes-media-desk")
    except Exception:
        DATA_DIR = Path("data")
FILES_DIR = DATA_DIR / "files"
FILES_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Global Singletons
# ---------------------------------------------------------------------------

store = StoreManager()
settings_mgr = SettingsManager()
undo_stack = UndoStack()
image_gen = ImageGenerator()
monid_runner = MonidRunner()
pipeline = ProductionPipeline(store=store, image_gen=image_gen, files_dir=FILES_DIR)

ctx: Any = None
_has_settled_on_startup = False


def init_plugin(context: Any, data_dir: Path | None = None) -> None:
    """Initialize plugin runtime context and optional custom data directory."""
    global ctx, store, settings_mgr, pipeline, FILES_DIR, DATA_DIR
    ctx = context
    if data_dir is not None:
        DATA_DIR = Path(data_dir)
        FILES_DIR = DATA_DIR / "files"
        FILES_DIR.mkdir(parents=True, exist_ok=True)
        store._path = DATA_DIR / "state.json"
        settings_mgr._path = DATA_DIR / "settings.json"
        pipeline.store = store
        pipeline.files_dir = FILES_DIR
    pipeline.ctx = ctx


# ---------------------------------------------------------------------------
# Event Broadcasting (Requirement 20.1, 20.4)
# ---------------------------------------------------------------------------

os.environ.setdefault("HERMES_DISABLE_LAZY_INSTALLS", "1")

async def broadcast_plugin_event(plugin_id: str, event_name: str, payload: dict[str, Any]) -> None:
    """Broadcast an event to connected Hermes Desktop clients.

    Prefers Hermes' sanctioned plugin event channel
    (``hermes_cli.plugin_events.broadcast_plugin_event``), which emits on the
    wire name ``plugin.<id>.<event>`` — the exact shape the desktop plugin
    context subscribes to via ``ctx.onEvent``.
    """
    if "pytest" in sys.modules:
        if pipeline.broadcaster:
            try:
                res = pipeline.broadcaster(event_name, payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                pass
        return

    try:
        from hermes_cli.plugin_events import broadcast_plugin_event as hermes_broadcast

        res = hermes_broadcast(plugin_id, event_name, payload)
        if asyncio.iscoroutine(res):
            await res
        return
    except (Exception, SystemExit) as exc:
        logger.debug("Hermes plugin event bridge failed: %s", exc)

    # Fallbacks for processes without the Hermes runtime (standalone runs/tests).
    if pipeline.broadcaster:
        try:
            res = pipeline.broadcaster(event_name, payload)
            if asyncio.iscoroutine(res):
                await res
        except (Exception, SystemExit) as exc:
            logger.debug("Broadcaster callback failed: %s", exc)
    elif ctx and hasattr(ctx, "broadcast_event"):
        try:
            res = ctx.broadcast_event(plugin_id, event_name, payload)
            if asyncio.iscoroutine(res):
                await res
        except (Exception, SystemExit) as exc:
            logger.debug("Context broadcast failed: %s", exc)


pipeline.broadcaster = lambda ev, pl: broadcast_plugin_event("hermes-media-desk", ev, pl)


# ---------------------------------------------------------------------------
# Custom Route Handler for Error Formatting & No-Store Headers (Requirement 9.11, 9.12)
# ---------------------------------------------------------------------------

class ErrorHandlingRoute(APIRoute):
    """Wraps route handlers to:
    1. Sanitize unhandled exceptions to HTTP 500 without stack traces or internal paths.
    2. Format HTTPException as {"error": exc.detail}.
    3. Enforce Cache-Control: no-store on all JSON responses.
    """
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            try:
                # Check body size limit before reading full body
                content_length = request.headers.get("content-length")
                is_upload = request.url.path.rstrip("/").endswith("/upload")

                if content_length is not None:
                    try:
                        cl_int = int(content_length)
                        if is_upload and cl_int > MAX_UPLOAD_BYTES:
                            raise HTTPException(413, detail="Upload exceeds 250MB limit")
                        if not is_upload and request.method == "POST" and cl_int > MAX_JSON_BODY_BYTES:
                            raise HTTPException(413, detail="Request body too large")
                    except ValueError:
                        pass

                response: Response = await original_route_handler(request)
            except HTTPException as exc:
                resp = JSONResponse({"error": exc.detail}, status_code=exc.status_code)
                resp.headers["Cache-Control"] = "no-store"
                return resp
            except Exception as exc:
                logger.exception("Unhandled exception handling %s %s: %s", request.method, request.url.path, exc)
                resp = JSONResponse({"error": "Internal server error"}, status_code=500)
                resp.headers["Cache-Control"] = "no-store"
                return resp

            # Inject Cache-Control: no-store for JSON responses if not set
            if "cache-control" not in response.headers:
                ctype = response.headers.get("content-type", "")
                if "application/json" in ctype or isinstance(response, JSONResponse):
                    response.headers["Cache-Control"] = "no-store"

            return response

        return custom_route_handler


router = APIRouter(route_class=ErrorHandlingRoute)


# ---------------------------------------------------------------------------
# Security Dependency: Sec-Fetch-Site (Requirement 9.3)
# ---------------------------------------------------------------------------

async def check_origin(request: Request) -> None:
    """Security check enforcing Sec-Fetch-Site (Requirement 9.3).
    Only rejects cross-site browser requests. Requests without Sec-Fetch-Site
    (e.g. from Hermes Electron desktop IPC, curl, local agents) or with
    'same-origin' / 'none' are permitted.
    """
    site = request.headers.get("sec-fetch-site")
    if site and site.lower() not in ("same-origin", "none"):
        raise HTTPException(status_code=403, detail="Forbidden")


async def parse_json_body(request: Request) -> dict[str, Any]:
    """Parse JSON body enforcing MAX_JSON_BODY_BYTES.
    Handles both direct JSON objects and double-encoded JSON strings from Electron IPC.
    """
    body_bytes = await request.body()
    if len(body_bytes) > MAX_JSON_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Request body too large")
    if not body_bytes:
        return {}
    try:
        data = json.loads(body_bytes)
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                pass
        return data if isinstance(data, dict) else {}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")


# ---------------------------------------------------------------------------
# GET Routes (Requirement 9.1)
# ---------------------------------------------------------------------------

@router.get("/state")
async def get_state() -> JSONResponse:
    """Return full workbench state. Triggers settle_all on first startup call."""
    global _has_settled_on_startup
    if not _has_settled_on_startup:
        _has_settled_on_startup = True
        await pipeline.settle_all()

    state = await store.get()
    return JSONResponse(state, headers={"Cache-Control": "no-store"})


@router.get("/settings")
async def get_settings() -> JSONResponse:
    """Return public settings with masked API key."""
    public_cfg = await settings_mgr.get_public()
    return JSONResponse(public_cfg, headers={"Cache-Control": "no-store"})


@router.get("/models")
async def get_models(request: Request) -> JSONResponse:
    """Return available LLM providers, model IDs, current overrides, and default model."""
    cfg = await settings_mgr.load()
    assistant_cfg = cfg.get("assistant", {}) if isinstance(cfg, dict) else {}
    provider_override = assistant_cfg.get("provider", "")
    model_override = assistant_cfg.get("model", "")

    providers = [
        {"id": "anthropic", "name": "Anthropic", "models": ["claude-3-7-sonnet", "claude-3-5-haiku", "claude-3-5-sonnet"]},
        {"id": "openai", "name": "OpenAI", "models": ["gpt-4o", "gpt-4o-mini", "o3-mini"]},
        {"id": "gemini", "name": "Google Gemini", "models": ["gemini-2.0-flash", "gemini-2.5-pro"]},
    ]
    default_model = "anthropic/claude-3-7-sonnet"
    try:
        config_path = Path(r"C:\Users\smash\AppData\Local\hermes\config.yaml")
        if config_path.is_file():
            text = config_path.read_text(encoding="utf-8")
            m = re.search(r'^\s*default:\s*["\']?([^"\']+)["\']?', text, re.MULTILINE)
            if m:
                default_model = m.group(1).strip()
    except Exception:
        pass

    if ctx and hasattr(ctx, "llm"):
        if hasattr(ctx.llm, "get_models"):
            providers = ctx.llm.get_models()
        if hasattr(ctx.llm, "default_model"):
            default_model = ctx.llm.default_model

    return JSONResponse({
        "providers": providers,
        "default": default_model,
        "current": {
            "provider": provider_override,
            "model": model_override,
        },
    }, headers={"Cache-Control": "no-store"})


@router.get("/production")
async def get_production(id: str = Query(..., description="Item ID")) -> JSONResponse:
    """Return production sub-object for the specified item ID."""
    state = await store.get()
    item = next((i for i in state.get("items", []) if i.get("id") == id), None)
    if not item:
        raise HTTPException(404, detail="Item not found")
    return JSONResponse(item.get("production") or {}, headers={"Cache-Control": "no-store"})


@router.get("/insights")
async def get_insights() -> JSONResponse:
    """Aggregate per-item engagement totals from state.metrics."""
    state = await store.get()
    metrics = state.get("metrics", [])
    items_map = {item["id"]: item for item in state.get("items", []) if "id" in item}

    aggregated: dict[str, dict[str, Any]] = {}
    for m in metrics:
        item_id = m.get("itemId")
        if not item_id:
            continue
        if item_id not in aggregated:
            matched = items_map.get(item_id, {})
            aggregated[item_id] = {
                "itemId": item_id,
                "title": matched.get("title", ""),
                "platform": matched.get("platform"),
                "status": matched.get("status"),
                "views": 0,
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "saves": 0,
            }
        agg = aggregated[item_id]
        agg["views"] += int(m.get("views") or 0)
        agg["likes"] += int(m.get("likes") or 0)
        agg["comments"] += int(m.get("comments") or 0)
        agg["shares"] += int(m.get("shares") or 0)
        agg["saves"] += int(m.get("saves") or 0)
        agg["engagements"] = agg["likes"] + agg["comments"] + agg["shares"] + agg["saves"]

    items_list = list(aggregated.values())
    totals = {
        "views": sum(a["views"] for a in items_list),
        "likes": sum(a["likes"] for a in items_list),
        "comments": sum(a["comments"] for a in items_list),
        "shares": sum(a["shares"] for a in items_list),
        "saves": sum(a["saves"] for a in items_list),
        "engagements": sum(a.get("engagements", 0) for a in items_list),
    }

    return JSONResponse({"items": items_list, "totals": totals}, headers={"Cache-Control": "no-store"})


@router.get("/monid/status")
async def get_monid_status() -> JSONResponse:
    """Check Monid CLI balance and availability."""
    res = await monid_runner.balance()
    return JSONResponse(res, headers={"Cache-Control": "no-store"})


@router.get("/files/{filename:path}")
@router.get("/assets/{filename:path}")
@router.get("/media-desk/files/{filename:path}")
@router.get("/media-desk/assets/{filename:path}")
async def serve_file(filename: str, request: Request) -> Response:
    """Serve uploaded/generated media files with Range header (HTTP 206) support."""
    clean = filename.replace("\\", "/").strip().lstrip("/")
    for prefix in (
        "api/plugins/hermes-media-desk/assets/",
        "api/plugins/hermes-media-desk/files/",
        "media-desk/assets/",
        "media-desk/files/",
        "assets/",
        "files/",
    ):
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
            break

    if not re.match(r"^[\w.-]+$", clean):
        raise HTTPException(400, detail="Invalid filename")

    file_path = None
    candidates = [
        FILES_DIR / clean,
        _PLUGIN_REPO_ROOT / "assets" / clean,
        _PLUGIN_REPO_ROOT / "data" / "files" / clean,
    ]
    for cand in candidates:
        if cand.is_file():
            file_path = cand
            break

    if not file_path:
        raise HTTPException(404, detail="File not found")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    mime_type = mime_type or "application/octet-stream"
    total_size = file_path.stat().st_size

    range_header = request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        # Parse range (e.g. bytes=0-1024 or bytes=500-)
        range_str = range_header[6:].strip()
        parts = range_str.split("-")
        try:
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if len(parts) > 1 and parts[1] else total_size - 1
            if start >= total_size or end >= total_size or start > end:
                raise HTTPException(416, detail="Range Not Satisfiable")

            length = end - start + 1
            with open(file_path, "rb") as f:
                f.seek(start)
                data = f.read(length)

            return Response(
                content=data,
                status_code=206,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{total_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(length),
                    "Content-Type": mime_type,
                    "Cache-Control": "private, max-age=3600",
                    "X-Content-Type-Options": "nosniff",
                },
            )
        except (ValueError, IndexError):
            raise HTTPException(416, detail="Range Not Satisfiable")

    # Full response
    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/asset")
async def get_asset(src: str = Query(..., description="Relative media path, e.g. media-desk/files/x.png or media-desk/assets/x.jpg")) -> JSONResponse:
    """Return a stored media file as a JSON ``{"dataUrl": ...}`` payload.

    Desktop clients render media inside ``<img>`` tags, which cannot attach
    gateway authentication headers. This endpoint lets them fetch the bytes
    through the authenticated JSON channel and render a base64 data URL.

    Supports local plugin media paths:
    ``media-desk/assets/*``, ``assets/*``, ``media-desk/files/*``, and ``files/*``.
    """
    if not src or not isinstance(src, str):
        raise HTTPException(400, detail="Missing src")

    clean = src.replace("\\", "/").strip().lstrip("/")
    filename = None
    for prefix in (
        "api/plugins/hermes-media-desk/assets/",
        "api/plugins/hermes-media-desk/files/",
        "media-desk/assets/",
        "media-desk/files/",
        "assets/",
        "files/",
    ):
        if clean.startswith(prefix):
            filename = clean[len(prefix):]
            break

    if filename is None:
        if re.match(r"^[\w.-]+$", clean):
            filename = clean
        else:
            raise HTTPException(400, detail="Only media-desk/assets/*, assets/*, media-desk/files/*, or files/* assets can be served")

    if not re.match(r"^[\w.-]+$", filename):
        raise HTTPException(400, detail="Invalid filename")

    file_path = None
    is_asset_path = "assets" in clean
    candidates = (
        [
            _PLUGIN_REPO_ROOT / "assets" / filename,
            _PLUGIN_REPO_ROOT / "data" / "files" / filename,
            FILES_DIR / filename,
        ]
        if is_asset_path
        else [
            FILES_DIR / filename,
            _PLUGIN_REPO_ROOT / "data" / "files" / filename,
            _PLUGIN_REPO_ROOT / "assets" / filename,
        ]
    )

    for cand in candidates:
        if cand.is_file():
            file_path = cand
            break

    if not file_path:
        raise HTTPException(404, detail="File not found")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    mime_type = mime_type or "application/octet-stream"

    data = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return JSONResponse(
        {"dataUrl": f"data:{mime_type};base64,{data}"},
        headers={"Cache-Control": "no-store"},
    )


# ---------------------------------------------------------------------------
# POST Routes (Requirement 9.2)
# ---------------------------------------------------------------------------

@router.post("/upload", dependencies=[Depends(check_origin)])
async def upload_file(request: Request) -> JSONResponse:
    """Accept binary upload (up to 250 MB) and store in FILES_DIR."""
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(415, detail="Unsupported media type")

    data = await request.body()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, detail="Upload exceeds 250MB limit")

    ext = mimetypes.guess_extension(content_type) or ".bin"
    if ext == ".jpe":
        ext = ".jpg"

    filename = f"upload_{uuid.uuid4().hex[:12]}{ext}"
    target = FILES_DIR / filename
    target.write_bytes(data)

    return JSONResponse({"src": f"media-desk/files/{filename}"}, headers={"Cache-Control": "no-store"})


@router.post("/ops", dependencies=[Depends(check_origin)])
async def post_ops(request: Request) -> JSONResponse:
    """Execute ops-queue mutations and broadcast state.changed."""
    body = await parse_json_body(request)
    ops_list = body.get("ops")
    if not isinstance(ops_list, list):
        if "op" in body:
            ops_list = [body]
        else:
            ops_list = []

    undoable = bool(body.get("undoable", True))
    state = await store.get()
    before_snapshot = copy.deepcopy(state)

    new_state, receipts, errors = await apply_ops(state, ops_list)

    if undoable and before_snapshot != new_state:
        label = ops_list[0].get("op", "mutation") if ops_list else "mutation"
        undo_stack.push(label, before_snapshot, copy.deepcopy(new_state))

    await store.put(new_state)
    await broadcast_plugin_event("hermes-media-desk", "state.changed", {"kind": "ops"})

    return JSONResponse({"receipts": receipts, "errors": errors, "state": new_state}, headers={"Cache-Control": "no-store"})


@router.post("/undo", dependencies=[Depends(check_origin)])
async def post_undo() -> JSONResponse:
    """Pop the last entry from the undo stack and apply 3-way merge revert."""
    state = await store.get()
    label, merged_state, can_undo = undo_stack.pop(state)

    if label is not None:
        await store.put(merged_state)
        await broadcast_plugin_event("hermes-media-desk", "state.changed", {"kind": "ops"})

    return JSONResponse({"label": label, "state": merged_state, "canUndo": can_undo}, headers={"Cache-Control": "no-store"})


@router.post("/produce", dependencies=[Depends(check_origin)])
async def post_produce(request: Request) -> JSONResponse:
    """Start one-click production pipeline in background task."""
    body = await parse_json_body(request)
    item_id = body.get("id")
    if not item_id:
        raise HTTPException(400, detail="Missing item id")

    settings = await settings_mgr.load()
    started = await pipeline.start(item_id, settings=settings)
    state = await store.get()

    return JSONResponse({"started": started, "state": state}, headers={"Cache-Control": "no-store"})


@router.post("/produce/cancel", dependencies=[Depends(check_origin)])
async def post_produce_cancel(request: Request) -> JSONResponse:
    """Cancel running production pipeline."""
    body = await parse_json_body(request)
    item_id = body.get("id")
    if not item_id:
        raise HTTPException(400, detail="Missing item id")

    await pipeline.cancel(item_id)
    state = await store.get()
    return JSONResponse({"cancelled": True, "state": state}, headers={"Cache-Control": "no-store"})


@router.post("/produce/regen", dependencies=[Depends(check_origin)])
async def post_produce_regen(request: Request) -> JSONResponse:
    """Regenerate specific production assets."""
    body = await parse_json_body(request)
    item_id = body.get("id")
    targets = body.get("targets") or []
    if not item_id:
        raise HTTPException(400, detail="Missing item id")

    state = await store.get()
    item = next((i for i in state.get("items", []) if i.get("id") == item_id), None)
    if not item or not isinstance(item.get("production"), dict):
        raise HTTPException(404, detail="Item or production not found")

    settings = await settings_mgr.load()
    # Regenerate target assets in background
    for target in targets:
        asyncio.create_task(_regen_target(item_id, target, settings))

    return JSONResponse({"started": True, "state": state}, headers={"Cache-Control": "no-store"})


async def _regen_target(item_id: str, target: str, settings: dict[str, Any]) -> None:
    state = await store.get()
    item = next((i for i in state.get("items", []) if i.get("id") == item_id), None)
    if not item or not isinstance(item.get("production"), dict):
        return
    prod = item["production"]
    asset = None
    kind = "figure"

    if target == "cover":
        asset = prod.get("cover")
        kind = "cover"
    elif target.startswith("figure_"):
        try:
            idx = int(target.split("_")[1]) - 1
            images = prod.get("images", [])
            if 0 <= idx < len(images):
                asset = images[idx]
                kind = "figure"
        except Exception:
            pass
    elif target.startswith("shot_"):
        try:
            idx = int(target.split("_")[1]) - 1
            shots = prod.get("shots", [])
            if 0 <= idx < len(shots):
                asset = shots[idx]
                kind = "shot"
        except Exception:
            pass

    if isinstance(asset, dict):
        asset["status"] = "running"
        await store.put(state)
        try:
            assembled = f"{target} illustration, no text"
            img_bytes = await image_gen.generate(assembled, settings=settings)
            ext = ".png" if img_bytes.startswith(b"\x89PNG") else ".jpg"
            fn = f"regen_{item_id}_{target}_{uuid.uuid4().hex[:6]}{ext}"
            (FILES_DIR / fn).write_bytes(img_bytes)
            asset["src"] = f"media-desk/files/{fn}"
            asset["status"] = "done"
            await store.put(state)
            await broadcast_plugin_event("hermes-media-desk", "asset.ready", {"item_id": item_id, "target": target, "src": asset["src"]})
        except Exception as exc:
            logger.warning("Regen failed for %s: %s", target, exc)
            asset["status"] = "failed"
            await store.put(state)
            await broadcast_plugin_event("hermes-media-desk", "state.changed", {"kind": "asset_error"})


@router.post("/produce/save", dependencies=[Depends(check_origin)])
async def post_produce_save(request: Request) -> JSONResponse:
    """Export production to folder on disk."""
    body = await parse_json_body(request)
    item_id = body.get("id")
    if not item_id:
        raise HTTPException(400, detail="Missing item id")

    state = await store.get()
    item = next((i for i in state.get("items", []) if i.get("id") == item_id), None)
    if not item:
        raise HTTPException(404, detail="Item not found")

    prod = item.get("production")
    if not isinstance(prod, dict) or not (prod.get("article") or "").strip():
        raise HTTPException(400, detail="Production article is empty")

    settings = await settings_mgr.load()
    video_cover_b64 = body.get("videoCover")

    res = await save_production(item_id, prod, settings, video_cover_b64=video_cover_b64, files_dir=FILES_DIR)
    await store.put(state)
    return JSONResponse(res, headers={"Cache-Control": "no-store"})


@router.post("/produce/reveal", dependencies=[Depends(check_origin)])
async def post_produce_reveal(request: Request) -> JSONResponse:
    """Open exported production folder in OS file manager."""
    body = await parse_json_body(request)
    item_id = body.get("id")
    if not item_id:
        raise HTTPException(400, detail="Missing item id")

    state = await store.get()
    item = next((i for i in state.get("items", []) if i.get("id") == item_id), None)
    if not item or not isinstance(item.get("production"), dict):
        raise HTTPException(404, detail="Item or production not found")

    await reveal_production(item["production"])
    return JSONResponse({"revealed": True}, headers={"Cache-Control": "no-store"})


@router.post("/chat", dependencies=[Depends(check_origin)])
async def post_chat(request: Request) -> JSONResponse:
    """Conversational studio revision and assistant reply."""
    body = await parse_json_body(request)
    msg = (body.get("message") or "").strip()
    if not msg:
        raise HTTPException(400, detail="Message cannot be empty")

    focus_id = body.get("focusId")
    history = body.get("history") or []

    state = await store.get()
    item = next((i for i in state.get("items", []) if i.get("id") == focus_id), None) if focus_id else None
    prod = item.get("production") if item and isinstance(item.get("production"), dict) else None

    active_style_id = state.get("activeStyleId")
    style = next((s for s in state.get("styles", []) if s.get("id") == active_style_id), None)

    # Filter history scoped to this focus_id
    scoped_history = [h for h in history if h.get("itemId") == focus_id][-8:] if focus_id else history[-8:]

    reply_dict = await ai.chat_reply(
        ctx=ctx,
        message=msg,
        history=scoped_history,
        item=item or {},
        production=prod,
        style=style,
    )

    answer = reply_dict.get("reply", "")
    ops = reply_dict.get("ops", [])
    revise = reply_dict.get("revise", {})
    actions = reply_dict.get("actions", [])
    targets: list[str] = []

    # Filter out produce actions if production is done (Requirement 10.7)
    if prod and prod.get("status") == "done":
        actions = [a for a in actions if a != "produce" and a.get("action") != "produce"]

    # Apply ops if present
    if ops:
        state, _, _ = await apply_ops(state, ops)

    # Apply revisions if completed (Requirement 10.4, 10.5)
    if revise:
        if prod and prod.get("status") == "done":
            if "title" in revise:
                prod["title"] = revise["title"]
            if "coverText" in revise:
                prod["coverText"] = revise["coverText"]
            if "article" in revise:
                prod["article"] = revise["article"]
            if "cover" in revise and isinstance(prod.get("cover"), dict):
                prod["cover"]["prompt"] = revise["cover"]
                targets.append("cover")
        else:
            answer += " (Note: In-place revision is only available for completed productions.)"

    # Save turn to state.chat with receipt tracking
    receipts: list[dict[str, Any]] = [
        {"text": f"Applied change: {op.get('op')}"} for op in ops if isinstance(op, dict)
    ]
    if revise:
        if "title" in revise:
            receipts.append({"text": f"Updated title to: {revise['title']}"})
        if "article" in revise:
            receipts.append({"text": "Updated article draft"})
        if "cover" in revise:
            receipts.append({"text": "Updated cover visual prompt"})

    model_ok = bool(reply_dict.get("modelOk", True))
    model_err = reply_dict.get("modelError")

    chat_log = state.setdefault("chat", [])
    now_iso = datetime.now(timezone.utc).isoformat()
    chat_log.append({
        "id": f"c-{uuid.uuid4().hex[:8]}",
        "role": "user",
        "content": msg,
        "text": msg,
        "itemId": focus_id,
        "time": now_iso,
    })
    chat_log.append({
        "id": f"c-{uuid.uuid4().hex[:8]}",
        "role": "assistant",
        "content": answer,
        "text": answer,
        "receipts": receipts,
        "errors": [model_err] if (not model_ok and model_err) else [],
        "engine": "local" if not model_ok else "model",
        "itemId": focus_id,
        "undoable": bool(ops or revise),
        "time": now_iso,
    })
    state["chat"] = chat_log[-300:]  # Trim to 300 messages (Requirement 10.8)

    await store.put(state)

    return JSONResponse({
        "answer": answer,
        "actions": actions,
        "targets": targets,
        "receipts": receipts,
        "state": state,
        "modelOk": model_ok,
        "modelError": model_err,
        "model": reply_dict.get("model"),
    }, headers={"Cache-Control": "no-store"})


@router.post("/chat/clear", dependencies=[Depends(check_origin)])
async def post_chat_clear() -> JSONResponse:
    """Clear chat conversation history."""
    state = await store.get()
    state["chat"] = []
    await store.put(state)
    return JSONResponse(state, headers={"Cache-Control": "no-store"})


@router.post("/style/extract", dependencies=[Depends(check_origin)])
async def post_style_extract(request: Request) -> JSONResponse:
    """Extract writing style profile from URLs or text."""
    body = await parse_json_body(request)
    urls = body.get("urls") or []
    text = body.get("text") or ""
    account_key = body.get("accountKey")

    state = await store.get()
    card = await style_extract(ctx, urls=urls, text=text, account_key=account_key, state=state)
    await store.put(state)
    return JSONResponse({"style": card, "state": state}, headers={"Cache-Control": "no-store"})


@router.post("/monid/import", dependencies=[Depends(check_origin)])
async def post_monid_import(request: Request) -> JSONResponse:
    """Import posts from social media using Monid CLI."""
    body = await parse_json_body(request)
    platform = body.get("platform") or ""
    url = body.get("url") or ""
    count = body.get("count", 20)

    if not url:
        raise HTTPException(400, detail="Missing account URL")

    settings_cfg = await settings_mgr.load()
    receipt = await monid_runner.import_posts(
        platform=platform,
        url=url,
        count=count,
        ctx=ctx,
        store=store,
        settings=settings_cfg,
        files_dir=FILES_DIR,
    )
    return JSONResponse(receipt, headers={"Cache-Control": "no-store"})


@router.post("/settings", dependencies=[Depends(check_origin)])
async def post_settings(request: Request) -> JSONResponse:
    """Update settings and broadcast settings_change event."""
    body = await parse_json_body(request)
    saved = await settings_mgr.save(body)
    await broadcast_plugin_event("hermes-media-desk", "state.changed", {"kind": "settings_change"})
    public_cfg = await settings_mgr.get_public()
    return JSONResponse(public_cfg, headers={"Cache-Control": "no-store"})


@router.post("/settings/test", dependencies=[Depends(check_origin)])
async def post_settings_test(request: Request) -> JSONResponse:
    """Generate a single test image with paper boat prompt to verify image provider configuration."""
    settings = await settings_mgr.load()
    try:
        img_bytes = await image_gen.generate(
            prompt=TEST_IMAGE_PROMPT,
            settings=settings,
            purpose="test",
        )
        ext = ".png" if img_bytes.startswith(b"\x89PNG") else ".jpg"
        fn = f"test_{uuid.uuid4().hex[:8]}{ext}"
        (FILES_DIR / fn).write_bytes(img_bytes)
        return JSONResponse({"src": f"media-desk/files/{fn}"}, headers={"Cache-Control": "no-store"})
    except Exception as exc:
        raise HTTPException(400, detail=f"Image test generation failed: {exc}")


@router.post("/capture-url", dependencies=[Depends(check_origin)])
async def post_capture_url(request: Request) -> JSONResponse:
    """Scrape web article metadata via SSRF-safe harvest."""
    body = await parse_json_body(request)
    url = body.get("url") or ""
    if not url:
        raise HTTPException(400, detail="Missing url")

    meta = await capture_url(url)
    return JSONResponse(meta, headers={"Cache-Control": "no-store"})


@router.post("/account/refresh", dependencies=[Depends(check_origin)])
async def post_account_refresh(request: Request) -> JSONResponse:
    """Re-import posts for an existing social account."""
    body = await parse_json_body(request)
    acc_id = body.get("id")
    if not acc_id:
        raise HTTPException(400, detail="Missing account id")

    state = await store.get()
    acc = next((a for a in state.get("accounts", []) if a.get("id") == acc_id), None)
    if not acc:
        raise HTTPException(404, detail="Account not found")

    url = acc.get("url")
    platform = acc.get("platform", "X")
    if not url:
        raise HTTPException(400, detail="Account does not have an account URL configured")

    settings_cfg = await settings_mgr.load()
    receipt = await monid_runner.import_posts(
        platform=platform,
        url=url,
        ctx=ctx,
        store=store,
        settings=settings_cfg,
        files_dir=FILES_DIR,
    )
    return JSONResponse({"refreshed": True, "receipt": receipt, "state": await store.get()}, headers={"Cache-Control": "no-store"})


@router.post("/skills/learn", dependencies=[Depends(check_origin)])
async def post_skills_learn(request: Request) -> JSONResponse:
    """Derive writing rule skills from high-performing metrics and items."""
    state = await store.get()
    proposed = await skills_learn(ctx, state)
    await store.put(state)
    return JSONResponse({"proposed": proposed, "count": len(proposed), "state": state}, headers={"Cache-Control": "no-store"})


@router.post("/skills/export", dependencies=[Depends(check_origin)])
async def post_skills_export(request: Request) -> JSONResponse:
    """Export active skills to Hermes SKILL.md document."""
    state = await store.get()
    skills_dir = DATA_DIR / "skills"
    path = await skills_export(state, skills_root=skills_dir)
    await store.put(state)
    return JSONResponse({"exported": True, "path": str(path), "state": state}, headers={"Cache-Control": "no-store"})
