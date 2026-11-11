# Implementation Plan: hermes-media-desk

## Overview

Implement the `hermes-media-desk` unified Hermes plugin — a FastAPI backend plus an uncompiled ESM desktop frontend — delivering a full-screen five-page social-media content workbench with one-click AI production, in-studio chat revision, Monid social import, and bilingual (zh/en) support.

Tasks are ordered so each module can be built and tested before downstream modules depend on it: scaffold → data layer → ops pipeline → AI/image services → production pipeline → chat → route wiring → desktop UI.

---

## Tasks

- [x] 1. Scaffold plugin package and manifest files
  - Create `~/.hermes/plugins/hermes-media-desk/` directory structure matching the layout: `plugin.yaml`, `__init__.py`, `dashboard/manifest.json`, `dashboard/plugin_api.py` (stub), and `desktop/plugin.js` (stub)
  - Write `plugin.yaml` declaring `id: hermes-media-desk`, `defaultEnabled: false`, the `config_schema` block with `image.apiKey` as a `secret` type, and mount point `/api/plugins/hermes-media-desk/`
  - Write `dashboard/manifest.json` with `"id": "hermes-media-desk"` matching `plugin.yaml`
  - Write `__init__.py` that imports and re-exports the FastAPI router from `dashboard/plugin_api.py`
  - _Requirements: 1.1, 1.2, 1.3, 1.7_

- [x] 2. Implement `dashboard/i18n.py` — locale resolution
  - Implement `get_lang(request: Request) -> str` that reads the `x-media-desk-lang` header; maps any `zh-*` variant to `"zh"`, any `en-*` variant to `"en"`, treats `"auto"` or absent header as the system locale with `"en"` fallback
  - Export `LANGS = ("zh", "en")` and a `t(key: str, lang: str, **kwargs) -> str` helper backed by a bilingual string map covering all backend-generated receipt and error messages
  - _Requirements: 21.1, 21.7_

- [x] 3. Implement `dashboard/store.py` — StoreManager
  - Implement `StoreManager` with `async def load(self) -> dict`, `async def save(self, state: dict) -> None`, and `async def update(self, fn) -> dict`; protect concurrent writes with `asyncio.Lock`
  - Implement atomic write: serialize to JSON → write to `state.json.<pid>.tmp` → `os.replace(tmp, path)`
  - Implement mtime-based cache invalidation: re-read from disk when `Path.stat().st_mtime_ns` has changed since last read
  - Implement `_migrate(state)` applying the three forward migrations (versions 0→1, 1→2, 2→3) and `_migrate_presets(state)` for preset version checks; `_migrate` must be idempotent
  - On JSON parse failure: discard corrupt file, write seed state, log warning; on migration exception: raise `RuntimeError("State migration failed: …")` without returning partial state
  - Create `plugin_data_dir("hermes-media-desk")/files/` directory on first access
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10_

- [x] 4. Implement `dashboard/settings.py` — SettingsManager
  - Implement `SettingsManager` with `DEFAULTS` dict, `async def load(self) -> dict`, `async def save(self, patch: dict) -> dict`, and `async def get_public(self) -> dict`
  - `save()` must call `_validate(patch)` before merging; write to `settings.json` with file permissions `0o600` using the same tmp+rename strategy as StoreManager
  - `_validate()` must raise `HTTPException(400)` for: invalid `image.source`, non-HTTP(S) `image.baseUrl`, non-JSON-object `image.extra`, mismatched `assistant.provider`/`model`, invalid `toolSize`, invalid `toolQuality`
  - `_validate()` must silently ignore invalid `language` values, retaining the stored value or default
  - Clamp `imageCount` to `int` in `[0, 4]` and `shotCount` to `int` in `[0, 12]`; non-finite values retain the current stored value or the schema default
  - `get_public()` must replace `image.apiKey` with `hasKey: bool` and `keyHint: str` (last 4 chars if `len >= 4`, else `""`) and add `imageReady: bool`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [ ]* 4.1 Write property tests for SettingsManager validation
    - **Property 7: Settings Integer Clamping** — for any `imageCount`/`shotCount` value (int, float, `inf`, `nan`, `None`), stored value is always an integer in `[0, 4]` / `[0, 12]`
    - **Property 8: Settings API Key Masking** — for any non-empty `apiKey`, `GET /settings` response never contains the raw key; always contains `hasKey: true` and `keyHint` of at most 4 chars
    - **Validates: Requirements 3.2, 3.8**

