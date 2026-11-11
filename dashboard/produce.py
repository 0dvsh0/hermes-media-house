"""One-click content production pipeline for hermes-media-desk.

Provides:
- ``ProductionPipeline``: Background execution, plan generation, article generation,
  and gated image generation with concurrency control.
- Concurrency limiting via ``asyncio.Semaphore(3)`` for image generation.
- Status advancement: idea/outline -> draft, draft -> ready upon completion.
- Immediate individual asset persistence & broadcasting.
- Pipeline cancellation and startup settlement (settle_all).

Requirements: 7.1-7.15, 20.1, 20.4
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from pathlib import Path
import re
import uuid
from typing import Any, Callable, Coroutine

from fastapi import HTTPException

from dashboard.ai import fallback_plan, generate_article, generate_plan
from dashboard.ops import truncate_utf8

logger = logging.getLogger("hermes_media_desk.produce")

DIRECTIVES = {
    "zh": {
        "cover": "Social media cover, eye-catching visual composition, no text, no letters, no logos, no captions.",
        "figure": "Article illustration, clean clear subject, modern aesthetic, no text, no letters, no logos, no captions.",
        "shot": "Storyboard film frame, dynamic cinematic scene, no text, no letters, no logos, no captions.",
    },
    "en": {
        "cover": "Social media cover, eye-catching visual composition, no text, no letters, no logos, no captions.",
        "figure": "Article illustration, clean clear subject, modern aesthetic, no text, no letters, no logos, no captions.",
        "shot": "Storyboard film frame, dynamic cinematic scene, no text, no letters, no logos, no captions.",
    },
}


def assemble_prompt(prompt: str, kind: str, lang: str = "en") -> str:
    """Prepend the appropriate style directive to an image prompt.

    Ensures prompt directives instruct no text, letters, logos, or captions.
    Requirements: 7.14.
    """
    lang_key = lang if lang in DIRECTIVES else "en"
    directive = DIRECTIVES[lang_key].get(kind, DIRECTIVES[lang_key]["figure"])
    clean_prompt = prompt.strip() if prompt else ""
    return f"{directive} {clean_prompt}".strip()


def uuid_short() -> str:
    return uuid.uuid4().hex[:8]


class ProductionPipeline:
    """Orchestrates the multi-stage content production pipeline."""

    def __init__(
        self,
        store: Any = None,
        image_gen: Any = None,
        ctx: Any = None,
        files_dir: Path | None = None,
        broadcaster: Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]] | None = None,
    ) -> None:
        self.store = store
        self.image_gen = image_gen
        self.ctx = ctx
        self.files_dir = files_dir or Path("files")
        self.broadcaster = broadcaster
        self._running: dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def broadcast(self, event_name: str, payload: dict[str, Any]) -> None:
        """Helper to emit events to broadcaster or ctx."""
        if self.broadcaster:
            try:
                res = self.broadcaster(event_name, payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as exc:
                logger.debug("Broadcast failed: %s", exc)
        elif self.ctx and hasattr(self.ctx, "broadcast_event"):
            try:
                res = self.ctx.broadcast_event("hermes-media-desk", event_name, payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as exc:
                logger.debug("Context broadcast failed: %s", exc)

    async def start(
        self,
        item_id: str,
        state: dict[str, Any] | None = None,
        settings: dict[str, Any] | None = None,
        lang: str = "en",
    ) -> bool:
        """Start the production pipeline in a background task.

        Returns:
            True if started, False if already running for this item_id.
        Requirements: 7.1, 7.2.
        """
        async with self._lock:
            existing_task = self._running.get(item_id)
            if existing_task and not existing_task.done():
                return False

            task = asyncio.create_task(self._run(item_id, settings=settings or {}, lang=lang))
            self._running[item_id] = task

            def _on_done(t: asyncio.Task) -> None:
                self._running.pop(item_id, None)

            task.add_done_callback(_on_done)
            return True

    async def cancel(self, item_id: str) -> None:
        """Cancel a running production task, setting status=cancelled and assets to idle.

        Requirements: 7.12.
        """
        async with self._lock:
            task = self._running.pop(item_id, None)
            if task and not task.done():
                task.cancel()

        if not self.store:
            return

        state = await self.store.get()
        items = state.get("items", [])
        item = next((i for i in items if i.get("id") == item_id), None)
        if not item or not isinstance(item.get("production"), dict):
            return

        prod = item["production"]
        prod["status"] = "cancelled"

        # Set pending/running assets to idle
        assets_to_reset = []
        if isinstance(prod.get("cover"), dict):
            assets_to_reset.append(prod["cover"])
        if isinstance(prod.get("images"), list):
            assets_to_reset.extend([img for img in prod["images"] if isinstance(img, dict)])
        if isinstance(prod.get("shots"), list):
            assets_to_reset.extend([s for s in prod["shots"] if isinstance(s, dict)])

        for asset in assets_to_reset:
            if asset.get("status") in ("running", "pending"):
                asset["status"] = "idle"

        await self.store.put(state)

    async def settle_all(self) -> None:
        """Mark any production with status=running as failed. Called on startup.

        Requirements: 7.13.
        """
        if not self.store:
            return

        state = await self.store.get()
        items = state.get("items", [])
        modified = False

        for item in items:
            prod = item.get("production")
            if isinstance(prod, dict) and prod.get("status") in ("running", "planning"):
                prod["status"] = "failed"
                prod["error"] = "Production pipeline was interrupted"
                modified = True

                assets = []
                if isinstance(prod.get("cover"), dict):
                    assets.append(prod["cover"])
                if isinstance(prod.get("images"), list):
                    assets.extend([img for img in prod["images"] if isinstance(img, dict)])
                if isinstance(prod.get("shots"), list):
                    assets.extend([s for s in prod["shots"] if isinstance(s, dict)])

                for asset in assets:
                    if asset.get("status") in ("running", "pending"):
                        asset["status"] = "idle"

        if modified:
            await self.store.put(state)

    async def _run(self, item_id: str, settings: dict[str, Any], lang: str) -> None:
        """Main pipeline execution coroutine.

        Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.14, 7.15.
        """
        if not self.store:
            return

        state = await self.store.get()
        items = state.get("items", [])
        item = next((i for i in items if i.get("id") == item_id), None)
        if not item:
            logger.warning("Item %s not found in store", item_id)
            return

        if not isinstance(item.get("production"), dict):
            item["production"] = {}
        production = item["production"]

        # Step 1: Run Plan Stage (Requirements 7.3, 7.4)
        production["stage"] = "plan"
        production["status"] = "planning"
        await self.store.put(state)

        active_style_id = state.get("activeStyleId")
        style = next((s for s in state.get("styles", []) if s.get("id") == active_style_id), None)
        skills = [s for s in state.get("skills", []) if s.get("status") in ("active", "exported")]

        try:
            plan = await generate_plan(self.ctx, item, style, skills, lang)
        except Exception as exc:
            logger.info("Plan LLM failed, using fallback_plan: %s", exc)
            plan = fallback_plan(item)

        # Step 2: Normalize Plan output (Requirement 7.5)
        title = truncate_utf8(plan.get("title") or item.get("title") or "Untitled", 200)
        cover_text = truncate_utf8(plan.get("coverText") or title[:30], 100)
        raw_facts = plan.get("facts") or [title]
        facts = [truncate_utf8(f, 300) for f in raw_facts if isinstance(f, str)]

        outline = plan.get("outline") or ""
        if isinstance(outline, list):
            outline = "\n".join(str(o) for o in outline)

        image_count = int(settings.get("imageCount", 3))
        shot_count = int(settings.get("shotCount", 4))

        # Fill & slice images
        raw_images: list[dict[str, Any]] = [
            img for img in (plan.get("images") or []) if isinstance(img, dict)
        ]
        if len(raw_images) < image_count:
            fb_images = fallback_plan(item).get("images") or []
            for fb_img in fb_images:
                if len(raw_images) >= image_count:
                    break
                raw_images.append(fb_img)
        while len(raw_images) < image_count:
            raw_images.append({"prompt": f"Editorial illustration for {title}, clean modern flat design, no text"})
        raw_images = raw_images[:image_count]

        # Fill & slice shots
        raw_shots: list[dict[str, Any]] = [
            s for s in (plan.get("shots") or []) if isinstance(s, dict)
        ]
        if len(raw_shots) < shot_count:
            fb_shots = fallback_plan(item).get("shots") or []
            for fb_s in fb_shots:
                if len(raw_shots) >= shot_count:
                    break
                raw_shots.append(fb_s)
        while len(raw_shots) < shot_count:
            shot_idx = len(raw_shots) + 1
            raw_shots.append({
                "shotNumber": shot_idx,
                "shotSize": "Medium Shot",
                "duration": "3",
                "visual": f"Scene visual for {title}",
                "voiceOver": "",
                "prompt": f"Storyboard shot {shot_idx} for {title}, clean composition, no text",
            })
        raw_shots = raw_shots[:shot_count]

        # Build Assets
        cover_prompt = (plan.get("cover") or {}).get("prompt") or f"Minimalist clean graphic illustration representing {title}, no text"
        cover_asset = {"status": "pending", "src": None, "prompt": cover_prompt}

        image_assets = [
            {"status": "pending", "src": None, "prompt": img.get("prompt", "")}
            for img in raw_images
        ]

        shot_assets = [
            {
                "status": "pending",
                "src": None,
                "prompt": s.get("prompt", ""),
                "shotNumber": s.get("shotNumber", i + 1),
                "shotSize": s.get("shotSize") or s.get("size") or "Medium Shot",
                "duration": str(s.get("duration") or "3"),
                "visual": s.get("visual") or "",
                "voiceOver": s.get("voiceOver") or s.get("voiceover") or "",
            }
            for i, s in enumerate(raw_shots)
        ]

        # Step 3: Persist stage="making", status="running" (Requirement 7.6)
        production["stage"] = "making"
        production["status"] = "running"
        production["title"] = title
        production["coverText"] = cover_text
        production["facts"] = facts
        production["outline"] = outline
        production["cover"] = cover_asset
        production["images"] = image_assets
        production["shots"] = shot_assets
        production["article"] = ""
        production["finishedAt"] = None
        await self.store.put(state)

        # Step 4: Broadcast state.changed with kind: "ops" (Requirement 20.1)
        await self.broadcast("state.changed", {"kind": "ops"})

        # Step 5: Concurrent Execution (Requirements 7.7, 7.8, 7.15)
        # Sempahore(3) for image workers
        sem = asyncio.Semaphore(3)

        async def _article_worker() -> None:
            try:
                art = await generate_article(self.ctx, plan, item, style, skills, lang)
                production["article"] = art
            except Exception as exc:
                logger.info("Article LLM failed, using fallback: %s", exc)
                production["article"] = f"# {title}\n\n## Introduction\n\n{facts[0] if facts else title}\n\n## Key Analysis\n\n" + "\n\n".join(facts)
            await self.store.put(state)

        async def _image_worker(
            asset_dict: dict[str, Any],
            target_label: str,
            target_kind: str,
        ) -> None:
            if not self.image_gen:
                asset_dict["status"] = "idle"
                return

            assembled = assemble_prompt(asset_dict.get("prompt", ""), target_kind, lang=lang)
            async with sem:
                asset_dict["status"] = "running"
                try:
                    img_bytes = await self.image_gen.generate(
                        prompt=assembled,
                        settings=settings,
                        ctx=self.ctx,
                    )
                    self.files_dir.mkdir(parents=True, exist_ok=True)
                    ext = ".jpg"
                    if img_bytes.startswith(b"\x89PNG"):
                        ext = ".png"
                    elif img_bytes.startswith(b"RIFF") and b"WEBP" in img_bytes[:16]:
                        ext = ".webp"

                    filename = f"prod_{item_id}_{target_label}_{uuid_short()}{ext}"
                    (self.files_dir / filename).write_bytes(img_bytes)

                    asset_dict["src"] = f"media-desk/files/{filename}"
                    asset_dict["status"] = "done"

                    # Immediately update store and broadcast asset.ready (Requirements 7.8, 20.4)
                    await self.store.put(state)
                    await self.broadcast("asset.ready", {
                        "item_id": item_id,
                        "target": target_label,
                        "src": asset_dict["src"],
                    })

                except Exception as exc:
                    logger.warning("Image worker failed for %s (%s): %s", item_id, target_label, exc)
                    asset_dict["status"] = "failed"
                    await self.store.put(state)
                    await self.broadcast("state.changed", {"kind": "asset_error"})

        # Check if images are completely skipped (Requirement 7.15)
        image_tasks: list[Coroutine[Any, Any, None]] = []
        if image_count == 0 and shot_count == 0:
            cover_asset["status"] = "idle"
        else:
            image_tasks.append(_image_worker(cover_asset, "cover", "cover"))
            for i, img in enumerate(image_assets):
                image_tasks.append(_image_worker(img, f"figure_{i + 1}", "figure"))
            for i, shot in enumerate(shot_assets):
                image_tasks.append(_image_worker(shot, f"shot_{i + 1}", "shot"))

        all_tasks = [_article_worker()] + image_tasks
        await asyncio.gather(*all_tasks, return_exceptions=True)

        # Check if cancelled mid-run
        if production.get("status") == "cancelled":
            return

        # Step 6: Completion & Status Advancement (Requirement 7.11, Property 14)
        production["status"] = "done"
        production["stage"] = "done"
        production["finishedAt"] = datetime.now(timezone.utc).isoformat()

        prior_status = item.get("status")
        if prior_status in ("idea", "outline"):
            item["status"] = "draft"
        elif prior_status == "draft":
            item["status"] = "ready"

        await self.store.put(state)

        # Step 7: Broadcast produce_completion (Requirements 7.11, 20.1)
        await self.broadcast("state.changed", {"kind": "produce_completion"})