- [x] 5. Implement `dashboard/seed.py` — seed state and bilingual sample data
  - Implement `seed_state() -> dict` returning the initial store state: 25 sample items (5 per platform: WeChat, Xiaohongshu, Douyin, Bilibili, Channels; statuses distributed 5 each across idea/outline/draft/ready/published), 4 personas, 8 angles, 3 skills (`status: "active"`), 4 accounts, and 15 Style Presets
  - Each sample item must carry `sample: True` and bilingual copies of `title`, `body`, `tags`, `source`, `media`, `production`, and `drafts` fields stored under `item.otherLang` with keys `"zh"` and `"en"`
  - Generate decaying daily-view metrics for 4 published items using `views = int(peak * exp(-day * 0.55) * uniform(0.8, 1.2))` for 9 days; `likes = int(views * 0.08)`, `comments = int(views * 0.02)`, `shares = int(views * 0.03)`, `saves = int(views * 0.05)`
  - Implement the 15 Style Presets with ids `ai_tech`, `gadget`, `travel`, `food`, `vlog`, `home`, `reading`, `career`, `tutorial`, `business`, `beauty`, `outfit`, `story`, `parent`, `news` organized under exactly 8 category strings; each preset must carry bilingual text fields under a `_lang` map
  - _Requirements: 11.1, 11.2, 11.7, 11.8, 11.9_

- [x] 6. Implement `dashboard/undo.py` — three-way merge undo
  - Implement `revert_change(before, after, current)` with the full recursive logic: identity short-circuit when `before == after`; round-trip when `current == after`; recursive dict merge; keyed-array merge via `_revert_keyed_array`; non-keyed array element-wise when lengths match; fallback to `current`
  - Implement `_is_keyed(arr)` and `_revert_keyed_array(before, after, current)`: re-insert deleted rows at their original index positions, remove rows added in the step, recursively merge rows present in both before and after
  - Implement `UndoStack` with `push(label, before, after)` (no-op when `before == after`; drop oldest when at 30-entry cap) and `pop(current) -> (label | None, merged_state, canUndo)`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [x]* 6.1 Write property tests for `revert_change` and `UndoStack`
    - **Property 1: Undo Identity** — `revert_change(x, x, c) == c` for all JSON-like `x` and `c`
    - **Property 2: Undo Round-Trip** — `revert_change(b, a, a)` deep-equals `b` for all JSON-like `b`, `a`
    - **Property 3: Undo Stack Bound** — after any sequence of `push` calls of arbitrary length, `len(stack._entries) <= 30`
    - **Validates: Requirements 6.9, 6.10, 6.1, 6.2**

- [x] 7. Implement `dashboard/harvest.py` — SSRF check and URL capture
  - Implement `ssrf_check(url, *, max_size=1_572_864, timeout=8.0, max_redirects=4) -> bytes`: validate `http://` or `https://` scheme, resolve hostname to IP, reject RFC 1918 / loopback / link-local ranges using `ipaddress` (block `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1/128`, `fc00::/7`, `fe80::/10`), enforce size and timeout limits, limit to `max_redirects` hops; raise `HTTPException(400)` on any violation
  - Implement `capture_url(url: str) -> dict`: call `ssrf_check`, parse HTML for `<title>`, `<meta name="description">`, `og:image`, and `og:site_name`; return `{title, description, og_image, site_name}`
  - _Requirements: 9.3, 12.4, 12.5, 19.5, 19.6_

  - [x]* 7.1 Write property test for SSRF safety
    - **Property 10: SSRF Safety** — for any URL whose resolved IP falls in RFC1918 / loopback / link-local ranges, `ssrf_check` raises `HTTPException(400)` and makes no outbound connection
    - **Validates: Requirements 9.3, 12.4, 12.5, 19.5, 19.6**

- [x] 8. Implement `dashboard/ops.py` — ops pipeline and all 25 handlers
  - Define `OP_HANDLERS` dict and `FIELD_WHITELISTS` dict for all 25 op types: `add_item`, `update_item`, `delete_item`, `schedule_item`, `set_status`, `save_draft`, `update_production`, `add_person`, `update_person`, `delete_person`, `add_angle`, `update_angle`, `delete_angle`, `add_style`, `update_style`, `delete_style`, `set_style`, `add_skill`, `update_skill`, `delete_skill`, `add_metric`, `add_account`, `update_account`, `delete_account`, `clear_samples`
  - Implement `async def apply_ops(state, ops, undo_stack=None, undoable=True) -> tuple[dict, list, list]`: strip each op to its whitelist, dispatch to handler, catch exceptions per-op and append to `errors`, continue processing; push `UndoEntry` when `undoable=True` and state actually changed
  - Implement field coercion helpers: URL validation (`^https?://` or store `null`), date validation (`datetime.fromisoformat` or store `null`), text truncation (UTF-8 encode → slice to byte limit → decode safely without producing invalid characters) for `title` ≤ 40,000, `body` ≤ 40,000, `article` ≤ 200,000, prompt fields ≤ 1,200 bytes
  - Implement content vocabulary enforcement: reject ops setting `item.status` / `item.kind` / `item.platform` to values outside the documented valid sets; append error to `errors`, leave state unchanged for that op
  - Implement `handle_add_item`: require at least one of `title`, `body`, `media` non-empty; auto-assign `pos` among top-level items when no explicit `pos` and no `parentId`
  - Implement `handle_delete_item`: remove orphaned child metrics; set orphaned children's `parentId` to `null` only when no other valid parent exists
  - Implement status transition logic: set `publishedAt = utcnow().isoformat()` when transitioning TO `"published"` and `publishedAt` not already set; delete `publishedAt` when transitioning AWAY FROM `"published"`; apply `scheduledAt` → status rules per Requirements 4.9 and 4.10
  - Implement `handle_clear_samples`: remove all records with `sample: True` from `items`, `people`, `angles`, `metrics`, `accounts`, `skills`, `styles`; set `state.sampleCleared = True`; return receipt with count
  - Implement `handle_set_style`: update `state.activeStyleId`
  - Implement `sample: True` flag preservation on `update_item` and similar update handlers
  - _Requirements: 4.1–4.10, 5.1–5.12, 11.2, 11.3, 11.4_

  - [x]* 8.1 Write property tests for ops pipeline correctness
    - **Property 4: Op Isolation on Failure** — for any op list where one op fails validation, state changes from other (valid) ops are applied; the failing op's target keys remain at pre-call values
    - **Property 5: Op Confluence on Disjoint Keys** — for any two ops `A`, `B` with non-overlapping state keys, applying `[A, B]` produces identical receipts and state as `[B, A]`
    - **Property 6: Text Field Truncation** — for any op payload with arbitrarily long text fields, stored values never exceed byte limits; stored values are always valid UTF-8
    - **Property 9: Content Vocabulary Validation** — for any op setting `item.status`/`kind`/`platform` to an out-of-vocabulary value, the op is rejected with an error entry and no state change occurs
    - **Property 11: Sample Record Preservation** — for any state with mixed `sample: true` and `sample: false` records, `clear_samples` removes all and only `sample: true` records
    - **Validates: Requirements 5.3, 5.12, 5.9, 4.4–4.6, 11.3**

- [x] 9. Implement `dashboard/images.py` — image generator (HTTP and provider modes)
  - Implement `ImageGenerator` with `async def generate(self, prompt: str, settings: dict) -> bytes` dispatching to `_generate_via_http` or `_generate_via_tool`
  - `_generate_via_http`: POST to `{baseUrl}/images/generations` with `Authorization: Bearer {apiKey}` header; parse `data[0].b64_json` (base64-decode) or `data[0].url` / `images[0].url` (download); handle relative URLs with 3-candidate resolution (strip `/v1`, prepend mount path, prepend site root)
  - Same-origin URLs: download with the same `Authorization` header; cross-origin URLs: apply `ssrf_check` before downloading
  - Implement `_validate_image(data: bytes) -> str`: check magic bytes for PNG (`\x89PNG`), JPEG (`\xff\xd8`), WebP (`RIFF...WEBP` at offset 8), GIF (`GIF8`); raise on unknown format; raise if `len(data) > 40_000_000`
  - Implement 429 retry logic: wait 6,000 ms before first retry, 14,000 ms before second; at most 2 retries; mark `status: "failed"` on third failure; treat HTTP 401, 403, 404 as permanent (no retry)
  - Enforce 300-second per-request timeout via `httpx` `timeout` parameter; raise on timeout
  - `_generate_via_tool`: delegate to `ctx.register_image_gen_provider()` registered provider; raise if no provider registered
  - _Requirements: 8.1–8.11_

  - [x]* 9.1 Write property test for image magic byte validation
    - **Property 12: Image Magic Byte Validation** — for any byte sequence not beginning with a recognized magic prefix (PNG/JPEG/WebP/GIF), `_validate_image` raises and does not write to `files/`
    - **Validates: Requirements 8.6**

- [x] 10. Implement `dashboard/ai.py` — LLM prompt builders and callers
  - Implement `build_voice_block(style: dict | None) -> str` and `build_skills_block(skills: list) -> str` per the design pseudocode; active/exported skills go in `<rules>` block prepended before `<voice>`
  - Implement `llm_kwargs(settings: dict) -> dict` returning `{"provider": p, "model": m}` when both are non-empty, else `{}`
  - Implement `async def generate_plan(ctx, item, style, skills, lang) -> dict`: call `ctx.llm.acomplete(light=True, purpose="content-creation", task="generate-plan", timeout=240_000, **llm_kwargs(settings))`; extract structured plan fields
  - Implement `async def generate_article(ctx, plan, item, style, skills, lang) -> str`: call `ctx.llm.acomplete(light=False, purpose="content-creation", task="generate-article", timeout=240_000, **llm_kwargs(settings))`
  - Implement `async def chat_reply(ctx, message, history, item, production, style, lang) -> dict`: call `ctx.llm.acomplete(light=True, purpose="content-creation", task="chat-reply")`; return `{reply, ops, revise, actions}`; on failure (non-JSON, missing fields, exception), fall back to `local_intent()` rule-based parse and set `outage_notice`
  - Implement `async def extract_style(ctx, text, lang) -> dict`: call `ctx.llm.acomplete_structured` returning `{name, tone, sentences, opening, structure, words, avoid, samples}`
  - Implement `fallback_plan(item) -> dict`: generate minimal plan from `item.title` / `item.body`
  - _Requirements: 10.1, 10.2, 12.1, 12.2, 12.3, 22.1, 22.2, 22.3, 22.4, 22.6, 22.7_

- [x] 11. Implement `dashboard/style.py` — style extraction, skills learn, skills export
  - Implement `async def style_extract(ctx, urls: list[str], text: str, account_key: str | None, lang: str) -> dict`: fetch each URL via `ssrf_check` (1.5 MiB, 8 s, 4 redirects); raise `HTTPException(400)` with per-URL error if any URL fails; concatenate extracted text; raise `HTTPException(400)` if total characters < 80; call `ai.extract_style`; upsert a `StyleCard` using `account_key` as deduplication key; set `state.activeStyleId` to the new card's id
  - Implement `async def skills_learn(ctx, state: dict, lang: str) -> list[dict]`: analyze `state.metrics` and existing items; call LLM to propose up to 10 new Skill rules; insert each with `status: "proposed"`
  - Implement `async def skills_export(state: dict, skills_root: Path, lang: str) -> Path`: collect all active and non-sample skills; raise `HTTPException(400)` if none exist; write `media-desk-voice/SKILL.md` as a markdown skill document; update exported skills to `status: "exported"`
  - _Requirements: 12.4–12.13_

- [x] 12. Implement `dashboard/monid.py` — Monid CLI runner and platform normalizers
  - Implement `MonidRunner.find_exe()`: scan `PATH`, common install paths (`/opt/homebrew/bin`, `~/.npm-global/bin`, `~/.local/bin`, `~/.volta/bin`, `~/.bun/bin`), and query the login shell; on Windows, resolve `.cmd` shims to their underlying Node.js entry file and invoke `node <entry.js>` directly with `ELECTRON_RUN_AS_NODE=1`
  - Implement `async def balance(self) -> dict`: run `monid balance -j` via `asyncio.create_subprocess_exec` (no shell); parse JSON; return one of `{state: "missing"}`, `{state: "nokey"}`, `{state: "error", message}`, or `{state: "ready", balance?}`
  - Implement `async def import_posts(self, platform, url, count=20) -> list[dict]`: run `monid fetch <platform> <url> --count <n> --json`; normalize via per-platform normalizer; upsert using key `{platform}:{post.id}`; on re-import update engagement metrics only, preserve `title`/`body` if diverged from last-imported value
  - Implement `PLATFORM_NORMALIZERS` for all 6 platforms (Xiaohongshu, Douyin, Bilibili, TikTok, Instagram, X): map platform-specific fields to common schema `{id, title, body, publishedAt, url, cover, views, likes, comments, saves, shares}`; absent/null fields → `None`
  - Implement short-link resolver: follow up to 4 redirects for `xhslink.com`, `v.douyin.com`, `b23.tv`, `vm.tiktok.com`, `vt.tiktok.com`; apply `ssrf_check` at each hop; 5-second per-hop timeout; raise `HTTPException(400)` on SSRF violation or redirect limit exceeded
  - Implement platform URL validator: raise `HTTPException(400)` for URLs not matching a supported platform or not HTTP/HTTPS
  - Implement concurrent cover image download (up to 4 workers, 10-second per-image timeout); skip failed downloads without failing the import
  - _Requirements: 13.1–13.14_

- [x] 13. Implement `dashboard/export.py` — content export and reveal
  - Implement `sanitize_filename(name: str) -> str`: strip characters `\ / : * ? " < > |`; fall back to `"export"` on empty result
  - Implement `async def save_production(item_id, production, settings, video_cover_b64, lang) -> dict`: resolve and create export folder (overwrite if exists); for each asset, copy binary from `Files_Dir` — abort and clean up partial folder with HTTP 500 if any file is missing; write `script.md` / `script.md` with figure images embedded after matching `##` headings; write `storyboard.md` / `script.md` table when shots are non-empty; validate `video_cover_b64` JPEG magic bytes (`\xff\xd8`) and write `video-cover.jpg` if present; use `FILE_NAMES` lookup by `lang`
  - Implement `async def reveal_production(production: dict) -> None`: open `production.savedPath` in the OS file manager (`open` on macOS, `explorer` on Windows, `xdg-open` on Linux); raise `HTTPException(400)` if `savedPath` is null or unset
  - Resolve `exportDir` by expanding `~/`; default to `~/Documents/Media Desk` (prefer if already exists) or `~/Documents/Media Desk`
  - _Requirements: 14.1–14.12_

  - [x]* 13.1 Write property test for export filename sanitization
    - **Property 13: Export Filename Safety** — for any production title containing characters from `\ / : * ? " < > |`, the sanitized name contains none of those characters; if sanitization yields empty string, the production `id` is used instead
    - **Validates: Requirements 14.1**

- [x] 14. Implement `dashboard/produce.py` — production pipeline
  - Implement `ProductionPipeline` with `_running: dict[str, asyncio.Task]`
  - `async def start(self, item_id, state, settings) -> bool`: return `False` if a task is already running for this `item_id`; create a background `asyncio.Task` for `_run`; return `True`
  - `async def _run(self, item_id)`:
    1. Call `ai.generate_plan()`; on failure, call `ai.fallback_plan()`
    2. Normalize plan: truncate all text fields, slice `images` to `imageCount`, slice `shots` to `shotCount`, fill missing from fallback plan
    3. Persist `production.stage = "making"`, `production.status = "running"` and all plan fields
    4. Broadcast `state.changed` with `kind: "ops"`
    5. Build coroutine list: `generate_article` task + all image tasks gated by `asyncio.Semaphore(3)`; `await asyncio.gather(*tasks, return_exceptions=True)`
    6. Write asset to `Files_Dir` immediately after generation; update asset `src` and `status` in store without waiting for other assets
    7. On completion: set `production.status = "done"`, `stage = "done"`, `finishedAt`; advance `item.status` per rules (idea/outline → draft, draft → ready); broadcast `produce_completion`
  - `async def cancel(self, item_id)`: cancel the `asyncio.Task`; set `production.status = "cancelled"`; set all pending/running assets to `status: "idle"`
  - `async def settle_all(self)`: find all items with `production.status = "running"` and mark them `failed` with an interruption message; set running/pending assets to `status: "idle"`
  - Implement per-image retry: HTTP 429 → sleep 6 s → retry → sleep 14 s → retry; on 3rd failure mark `status: "failed"`; non-429 errors mark `status: "failed"` immediately; broadcast `asset.ready` on success, `state.changed` with `kind: "asset_error"` on failure
  - Assemble image prompts: prepend cover-style directive to cover prompts, figure-style to figure prompts, storyboard-style to shot prompts; prompts must not contain text, letters, logos, or captions
  - When `imageCount = 0` and `shotCount = 0`, skip all image workers and run only the article task
  - _Requirements: 7.1–7.15_

  - [x]* 14.1 Write property test for production status advancement
    - **Property 14: Production Status Advancement** — for any item with `status` in `{"idea", "outline"}` whose pipeline completes successfully, `item.status` becomes `"draft"`; for any item with `status == "draft"`, `item.status` becomes `"ready"`
    - **Validates: Requirements 7.11**

- [x] 15. Checkpoint — backend modules complete
  - Ensure all tests in `tests/test_undo_properties.py`, `tests/test_ops_properties.py`, `tests/test_settings_properties.py`, `tests/test_validation_properties.py`, and `tests/test_pipeline_properties.py` pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Wire `dashboard/plugin_api.py` — FastAPI route definitions and security
  - Replace the stub `plugin_api.py` with the full router; initialize singletons: `store`, `settings_mgr`, `undo_stack`, `pipeline`, `image_gen`, `monid_runner`
  - Add `check_origin` dependency: reject any POST with `Sec-Fetch-Site` present and not `"same-origin"` or `"none"` (absent header → 403)
  - Register all GET routes (no origin check): `state`, `production`, `settings`, `models`, `insights`, `monid/status`, `assets/{filename}`, `files/{filename}`
  - Register all POST routes with `Depends(check_origin)`: `upload`, `ops`, `undo`, `chat`, `chat/clear`, `produce`, `produce/cancel`, `produce/regen`, `produce/save`, `produce/reveal`, `style/extract`, `monid/import`, `settings`, `settings/test`, `capture-url`, `account/refresh`, `skills/learn`, `skills/export`
  - Implement `GET /state`: call `settle_all()` on the first request; run `localize_samples` when `state.sampleCleared = False` and UI language differs from `state.sampleLang`; return full state
  - Implement `GET /settings`: return `settings_mgr.get_public()` (masked API key)
  - Implement `GET /models`: return available providers from Hermes LLM registry, configured `assistant.*` override values, and default model identifier
  - Implement `GET /production?id=<id>`: return the item's production sub-object
  - Implement `GET /insights`: aggregate per-item view/like/comment/share/save totals from `state.metrics`
  - Implement `GET /files/{filename}` and `GET /assets/{filename}`: validate `filename` against `/^[\w.-]+$/` (400 on fail); support `Range` header with HTTP 206 / `Content-Range` / `Accept-Ranges: bytes`; serve full file with HTTP 200 and `Accept-Ranges: bytes` when no `Range`; set `Cache-Control: private, max-age=3600` and `X-Content-Type-Options: nosniff`
  - Implement `POST /upload`: enforce 250 MB limit; accept only `image/jpg`, `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`; return `{src}`
  - Implement `POST /ops`: delegate to `apply_ops`; broadcast `state.changed` with `kind: "ops"` after mutations; return `{receipts, errors, state}`
  - Implement `POST /undo`: delegate to `undo_stack.pop`; return `{label, state, canUndo}`
  - Implement `POST /produce` and `POST /produce/cancel`, `POST /produce/regen`
  - Implement `POST /produce/save` (validate non-empty `article`; validate JPEG magic bytes for `videoCover`; return `{path, files, state: "saved"}`), `POST /produce/reveal`
  - Implement `POST /chat` and `POST /chat/clear` (reset `state.chat` to `[]`)
  - Implement `POST /style/extract`, `POST /monid/import` (409 when in progress), `POST /settings`, `POST /settings/test`
  - Implement `POST /capture-url`, `POST /account/refresh`, `POST /skills/learn`, `POST /skills/export`
  - Apply JSON body limit 4 MB on all POST routes except `upload`; apply 250 MB on `upload`
  - Add global exception handlers: `HTTPException` → `{error: detail}` with status code; unhandled `Exception` → `{error: "Internal server error"}` with HTTP 500 (no stack traces or file paths)
  - Return `Cache-Control: no-store` on all JSON responses for listed routes
  - Emit `broadcast_plugin_event("hermes-media-desk", "state.changed", {"kind": k})` after: ops-queue mutation (`k="ops"`), production completion (`k="produce_completion"`), settings update (`k="settings_change"`), and asset error (`k="asset_error"`)
  - Emit `broadcast_plugin_event("hermes-media-desk", "asset.ready", {item_id, target, src})` immediately after each asset generation succeeds (without a simultaneous `state.changed`)
  - _Requirements: 1.4, 1.5, 1.6, 7.13, 9.1–9.12, 11.4, 11.5, 11.6, 11.10, 20.1, 20.4_

- [x] 17. Implement `desktop/plugin.js` — entry point, state management, and event wiring
  - Export default object with `id: 'hermes-media-desk'`, `name: 'Media Desk'`, `defaultEnabled: false`, and `register(ctx)` function
  - In `register`: call `ctx.i18n.register({ zh: ZH_BUNDLE, en: EN_BUNDLE })` before any `t()` calls; define all zh and en locale string keys covering every user-visible label, placeholder, tooltip, and accessible name in the plugin
  - Register route area contribution (`ROUTES_AREA`) at `/media-desk` and sidebar nav entry (`SIDEBAR_NAV_AREA`) with a codicon from `@hermes/plugin-sdk`
  - Register settings page via `ctx.registerSettingsPage()` with controls for: image generation source and endpoint, language preference, voice sample, export directory, `imageCount`, `shotCount`
  - Define `initialState` and `reducer` with actions: `SET_STATE`, `SET_ASSET`, `SET_VIEW`, `OPEN_ITEM`, `CLOSE_STUDIO`, `SET_ERROR`, `SET_LOADING`
  - On mount: restore `activeView`, `openItemId`, `filters` from `ctx.storage`; default to `home` on absent/invalid stored state; call `ctx.rest('/state')` via the `rest` helper (always sends `x-media-desk-lang` header); dispatch `SET_STATE` on success; dispatch `SET_ERROR` and render backend-unreachable error screen on failure
  - Subscribe via `ctx.onEvent('plugin.hermes-media-desk.state.changed', ...)`: call `/state` and dispatch `SET_STATE`; discard in-flight prior `/state` request and apply only the most recent response
  - Subscribe via `ctx.onEvent('plugin.hermes-media-desk.asset.ready', ...)`: dispatch `SET_ASSET` to update the specific asset without full reload
  - Persist `activeView`, `openItemId`, `filters` to `ctx.storage` on change
  - In `register`'s return or cleanup: dispose all `ctx.setInterval` timers and event subscriptions; contributions are auto-disposed by `ctx.register`
  - All UI authored with `jsx()` / `jsxs()` from `react/jsx-runtime`; no JSX syntax; no hardcoded color values; use only `var(--ui-*)` theme variables
  - Import only `@hermes/plugin-sdk`, `react`, and `react/jsx-runtime`
  - _Requirements: 1.3, 1.4, 1.5, 1.6, 15.1, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10, 15.11, 20.2, 20.3, 20.5, 21.3, 21.4_

- [x] 18. Implement `desktop/plugin.js` — Inspiration board (HomePage) and URL/file capture
  - Implement `HomePage` component rendering a card grid of items filtered from `serverState.items`
  - Implement URL capture field: on submit, call `POST /capture-url` via `rest`; on success, dispatch `add_item` op via `POST /ops` with `{title, body, media.src}` from response; display error message inline when capture fails
  - Implement file drop/select zone accepting `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/webm`; enforce 50 MiB per-file limit before uploading; call `POST /upload` for each file; on success dispatch `add_item` op; display rejection reason inline without calling `POST /upload` for rejected files
  - Implement item card with title, kind badge, platform tag, status chip, and thumbnail; clicking a card dispatches `OPEN_ITEM`
  - _Requirements: 15.2, 19.1–19.7_

- [x] 19. Implement `desktop/plugin.js` — Content List page (ContentPage)
  - Implement `ContentPage` with a table/kanban layout showing all items; include filters for `status`, `kind`, `platform`
  - Implement inline `set_status` op dispatch via `POST /ops` when user changes an item's status chip
  - _Requirements: 15.2_

- [x] 20. Implement `desktop/plugin.js` — Schedule / Calendar page (SchedulePage)
  - Implement `SchedulePage` rendering a monthly calendar grid with day cells showing truncated titles (40-char ellipsis) for items whose `scheduledAt` falls on that day
  - Implement previous/next month navigation re-rendering the grid for the selected month
  - Implement unscheduled tray below the calendar listing items without `scheduledAt`, sorted by creation date ascending
  - Implement `schedule_item` op dispatch via `POST /ops` with the new ISO 8601 datetime when user assigns or changes a date; on failure, display error toast and restore item to its previous position in calendar or tray
  - _Requirements: 15.2, 17.1–17.6_

- [x] 21. Implement `desktop/plugin.js` — Insights / Analytics page (InsightsPage) and Monid wizard
  - Implement `InsightsPage`: on open, call `GET /insights` and display view/like/comment/share/save totals per item; on failure display error state retaining any previously loaded data
  - Implement client-side CSV export from the `GET /insights` response
  - Implement "Learn rules from data" button: call `POST /skills/learn`; show progress indicator while in-flight; display proposed rule count on success; display error message on failure
  - Implement "Export Skill" button: call `POST /skills/export`; show progress indicator; display success or error message
  - Implement account import wizard panel: on open call `GET /monid/status` and display connection state (`missing`, `nokey`, `error`, `ready` with balance); accept URL or text input; call `POST /monid/import`; show progress indicator while in-flight; on return display receipt (nickname, count, added, cost, style error)
  - _Requirements: 15.2, 18.1–18.9_

- [x] 22. Implement `desktop/plugin.js` — Style Library page (StylePage)
  - Implement `StylePage` rendering the style card library from `serverState.styles`; display preset and user-created cards grouped by category
  - Implement style card selection dispatching `set_style` op via `POST /ops`
  - Implement `add_style`, `update_style`, `delete_style` op dispatches for user-created cards
  - Implement skill rule list from `serverState.skills` with activate/deactivate controls dispatching `update_skill` ops
  - _Requirements: 15.2, 12.9_

- [x] 23. Implement `desktop/plugin.js` — Studio overlay and production UI
  - Implement `StudioOverlay` rendered when `openItemId != null`; contains `IdeaCard`, `ProgressCard`, `HeroTile`, `ArticleTile`, `ShotsTile`, and `ChatDock`
  - `IdeaCard`: editable title field (max 200 chars); on blur, dispatch `update_production` op if title is 1–200 chars; on op failure, restore to last saved value and display error; style picker dispatching `set_style`
  - `ProgressCard`: visible while `production.status == "running"`; display four progress steps (title/cover text, script word count, cover+figures M/total, shots M/total); active step shows shimmer animation; completed step shows check icon
  - Poll `GET /production?id=<id>` at 700 ms intervals while `production.status == "running"` or any asset has `status` in `{"pending", "running"}`; stop when neither condition holds; replace matching fields in local state each tick; on failure retry next tick silently; after 3 consecutive failures stop polling and show inline error
  - `HeroTile`: cover image + figure collage; clicking any asset image opens `AssetViewer`
  - `ArticleTile`: editable article field; on blur, dispatch `update_production` op; allow text selection; when selection ≥ 4 chars, show floating "Ask assistant to edit this" button; on click, pre-populate chat dock input with selected text wrapped in block-quote markers
  - Full-screen tile expansion: on activate, animate from tile bounding box to full container bounds over 250 ms; on Escape or collapse control, animate back over 250 ms
  - `ShotsTile`: storyboard grid of shot assets; full-screen expansion supported
  - `AssetViewer`: large-image viewer; left-arrow → previous asset with `src`; right-arrow → next asset with `src` (stop at first/last); show "Re-generate", "Download", "Ask assistant" actions; hide re-generate controls and show "no image provider" notice with Settings link when `imageReady` is false
  - _Requirements: 16.1–16.11_

- [x] 24. Implement `desktop/plugin.js` — ChatDock and revision UI
  - Implement `ChatDock` component rendering chat history from `serverState.chat` scoped to current `itemId` (last 8 messages sent to backend via `focusId`)
  - On message submit: call `POST /chat` with `{message, focusId: openItemId}`; apply returned `ops`, `revise`, `actions` to local state; show `outageNotice` if `modelOk` is false; display `answer` in chat history
  - Display "undo" affordance on assistant messages where `undoable: true`; clicking calls `POST /undo` and refreshes state
  - `chat/clear` button calls `POST /chat/clear` and clears local chat history
  - _Requirements: 10.1–10.12_

- [x] 25. Final checkpoint — full plugin integration
  - Ensure all Hypothesis property tests pass with at least 100 iterations per property
  - Ensure all unit tests in `tests/test_unit_store.py`, `tests/test_unit_ops.py`, `tests/test_unit_images.py`, `tests/test_unit_monid.py`, and `tests/test_unit_export.py` pass
  - Verify plugin.yaml, dashboard/manifest.json, and desktop/plugin.js all declare `id: hermes-media-desk` consistently
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; core behavior is fully usable without them
- Each task references specific requirements for traceability
- Property-based tests use **Hypothesis** (`@given` + `@settings(max_examples=100)`); each test file contains a comment referencing the design property number
- Unit tests use standard `pytest`; test files live in `tests/` under the plugin root
- Desktop plugin.js is uncompiled ESM — no build step; authored exclusively with `jsx()` / `jsxs()` from `react/jsx-runtime`
- All desktop colors must use `var(--ui-*)` CSS theme variables; no hex, rgba, or named literals
- Checkpoints 15 and 25 are the natural integration gates; reach each before proceeding to downstream modules

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "5", "6", "7", "9"] },
    { "id": 2, "tasks": ["4", "6.1", "7.1", "9.1", "10", "11", "12", "13"] },
    { "id": 3, "tasks": ["4.1", "8", "13.1"] },
    { "id": 4, "tasks": ["8.1", "14"] },
    { "id": 5, "tasks": ["14.1", "16"] },
    { "id": 6, "tasks": ["17"] },
    { "id": 7, "tasks": ["18", "19", "20", "21", "22"] },
    { "id": 8, "tasks": ["23", "24"] }
  ]
}
```
