# Requirements Document

## Introduction

The `hermes-media-desk` plugin provides the Media Desk social-media content workbench in the Hermes unified plugin architecture. It delivers a full-screen desktop UI with five pages (Inspiration, Content, Schedule, Insights, Style), a one-click production pipeline that generates articles and images concurrently, an in-studio AI chat dock for interactive revision, a Monid-based social account importer, real user data, and a style card system with writing-rule learning. The plugin runs as a unified package — a FastAPI backend mounted at `/api/plugins/hermes-media-desk/` plus a Hermes Desktop Plugin SDK front-end registered at the `/media-desk` route — with both halves defaulting to off and gated independently.

---

## Glossary

- **Plugin**: The `hermes-media-desk` unified plugin package, id `hermes-media-desk`.
- **Backend**: The FastAPI `dashboard/plugin_api.py` process mounted at `/api/plugins/hermes-media-desk/`.
- **Desktop_JS**: The uncompiled `desktop/plugin.js` loaded by the Hermes Desktop app.
- **Store**: The JSON state file at `plugin_data_dir("hermes-media-desk")/state.json`; profile-scoped.
- **Settings_Store**: The JSON settings file at `plugin_data_dir("hermes-media-desk")/settings.json`; profile-scoped.
- **Item**: A single content idea record inside the Store `items` array.
- **Production**: An Item's `production` sub-object containing the generated article, cover, figures, and storyboard shots.
- **Plan**: The first stage of the production pipeline that yields title, cover text, facts, outline, cover prompt, image prompts, and shot prompts.
- **Op**: A single atomic write operation dispatched through the `ops` route.
- **Receipt**: A per-Op success message returned to the caller.
- **Undo_Entry**: A three-way-merge undo record stored in-memory; max 30 entries.
- **Style_Card**: A writing-style profile stored in `state.styles`.
- **Skill**: A writing rule stored in `state.skills`.
- **Preset**: A built-in Style_Card with `preset: true` and one of the 15 canonical ids.
- **Monid_Runner**: The local Monid CLI wrapper used to import social-media posts.
- **Asset**: One generated image — cover, figure, or shot — attached to a Production.
- **Sample**: Any record with `sample: true` in the Store; removable via `clear_samples`.
- **LLM_Client**: Hermes `ctx.llm` interface (`complete` / `acomplete` / `complete_structured` / `acomplete_structured`).
- **Image_Provider**: Either a direct OpenAI-compatible HTTP endpoint or a provider registered via `ctx.register_image_gen_provider()`.
- **Config_Schema**: The `config_schema` block in `plugin.yaml`; non-secret settings read via Hermes config APIs; image API key stored as a `secret` type and read with `get_secret()`.
- **Files_Dir**: `plugin_data_dir("hermes-media-desk")/files/`; stores uploaded and generated binary assets.
- **SSRF_Check**: Public URL validation that blocks private IP ranges, non-HTTP schemes, oversized bodies (1.5 MiB), slow responses (8 s timeout), and more than 4 redirects.
- **Sec_Fetch_Site**: The `Sec-Fetch-Site` HTTP request header used to reject cross-origin POST requests.
- **Range_Request**: HTTP range request; required for video seek and loop in the Desktop_JS player.
- **Broadcast_Event**: Backend push via `broadcast_plugin_event("hermes-media-desk", event_name, payload)`; received in Desktop_JS as `host.onEvent('plugin.hermes-media-desk.<event_name>', fn)`.
- **i18n_Bundle**: A locale bundle registered via `ctx.i18n.register(bundles)` in Desktop_JS; `ctx.i18n.t(key, ...args)` resolves strings.
- **Concurrency_Limit**: Maximum simultaneous image-generation workers during the production pipeline; value 3.
- **Text_Timeout**: LLM call abort deadline during production; value 240 000 ms.
- **Retry_Waits**: HTTP 429 back-off delays before retrying image generation; values `[6000, 14000]` ms (at most 2 retries).
- **Max_Undo**: Maximum Undo_Entry records kept in memory; value 30.
- **JSON_Body_Limit**: Maximum request body size for JSON POST routes; value 4 000 000 bytes.
- **Upload_Limit**: Maximum request body size for the binary upload route; value 250 000 000 bytes.
- **Image_Size_Limit**: Maximum byte size for a generated or downloaded image accepted by the system; value 40 000 000 bytes.

---

## Requirements

### Requirement 1: Plugin Package Layout and Activation Gates

**User Story:** As a Hermes user, I want both halves of the plugin to default to off so that I consciously enable the content workbench when I need it, without it activating automatically on install.

#### Acceptance Criteria

1. THE Plugin SHALL be delivered as a unified package at `~/.hermes/plugins/hermes-media-desk/` containing exactly `plugin.yaml`, `__init__.py`, `dashboard/manifest.json`, `dashboard/plugin_api.py`, and `desktop/plugin.js`.
2. THE Plugin SHALL declare `defaultEnabled: false` in `plugin.yaml` so the Python backend half defaults to off.
3. THE Desktop_JS SHALL export a `HermesPlugin` with `id: 'hermes-media-desk'` and `defaultEnabled: false` so the Desktop half defaults to off independently.
4. IF the Python backend half is enabled via the host application's plugin management interface AND the Desktop half is enabled via the host application's plugin management interface, THEN THE Plugin SHALL mount the Backend such that requests to `/api/plugins/hermes-media-desk/` receive responses, and SHALL register the Desktop_JS route such that `/media-desk` resolves in the UI.
5. IF the Python backend half is disabled, THEN THE Desktop_JS SHALL surface an error response from `ctx.rest()` calls without throwing an unhandled exception, and the Desktop UI SHALL remain in a rendered state.
6. IF the Python backend half is disabled AND the Desktop_JS receives an error response from a `ctx.rest()` call, THEN THE Desktop_JS SHALL display a notice indicating that the plugin backend is off.
7. THE Plugin SHALL declare plugin id `hermes-media-desk` consistently in `plugin.yaml`, `dashboard/manifest.json`, and the Desktop_JS export.

---

### Requirement 2: State Persistence and Migration

**User Story:** As a user, I want my content ideas, productions, and settings to persist across app restarts and survive plugin updates, so I never lose work.

#### Acceptance Criteria

1. THE Store SHALL be stored at `plugin_data_dir("hermes-media-desk")/state.json`; this path is profile-scoped and survives plugin updates.
2. WHEN any operation first accesses the `plugin_data_dir("hermes-media-desk")/files/` directory, THE Backend SHALL create it if it does not already exist.
3. WHILE two Backend processes are running simultaneously (web and desktop halves), THE Backend SHALL check the file `mtime` before each read and re-read the Store file when `mtime` has changed since the last read.
4. THE Backend SHALL serialize all Store writes through an async task queue so that concurrent writes within the same process do not overwrite each other.
5. WHEN writing the Store, THE Backend SHALL write to a temporary file named `state.json.<pid>.tmp` and atomically rename it to `state.json` so that a crash mid-write does not corrupt the file.
6. THE Settings_Store SHALL be stored at `plugin_data_dir("hermes-media-desk")/settings.json` with file permissions `0o600`; writes SHALL use the same tmp-and-rename strategy.
7. WHEN `state.json` does not exist on first run, THE Backend SHALL write the seed state (Requirement 11) as the initial Store content.
8. WHEN loading the Store, THE Backend SHALL run `migrateState` to apply forward migrations before returning state to callers; IF `migrateState` throws an error, THEN THE Backend SHALL surface an error indicating migration failure and SHALL NOT return partial or unmigrated state to callers.
9. IF `state.presetVersion` is absent, null, or below the current `PRESET_VERSION`, THEN THE Backend SHALL apply `migratePresets`, replacing any preset entries whose template ids are no longer supported and adding any missing built-in Presets.
10. IF `state.json` exists but cannot be parsed as valid JSON on load, THEN THE Backend SHALL discard it, write the seed state (Requirement 11) as the new Store content, and surface an error indicating that the previous state was unreadable and has been reset.

---

### Requirement 3: Settings Schema and Validation

**User Story:** As a user, I want to configure image generation and language preferences through the plugin settings page, with clear error messages when my inputs are invalid.

#### Acceptance Criteria

1. THE Settings_Store SHALL contain the following fields with these exact defaults:
   - `image.source = "http"`, `image.baseUrl = ""`, `image.model = ""`, `image.apiKey = ""` (stored as a `secret` type in Config_Schema and read with `get_secret()`), `image.size = "1536x1024"`, `image.quality = ""`, `image.toolSize = "1536x1024"`, `image.toolQuality = ""`, `image.extra = ""`;
   - `assistant.provider = ""`, `assistant.model = ""`;
   - `voice = ""`, `exportDir = ""`, `imageCount = 2`, `shotCount = 6`, `language = "auto"`.
2. WHEN a settings update is received, THE Backend SHALL clamp `imageCount` to the integer range 0–4 and `shotCount` to the integer range 0–12; if the incoming value is not a finite number, THE Backend SHALL retain the current stored value, or apply the schema default (2 for `imageCount`, 6 for `shotCount`) if no stored value exists.
3. IF `image.source` is set to a value other than `"http"` or `"tool"`, THEN THE Backend SHALL return HTTP 400 with an error message indicating the accepted values.
4. IF `image.baseUrl` is set to a non-empty string that does not start with `http://` or `https://`, THEN THE Backend SHALL return HTTP 400 with an error message indicating the required URL prefix.
5. IF `image.extra` is set to a non-empty string that is not a valid JSON object (not an array), THEN THE Backend SHALL return HTTP 400 with an error message indicating that the value must be a JSON object.
6. IF `assistant.provider` is set without `assistant.model`, or vice versa, THEN THE Backend SHALL return HTTP 400 with an error message stating that both fields must be set together.
7. WHEN `image.source` is set to `"tool"`, THE Backend SHALL report image generation as ready if and only if a provider is registered via `ctx.register_image_gen_provider()`; WHEN `image.source` is set to `"http"`, THE Backend SHALL report image generation as ready if and only if `image.baseUrl`, `image.model`, and `image.apiKey` are all non-empty strings.
8. THE Backend SHALL never return the raw `image.apiKey` value in any API response; the `GET settings` route SHALL return `hasKey: bool` (true if `apiKey` is non-empty) and `keyHint: str` (the last 4 characters of `apiKey` if its length is 4 or more, otherwise an empty string).
9. WHEN the language setting is updated to a value not in `["auto", "zh", "en"]`, THE Backend SHALL ignore the value and retain the current stored value, or apply the schema default `"auto"` if no stored value exists.
10. IF `toolSize` is set to a non-empty value not in `["1024x1024", "1024x1536", "1536x1024", "auto"]`, THEN THE Backend SHALL return HTTP 400 with an error message indicating the accepted values.
11. IF `toolQuality` is set to a non-empty value not in `["low", "medium", "high", "auto"]`, THEN THE Backend SHALL return HTTP 400 with an error message indicating the accepted values.

---

### Requirement 4: Content Statuses, Kinds, and Platform Vocabulary

**User Story:** As a user, I want a consistent vocabulary for content status, kind, and platform so that filters, ops, and the UI always agree on valid values.

#### Acceptance Criteria

1. THE Backend SHALL recognize exactly the following content statuses: `idea`, `outline`, `draft`, `ready`, `published`.
2. THE Backend SHALL recognize exactly the following content kinds: `image`, `video`, `web`, `quote`, `note`.
3. THE Backend SHALL recognize exactly the following platform values: `WeChat`, `Xiaohongshu`, `Douyin`, `Bilibili`, `Channels`, `TikTok`, `Instagram`, `YouTube`, `X`.
4. WHEN an Op sets an `item.status` field to a value not in the statuses list, THE Backend SHALL reject the entire Op without applying any changes and SHALL include an error message indicating the invalid status value in the response `errors` array.
5. WHEN an Op sets an `item.kind` field to a value not in the kinds list, THE Backend SHALL reject the entire Op without applying any changes and SHALL include an error message indicating the invalid kind value in the response `errors` array.
6. WHEN an Op sets an `item.platform` field to a non-null value not in the platforms list, THE Backend SHALL reject the entire Op without applying any changes and SHALL include an error message indicating the invalid platform value in the response `errors` array; an `item.platform` field set to `null` SHALL be accepted and stored as `null`.
7. WHEN an item transitions to `published` status and `publishedAt` is not already set, THE Backend SHALL set `publishedAt` to the current UTC timestamp in ISO 8601 format.
8. WHEN an item transitions away from `published` status, THE Backend SHALL delete `publishedAt`.
9. WHEN `scheduledAt` is set to a valid datetime on an item whose status is not `published`, THE Backend SHALL set the item status to `ready` if the current status is `ready` or `draft`; otherwise THE Backend SHALL set the item status to `outline`.
10. WHEN `scheduledAt` is set to `null` on an item whose status is `ready` and whose status was not explicitly set by the Op, THE Backend SHALL set the item status to `draft`; IF the item status is `outline` and was not explicitly set by the Op, THE Backend SHALL set the item status to `idea`.

---

### Requirement 5: Ops — The Sole Write Path

**User Story:** As a developer integrating with the plugin, I want all state mutations to go through a single validated ops pipeline so that the data model stays consistent and all changes are auditable.

#### Acceptance Criteria

1. THE Backend SHALL expose exactly the following 25 ops: `add_item`, `update_item`, `delete_item`, `schedule_item`, `set_status`, `save_draft`, `update_production`, `add_person`, `update_person`, `delete_person`, `add_angle`, `update_angle`, `delete_angle`, `add_style`, `update_style`, `delete_style`, `set_style`, `add_skill`, `update_skill`, `delete_skill`, `add_metric`, `add_account`, `update_account`, `delete_account`, `clear_samples`.
2. WHEN an op's `op` field names a handler not in the list above, THE Backend SHALL append a descriptive error string to the response `errors` array and continue processing remaining ops in the submitted list.
3. THE Backend SHALL process a list of ops sequentially; IF an op produces a validation error or an unhandled exception, THEN THE Backend SHALL record that failure in the `errors` array and proceed to execute the next op without aborting the pipeline.
4. THE Backend SHALL ignore any field on an op payload that is not in the documented field set for that op type; only fields in the documented field set for each op type SHALL be read and applied to state.
5. WHEN `add_item` receives an item payload where `title`, `body`, and `media` are all absent or empty, THE Backend SHALL append a descriptive error string to the response `errors` array for that op and leave state unchanged for that op.
6. WHEN `delete_item` removes an item, THE Backend SHALL also remove all metrics referencing that item; IF the deleted item has direct child items with no other parent, THEN THE Backend SHALL set those children's `parentId` to `null`; IF the deleted item has direct child items that have another valid parent, THEN THE Backend SHALL leave those children's `parentId` unchanged.
7. THE Backend SHALL validate URL fields by checking that the value begins with `http://` or `https://`; any value that does not pass this check SHALL be stored as `null`.
8. THE Backend SHALL validate date fields by checking that the value is a string parseable as a valid calendar date; invalid date strings SHALL be stored as `null`.
9. THE Backend SHALL coerce text fields to their maximum byte lengths: `title` to 40,000 bytes, `body` to 40,000 bytes, `article` to 200,000 bytes, and prompt fields to 1,200 bytes; values exceeding the limit SHALL be truncated at the byte boundary nearest to the limit without producing invalid characters.
10. WHEN `add_item` is submitted with no explicit `pos` field and no `parentId`, THE Backend SHALL assign a `pos` value that is unique among existing top-level items and positions the new item so it does not overlap any existing top-level item.
11. THE Backend SHALL return a response body of the shape `{ receipts: Array<{ text: string, target?: string, kind?: string }>, errors: string[], state: object }` for the ops POST route; `receipts` and `errors` SHALL each be present as empty arrays when there are no entries.
12. WHEN two ops in the same request do not read or write any overlapping state keys, THE Backend SHALL produce identical `receipts` and `errors` entries for each of those ops regardless of their order in the submitted list.

---

### Requirement 6: Undo — Three-Way Merge

**User Story:** As a user, I want to undo recent changes without accidentally reverting unrelated edits made in between, so that undoing "change style" does not erase a production I generated afterward.

#### Acceptance Criteria

1. THE Backend SHALL maintain an in-memory undo stack with a maximum of 30 Undo_Entry records.
2. IF the undo stack already contains 30 entries when a new Undo_Entry is pushed, THEN THE Backend SHALL discard the oldest entry before inserting the new one.
3. WHEN a mutating op produces a state change (before-JSON ≠ after-JSON), THE Backend SHALL push a new Undo_Entry containing the label, the before-JSON snapshot, and the after-JSON snapshot; operations that produce no change SHALL NOT push an entry.
4. IF an op is submitted with `undoable: false`, THEN THE Backend SHALL NOT push any Undo_Entry for that call.
5. WHEN `undoLast` is called with a non-empty stack, THE Backend SHALL apply three-way merge revert — recursing into nested plain objects — where for each key at every level of nesting, the Backend reverts that key only if the current value equals the after-snapshot value; keys whose current value differs from the after-snapshot value SHALL be preserved; THE Backend SHALL then return `{ label, state, canUndo }` where `label` is the label of the reverted entry, `state` is the resulting merged state, and `canUndo` reflects whether the stack is non-empty after the pop.
6. WHEN three-way merge revert encounters a keyed array (every element is an object with a string `id` field), THE Backend SHALL revert element-by-element using the same three-way merge logic, re-inserting deleted rows at their original index positions, and removing rows that were added in that step.
7. WHEN three-way merge revert encounters a non-keyed array whose length in the current snapshot equals its length in the after-snapshot, THE Backend SHALL revert element-by-element using the same three-way merge logic; IF the lengths differ, THEN THE Backend SHALL preserve the current array value unchanged.
8. WHEN `undoLast` is called with an empty stack, THE Backend SHALL return `{ label: null, state, canUndo: false }` without modifying state.
9. IF `before` equals `after` for any `(before, after, current)` triple passed to `revertChange`, THEN THE `revertChange` function SHALL return `current` unchanged (identity property).
10. IF `current` equals `after` for any `(before, after, current)` triple passed to `revertChange`, THEN THE `revertChange` function SHALL return a value that deep-equals `before` (round-trip property).

---

### Requirement 7: One-Click Production Pipeline

**User Story:** As a content creator, I want to click one button and have the system concurrently generate a full article, cover image, figures, and storyboard shots from my idea, so I can review a complete draft without manual coordination.

#### Acceptance Criteria

1. WHEN `produce` is POST-ed with an item `id`, THE Backend SHALL start the pipeline in a background task and return `{ started: true, state }` within 500 ms without waiting for pipeline completion.
2. IF a pipeline is already running for the same item `id` when `produce` is POST-ed, THEN THE Backend SHALL return `{ started: false, state }` without starting a new pipeline run.
3. WHEN the pipeline starts, THE Backend SHALL run the Plan stage first by invoking `ctx.llm.acomplete()` with `light: true` and an `AbortSignal.timeout` of 240 000 ms.
4. IF the Plan stage LLM call fails or times out, THEN THE Backend SHALL fall back to `fallbackPlan()` and continue the pipeline without propagating the error to the item.
5. THE Backend SHALL normalize the Plan output: truncate all text fields to their maximum lengths, slice `images` to `imageCount` items, slice `shots` to `shotCount` items, and fill missing images/shots from the fallback plan to maintain the configured counts.
6. AFTER the Plan stage completes, THE Backend SHALL write `production.stage = "making"`, `production.status = "running"`, and all plan fields to the Store before starting concurrent tasks.
7. WHEN the Plan stage completes, THE Backend SHALL run the article-writing LLM call with an `AbortSignal.timeout` of 240 000 ms and all image-generation tasks concurrently, using at most 3 simultaneous image workers.
8. THE Backend SHALL write each Asset to Files_Dir immediately after it is generated and update the corresponding Asset's `src` and `status` in the Store without waiting for other Assets to complete.
9. WHEN an image-generation HTTP call returns HTTP 429, THE Backend SHALL wait 6 000 ms before the first retry and 14 000 ms before the second retry; IF the call still fails after 2 retries, THEN THE Backend SHALL mark the Asset `status: "failed"` and continue.
10. IF an image-generation call fails with any error other than HTTP 429 or a network timeout, THEN THE Backend SHALL mark the Asset `status: "failed"` immediately without retrying.
11. WHEN the pipeline completes successfully, THE Backend SHALL set `production.status = "done"`, `production.stage = "done"`, and `production.finishedAt`; IF the item's prior workflow status was `idea` or `outline`, THEN THE Backend SHALL advance it to `draft`; IF the item's prior workflow status was `draft`, THEN THE Backend SHALL advance it to `ready`.
12. WHEN the pipeline is cancelled (via `produce/cancel`), THE Backend SHALL abort the LLM and image signals, set `production.status = "cancelled"`, and set all pending/running Assets to `status: "idle"`.
13. WHEN the Backend restarts, THE Backend SHALL call `settleAll()` on the first `GET state` request; IF items with `production.status = "running"` are found, THEN THE Backend SHALL mark those productions `failed` with an error message indicating the pipeline was interrupted and set all running/pending Assets to `status: "idle"`.
14. THE Backend SHALL assemble image prompts by prepending the cover style directive to cover prompts, the figure style directive to figure prompts, and the storyboard style directive to shot prompts; none of these prompts SHALL contain text, letters, logos, or captions.
15. WHEN `imageCount = 0` and `shotCount = 0`, THE Backend SHALL run only the article task and skip all image-generation workers.

---

### Requirement 8: Image Generation — HTTP and Provider Modes

**User Story:** As a user, I want to connect either my own OpenAI-compatible image API endpoint or a registered provider, so I am not locked in to a single image service.

#### Acceptance Criteria

1. WHEN `image.source = "http"`, THE Backend SHALL call the endpoint at `{image.baseUrl}/images/generations` with a POST body `{ model, prompt, n: 1, size?, quality?, ...extra }` and the `Authorization: Bearer {apiKey}` header.
2. IF the image generation response contains `data[0].b64_json`, THEN THE Backend SHALL base64-decode it to bytes; IF the response contains `data[0].url` or `images[0].url`, THEN THE Backend SHALL download the URL to obtain bytes.
3. WHEN the image response contains a relative URL, THE Backend SHALL attempt, in order: a prefix-stripped variant, a mount-path-prefixed variant, and the site-root-prefixed variant derived from `image.baseUrl`; IF all candidate URLs fail to resolve to downloadable content, THEN THE Backend SHALL return an error indicating the image URL could not be resolved.
4. WHEN the image response URL is on the same origin as `image.baseUrl`, THE Backend SHALL download it with the same `Authorization` header; otherwise THE Backend SHALL apply SSRF_Check before downloading.
5. IF the size of downloaded image bytes exceeds 40 000 000 bytes, THEN THE Backend SHALL reject the image and return an error indicating the image exceeds the maximum allowed size.
6. IF the downloaded image bytes do not match the magic bytes for PNG, JPEG, WebP, or GIF, THEN THE Backend SHALL reject the image and return an error indicating the image format is not supported.
7. IF an image generation HTTP call has not completed within 300 seconds, THEN THE Backend SHALL cancel the request and return an error indicating the image generation request timed out.
8. WHEN `image.source = "tool"`, THE Backend SHALL delegate image generation to the provider registered via `ctx.register_image_gen_provider()`; IF no provider has been registered, THEN THE Backend SHALL return an error indicating no image generation provider is available.
9. IF `image.source = "http"` and the endpoint returns HTTP 401 or 403, THEN THE Backend SHALL treat the error as permanent and SHALL NOT retry.
10. IF `image.source = "http"` and the endpoint returns HTTP 404, THEN THE Backend SHALL treat the error as permanent and SHALL NOT retry.
11. WHEN the `settings/test` POST route is called with a valid image provider configuration, THE Backend SHALL generate a single test image with the prompt "A single paper boat on calm water, black and white pencil line art sketch, plain white paper background, no text." and return `{ src: "media-desk/files/<name>" }` on success; IF image generation fails, THEN THE Backend SHALL return an error indicating the test image generation failed.

---

### Requirement 9: HTTP Backend Routes and Security

**User Story:** As a frontend developer, I want a well-defined set of REST routes with consistent security controls so that the Desktop_JS can reliably read and write plugin state.

#### Acceptance Criteria

1. THE Backend SHALL expose the following GET routes: `state`, `production`, `settings`, `models`, `insights`, `monid/status`, `assets/<filename>`, `files/<filename>`.
2. THE Backend SHALL expose the following POST routes: `upload`, `ops`, `undo`, `chat`, `chat/clear`, `produce`, `produce/cancel`, `produce/regen`, `produce/save`, `produce/reveal`, `style/extract`, `monid/import`, `settings`, `settings/test`, `capture-url`, `account/refresh`, `skills/learn`, `skills/export`.
3. WHEN a POST request arrives with a `Sec-Fetch-Site` header that is present and whose value is neither `"same-origin"` nor `"none"`, THE Backend SHALL return HTTP 403 without processing the request; WHEN the `Sec-Fetch-Site` header is absent, THE Backend SHALL treat it the same as a disallowed value and return HTTP 403.
4. THE Backend SHALL enforce a JSON_Body_Limit of 4 000 000 bytes on all POST routes listed in criterion 2 except `upload`; requests exceeding this limit SHALL receive HTTP 413.
5. THE Backend SHALL enforce an Upload_Limit of 250 000 000 bytes on the `upload` POST route; requests exceeding this limit SHALL receive HTTP 413.
6. THE `upload` route SHALL accept only the MIME types `image/jpg`, `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `video/quicktime`; other content types SHALL receive HTTP 415.
7. WHEN serving `files/<filename>` or `assets/<filename>`, THE Backend SHALL validate that `filename` matches `/^[\w.-]+$/` before constructing the filesystem path; invalid names SHALL receive HTTP 400.
8. WHEN a `files/<filename>` or `assets/<filename>` request includes a `Range` header, THE Backend SHALL return HTTP 206 with the requested byte range, a `Content-Range` header, and an `Accept-Ranges: bytes` header; WHEN no `Range` header is present, THE Backend SHALL return HTTP 200 with the full file content and an `Accept-Ranges: bytes` header.
9. THE Backend SHALL serve files with `Cache-Control: private, max-age=3600` and `X-Content-Type-Options: nosniff`.
10. WHEN the first `GET state` request is received after Backend startup, THE Backend SHALL call `settleAll()` before returning state.
11. THE Backend SHALL return all JSON responses for routes listed in criteria 1 and 2 with `Cache-Control: no-store`.
12. WHEN any Backend route handler throws an unhandled exception, THE Backend SHALL return HTTP 500 with `{ "error": <message> }` where `<message>` does not expose stack traces or internal file paths; WHEN a handler raises a known client error, THE Backend SHALL return the appropriate 4xx status code with `{ "error": <message> }`.

---

### Requirement 10: Chat and Revision

**User Story:** As a content creator, I want to ask the AI assistant to modify my production's title, article, cover, figures, or shots in a conversational way, with receipts telling me exactly what changed.

#### Acceptance Criteria

1. WHEN the `chat` POST route receives a non-empty `message`, THE Backend SHALL call `ctx.llm.acomplete()` with the chat system and user prompts and extract a JSON reply containing `reply`, `ops`, `revise`, and `actions` fields.
2. IF the LLM call fails, returns non-JSON, or returns JSON that is missing one or more of the required fields `reply`, `ops`, `revise`, or `actions`, THEN THE Backend SHALL fall back to `localIntent()` rule-based parsing and include an `outageNotice` in the response.
3. IF the chat response contains a non-empty `ops` array, THEN THE Backend SHALL apply those `ops` through the same `applyOps` pipeline as the `ops` route, returning receipts and errors in the chat response.
4. WHEN `focusId` refers to an item whose `production.status` equals `"done"`, THE Backend SHALL apply a `revise` object from the chat response to the production: updating `title`, `coverText`, `article` (via `edits` when the `revise` object contains an `edits` field, or via full replacement otherwise), `cover.prompt`, `images[n].prompt`, and `shots[n].prompt`.
5. IF `focusId` refers to an item whose `production.status` is not `"done"` and the chat response contains a non-empty `revise` object, THEN THE Backend SHALL ignore the `revise` object and include an indication in the response that revision is only available for completed productions.
6. WHEN a revision updates an Asset prompt, THE Backend SHALL add that Asset to a list of `targets` and, after committing the revision to the Store, SHALL start background re-generation tasks for those Assets if image generation is configured.
7. IF `actions` contains a `produce` action for an item whose `production.status` equals `"done"`, THEN THE Backend SHALL filter out that `produce` action before executing `actions`.
8. THE Backend SHALL persist each chat turn (user and assistant messages) to `state.chat` and trim the array to the most recent 300 messages.
9. IF a chat turn produced one or more receipts, THEN THE Backend SHALL include `undoable: true` in the assistant message; otherwise THE Backend SHALL include `undoable: false`.
10. THE `chat` response SHALL include `{ answer, actions, targets, state, modelOk, modelError }`, where `modelOk` is `true` if the LLM call succeeded and returned a valid parseable response and `false` otherwise, and `modelError` is a string describing the failure when `modelOk` is `false` or `null` when `modelOk` is `true`.
11. WHEN the `chat/clear` POST route is called, THE Backend SHALL reset `state.chat` to an empty array and return the updated state.
12. WHEN a chat turn is submitted with a `focusId`, THE Backend SHALL scope history to messages with the same `itemId` and pass the last 8 such messages to the LLM prompt.

---

### Requirement 11: Sample Data and Seed

**User Story:** As a new user, I want a rich set of sample content ideas, personas, angles, skills, and styles to explore the workbench immediately, with the ability to clear all sample data at once when I am ready to start with my own content.

#### Acceptance Criteria

1. WHEN the Store is first created and no records with `sample: true` already exist, THE Backend SHALL write exactly 25 sample items (all with `sample: true`), 8 angles, 4 personas, 3 skills, 4 accounts, decaying daily-view metrics for 4 published items, and 15 Style Presets.
2. THE Backend SHALL mark all seed records with `sample: true`; WHEN an op updates a sample record, THE Backend SHALL preserve the `sample: true` flag on that record.
3. WHEN the `clear_samples` op is executed, THE Backend SHALL remove all records with `sample: true` from `items`, `people`, `angles`, `metrics`, `accounts`, `skills`, and `styles` and return a receipt indicating the number of records deleted; IF no sample records exist, THE Backend SHALL treat the op as a no-op and return a receipt indicating zero records were deleted.
4. WHEN the `clear_samples` op completes, THE Backend SHALL set `state.sampleCleared = true` so that subsequent sample localization calls are skipped.
5. WHEN `GET state` is called and `state.sampleCleared` is false and the current UI language differs from `state.sampleLang`, THE Backend SHALL run `localizeSamples` to swap the text of sample records to the target language; IF a sample record field value differs from the original sample template text, THE Backend SHALL treat that field as user-edited (tracked via a per-field `userEdited: true` flag) and SHALL NOT overwrite it.
6. WHEN the Store is first seeded, THE Backend SHALL store bilingual (zh and en) copies of each sample record's `title`, `body`, `tags`, `source`, `media`, `production`, and `drafts` fields under `item.otherLang`; WHEN language changes and `localizeSamples` runs, THE Backend SHALL restore the target-language copy for each field not marked `userEdited: true`.
7. THE Backend SHALL seed exactly 15 Style Presets with the following `id` values: `ai_tech`, `gadget`, `travel`, `food`, `vlog`, `home`, `reading`, `career`, `tutorial`, `business`, `beauty`, `outfit`, `story`, `parent`, `news`.
8. THE 15 Style Presets SHALL be organized under exactly 8 category strings: `Tech & Gadgets`, `Travel & Food`, `Vlog & Lifestyle`, `Insights & Thoughts`, `Tutorials`, `Reviews`, `Stories`, `Trending News`.
9. WHEN generating seed metrics, THE Backend SHALL produce decaying daily-view metrics for 4 specific published items using the formula `views ≈ peak * exp(-day * 0.55) * jitter` for 9 days after publication, where `jitter` is a uniform random factor in [0.80, 1.20]; `likes` SHALL be 8% of `views`, `comments` SHALL be 2%, `shares` SHALL be 3%, and `saves` SHALL be 5%.
10. WHEN `GET state` is called and the UI language is zh, THE Backend SHALL return the zh text for all Preset text fields (`name`, `summary`, `tone`, `sentences`, `opening`, `structure`, `words`, `avoid`, `samples`, `source`); WHEN the UI language is en, THE Backend SHALL return the en text; Preset text fields that differ from their original template value SHALL be tracked via a per-field `userEdited: true` flag and SHALL NOT be overwritten on language change.

---

### Requirement 12: Style Cards and Writing Rules

**User Story:** As a content creator, I want to maintain a library of writing styles and rules that the AI uses when generating articles, so my content has a consistent voice.

#### Acceptance Criteria

1. WHEN an article-writing or planning LLM prompt is assembled and `state.activeStyleId` is set to a valid Style_Card id, THE Backend SHALL inject a `<voice>` block containing that Style_Card's tone, sentence patterns, sample phrases, and avoid list into the prompt.
2. IF `state.activeStyleId` is not set or does not match any stored Style_Card, THEN THE Backend SHALL assemble the LLM prompt without a `<voice>` block.
3. WHEN an article-writing or planning LLM prompt is assembled and at least one active or exported Skill exists, THE Backend SHALL prepend a mandatory rules block containing all active and exported Skills before the `<voice>` block in the prompt.
4. WHEN `style/extract` is POST-ed with one or more URLs or a text body, THE Backend SHALL fetch each URL using SSRF_Check (1.5 MiB limit, 8 s timeout, 4-redirect limit), concatenate the extracted text, call `ctx.llm.acomplete()` to extract style fields, and upsert a Style_Card.
5. IF any URL in a `style/extract` request fails the SSRF_Check or cannot be fetched within the defined limits, THEN THE Backend SHALL return an error response indicating which URLs failed, without creating or updating any Style_Card.
6. WHEN `style/extract` succeeds, THE Backend SHALL set `state.activeStyleId` to the new Style_Card's id.
7. WHEN `style/extract` is called with an `accountKey`, THE Backend SHALL update the existing Style_Card with that `accountKey` rather than creating a duplicate.
8. IF the total character count of the text material provided for style extraction is fewer than 80 characters, THEN THE Backend SHALL return HTTP 400 with an error message indicating that the provided text is too short for style extraction.
9. THE `add_style`, `update_style`, and `delete_style` ops SHALL manage user-created Style_Cards; `set_style` SHALL update `state.activeStyleId`.
10. WHEN the `skills/learn` route is called, THE Backend SHALL analyze `state.metrics` and existing items to propose no more than 10 new Skill rules, and SHALL insert each proposed Skill with `status: "proposed"`.
11. WHEN the `skills/export` route is called and at least one active or non-sample Skill exists, THE Backend SHALL write a `media-desk-voice/SKILL.md` file under the Hermes skills root directory, assembling all active and non-sample Skills into a markdown skill document.
12. IF the `skills/export` route is called and no active or non-sample Skills exist, THEN THE Backend SHALL return an error response indicating that there are no Skills available to export.
13. WHEN `skills/export` completes successfully, THE Backend SHALL update all exported Skills to `status: "exported"` in the Store.

---

### Requirement 13: Monid Social Account Import

**User Story:** As a social media creator, I want to import my posts from Xiaohongshu, Douyin, Bilibili, TikTok, Instagram, and X using the Monid CLI so that my content history feeds the insights and style extraction features.

#### Acceptance Criteria

1. THE Backend SHALL invoke the Monid CLI as a child process with arguments passed as an array (no shell interpolation); arguments received from request bodies SHALL NOT be passed to the shell.
2. THE Backend SHALL locate the Monid CLI by scanning `PATH`, common install directories (`/opt/homebrew/bin`, `~/.npm-global/bin`, `~/.local/bin`, `~/.volta/bin`, `~/.bun/bin`), and by querying the login shell if not found in `PATH`.
3. WHERE the runtime platform is Windows, THE Backend SHALL resolve `.cmd` shims to their underlying Node.js entry file and invoke `node <entry.js>` directly with `ELECTRON_RUN_AS_NODE=1`.
4. WHILE a `monid/import` operation is in progress, IF a second `monid/import` request is received, THEN THE Backend SHALL return HTTP 409 without starting a new import.
5. THE Backend SHALL import at most 20 posts per account per call (the `POST_COUNT` constant).
6. THE Backend SHALL normalize post fields from each platform (Xiaohongshu, Douyin, Bilibili, TikTok, Instagram, X) into a common schema: `id`, `title`, `body`, `publishedAt`, `url`, `cover`, `views`, `likes`, `comments`, `saves`, `shares`; any field absent or null in the platform response SHALL be set to `null` in the normalized record.
7. THE Backend SHALL upsert imported posts using the key `{platform}:{post.id}`; on re-import, the Backend SHALL update `views`, `likes`, `comments`, `saves`, and `shares` metrics but SHALL NOT overwrite `title` or `body` fields that differ from the last-imported value, treating any divergence as a user edit.
8. THE Backend SHALL download cover images for newly imported posts concurrently (up to 4 workers), with a per-image download timeout of 10 seconds, and store them in Files_Dir; IF a cover image download fails or times out, THEN THE Backend SHALL skip that cover and continue the import without failing.
9. IF the concatenated text of all imported posts for the account is at least 80 characters long, THEN THE Backend SHALL attempt to extract a Style_Card from that text; IF Style_Card extraction fails, THEN THE Backend SHALL record the error in `styleError` and continue without failing the import.
10. WHEN `monid/import` returns, the response SHALL include `{ platform, nickname, count, added, cost, styleName, styleError, state }` where `state` is one of `"done"`, `"partial"`, or `"error"`.
11. THE `monid/status` GET route SHALL return one of `{ state: "missing" }`, `{ state: "nokey" }`, `{ state: "error", message }`, or `{ state: "ready", balance? }` by running `monid balance -j`.
12. IF the account URL from the request body is not recognized as a valid URL for one of the supported platforms (Xiaohongshu, Douyin, Bilibili, TikTok, Instagram, X) or is not an HTTP/HTTPS URL, THEN THE Backend SHALL return HTTP 400 with an error message indicating the reason for rejection.
13. WHEN a short link (from `xhslink.com`, `v.douyin.com`, `b23.tv`, `vm.tiktok.com`, `vt.tiktok.com`) is provided, THE Backend SHALL follow redirects up to a maximum of 4 hops, applying SSRF_Check at each hop, with a per-hop timeout of 5 seconds, to resolve the canonical account URL; IF any hop fails SSRF_Check, THEN THE Backend SHALL abort redirect resolution and return HTTP 400 with an error message indicating the blocked URL; IF the canonical URL is not resolved within 4 hops, THEN THE Backend SHALL return HTTP 400 with an error message indicating that the redirect limit was exceeded.
14. IF the Monid CLI executable is not found during a `monid/import` request, THEN THE Backend SHALL return HTTP 503 with an error message indicating that the CLI is unavailable, without starting an import.

---

### Requirement 14: Content Export

**User Story:** As a content creator, I want to save my finished production to a folder on disk so that I can upload the article, cover, and storyboard files to my publishing tools.

#### Acceptance Criteria

1. THE `produce/save` POST route SHALL create a folder named after `production.title` sanitized by removing the characters `\ / : * ? " < > |` and replacing any resulting empty name with the production's id, inside `exportDir`; IF a folder with that name already exists, THE Backend SHALL overwrite its contents.
2. THE Backend SHALL copy each Asset's binary file from Files_Dir into the export folder using the following names: `cover-original.<ext>` (zh) / `cover-original.<ext>` (en), `video-cover.jpg` / `video-cover.jpg`, `N.<ext>` / `figure-N.<ext>`, `NN.<ext>` / `shot-NN.<ext>`; IF any Asset file is missing from Files_Dir when export begins, THE Backend SHALL abort the export, delete any partially written export folder, and return HTTP 500 with an error indicating which file was missing.
3. THE Backend SHALL write a Markdown script file (`script.md` zh / `script.md` en) containing the production article with figure images embedded immediately after each matching `##` heading line using the syntax `![figure-N](./figure-N.<ext>)`.
4. WHEN `production.shots` is non-empty, THE Backend SHALL write a storyboard Markdown file (`script.md` zh / `storyboard.md` en) containing a table with columns: shot number, shot size, duration, visual description, voice-over, and frame image.
5. WHEN a `videoCover` JPEG is included in the `produce/save` request body (as a data URI `data:image/jpeg;base64,...`), THE Backend SHALL validate the JPEG magic bytes (`0xFF 0xD8`) and write it to `video-cover.jpg` / `video-cover.jpg` in the export folder.
6. IF the request `videoCover` data URI is present but fails JPEG magic byte validation, THEN THE Backend SHALL return HTTP 400.
7. THE `produce/save` response SHALL include `{ path, files: [filename, ...], state: "saved" }`.
8. WHEN the `produce/reveal` POST route is called, THE Backend SHALL open the saved export folder in the OS file manager (Finder, Explorer, or `xdg-open`) using the path stored in `production.savedPath`.
9. THE Backend SHALL resolve `exportDir` by expanding the `~/` prefix against the system home directory.
10. IF `exportDir` is empty, THEN THE Backend SHALL use `~/Documents/Media Desk` (zh) or `~/Documents/Media Desk` (en), preferring `~/Documents/Media Desk` if it already exists regardless of the current language.
11. WHEN `production.article` is empty, THE `produce/save` route SHALL return HTTP 400.
12. IF the `produce/reveal` route is called and `production.savedPath` is null, empty, or unset, THEN THE Backend SHALL return HTTP 400 with an error indicating the production has not been saved yet.

---

### Requirement 15: Desktop Plugin — Five Pages and Navigation

**User Story:** As a user, I want five clearly labeled pages in the Hermes Desktop sidebar so that I can navigate between my inspiration board, content list, schedule calendar, analytics insights, and style library without confusion.

#### Acceptance Criteria

1. THE Desktop_JS SHALL register a full-page route at `/media-desk` using `ROUTES_AREA` and a sidebar navigation entry using `SIDEBAR_NAV_AREA` with a codicon drawn from the `@hermes/plugin-sdk` codicon set.
2. THE Desktop_JS SHALL render five named sub-views within the `/media-desk` route: `home` (Inspiration Board), `content` (Content List), `schedule` (Schedule / Calendar), `insights` (Analytics / Insights), and `style` (Style Library).
3. THE Desktop_JS SHALL register a Settings page via `ctx.registerSettingsPage()` containing individually configurable controls for: image generation source and endpoint, language preference, voice sample, export directory, `imageCount`, and `shotCount`.
4. WHEN the Desktop_JS unloads or is disabled, THE Desktop_JS SHALL dispose all registered contributions, timers created with `ctx.setInterval`, and event subscriptions registered via `ctx.onEvent`.
5. THE Desktop_JS SHALL load initial state by calling `ctx.rest('/state')` on mount.
6. IF the `ctx.rest('/state')` call on mount fails, THEN THE Desktop_JS SHALL display an error state indicating that the backend could not be reached and SHALL NOT render the main UI content.
7. WHEN the Desktop_JS receives a `plugin.hermes-media-desk.state.changed` push event, THE Desktop_JS SHALL call `ctx.rest('/state')` to refresh local state.
8. THE Desktop_JS SHALL use only theme variables (`var(--ui-*)`) for colors and SHALL NOT hardcode any color values including hex, rgba, or named CSS color literals.
9. THE Desktop_JS SHALL import only `@hermes/plugin-sdk`, `react`, and `react/jsx-runtime`; all UI SHALL be authored with `jsx()` / `jsxs()` calls, not JSX syntax.
10. THE Desktop_JS SHALL use `ctx.i18n.register(bundles)` to register zh and en locale bundles; all user-visible strings SHALL be resolved through `ctx.i18n.t(key, ...args)`.
11. WHEN the Desktop_JS is loaded or hot-reloaded, THE Desktop_JS SHALL restore the active sub-view, filters, and open item id from `ctx.storage`; IF the stored state is absent or invalid, THEN THE Desktop_JS SHALL default to the `home` sub-view.

---

### Requirement 16: Desktop Plugin — Studio and Production UI

**User Story:** As a content creator, I want an in-Studio view that shows my article, storyboard shots, and generated images side by side with a chat dock, so I can review and refine the production without switching between screens.

#### Acceptance Criteria

1. WHEN the user opens an item that has an associated production, THE Desktop_JS SHALL render a studio view containing: an idea card with an editable title (maximum 200 characters) and style picker, a progress card while `production.status` is `"running"`, a hero tile with cover poster and figure collage, an article tile, and a shots tile.
2. WHILE `production.status` is `"running"` OR any Asset's status is `"pending"` or `"running"`, THE Desktop_JS SHALL poll `GET /production?id=<id>` at 700 ms intervals, replacing each matching field in local state with the value returned by the response on each tick.
3. IF `production.status` is not `"running"` AND no Asset has status `"pending"` or `"running"`, THEN THE Desktop_JS SHALL stop polling.
4. WHILE `production.status` is `"running"`, THE Desktop_JS SHALL display a progress card with four steps: "title and cover text", "script N words", "cover and figures M/total", "shots M/total"; WHILE a step is the currently active step THE Desktop_JS SHALL render a shimmer animation on that step; WHEN a step completes THE Desktop_JS SHALL replace its shimmer with a check icon.
5. THE Desktop_JS SHALL allow the user to select text in the article tile; WHEN a text selection of 4 or more characters is made within the article tile, THE Desktop_JS SHALL display a floating "Ask assistant to edit this" button, and WHEN that button is clicked THE Desktop_JS SHALL pre-populate the chat dock input with the selected text wrapped in block-quote markers as context.
6. WHEN the user activates full-screen on the article tile or the shots tile, THE Desktop_JS SHALL expand that tile to fill the studio bento grid container, animating from the tile's original bounding box to the full container bounds over 250 ms, and SHALL collapse back to the original bounding box over 250 ms when the user presses Escape or activates the collapse control.
7. WHEN the user clicks any Asset image, THE Desktop_JS SHALL render a large-image viewer; WHILE the viewer is open, THE Desktop_JS SHALL navigate to the previous Asset with a `src` on left-arrow key press and to the next Asset with a `src` on right-arrow key press, stopping at the first and last Asset respectively; THE Desktop_JS SHALL display "Re-generate", "Download", and "Ask assistant" actions in the viewer.
8. IF `imageReady` is false, THEN THE Desktop_JS SHALL display a message indicating that no image provider is configured with a link to Settings, and SHALL hide the re-generate controls.
9. WHEN the user finishes editing an inline title field (on blur), THE Desktop_JS SHALL submit an `update_production` op with the new title value, provided the title is between 1 and 200 characters inclusive; WHEN the user finishes editing an inline article field (on blur), THE Desktop_JS SHALL submit an `update_production` op with the new article content.
10. IF an `update_production` op fails, THEN THE Desktop_JS SHALL restore the field to its last successfully saved value and SHALL display an error message indicating the save failed.
11. IF a poll request fails, THEN THE Desktop_JS SHALL retry the request on the next 700 ms tick without displaying an error; IF three consecutive poll requests fail, THEN THE Desktop_JS SHALL stop polling and SHALL display an error message indicating that the production status could not be retrieved.

---

### Requirement 17: Desktop Plugin — Calendar and Schedule View

**User Story:** As a content creator, I want a calendar view that shows my scheduled items so I can visualize my publishing cadence and quickly drag items to new dates.

#### Acceptance Criteria

1. THE Desktop_JS SHALL render a calendar grid for the current month in the `schedule` sub-view, with each day cell showing the titles of items whose `scheduledAt` falls on that day, truncating any title exceeding 40 characters with an ellipsis.
2. WHEN the user navigates to a different month using the previous or next month controls, THE Desktop_JS SHALL re-render the calendar grid to display the selected month's days and their associated scheduled items.
3. THE Desktop_JS SHALL display an "unscheduled" tray below the calendar listing items with no `scheduledAt`, sorted by item creation date in ascending order.
4. WHEN the user assigns or changes a `scheduledAt` date for an item, THE Desktop_JS SHALL dispatch a `schedule_item` op via `ctx.rest('/ops', ...)` with the new ISO 8601 datetime.
5. IF the `schedule_item` op dispatch fails, THEN THE Desktop_JS SHALL display an error message indicating the schedule update did not complete and restore the item to its previous position in the calendar or unscheduled tray.
6. IF a `schedule_item` op provides a non-null `scheduledAt` value and includes a `platform` field, THEN THE Backend SHALL set the item's `platform` to the provided value, overwriting any previously stored `platform`.

---

### Requirement 18: Desktop Plugin — Insights and Analytics

**User Story:** As a content creator, I want to see charts of my content performance metrics so I can identify which topics and styles produce the highest engagement.

#### Acceptance Criteria

1. WHEN the `insights` sub-view is opened, THE Desktop_JS SHALL call `GET /insights` and display view, like, comment, share, and save totals per item.
2. THE Desktop_JS SHALL offer a CSV export of the insights data, generated client-side from the `GET /insights` response.
3. WHEN the user clicks the "Learn rules from data" button, THE Desktop_JS SHALL call `POST /skills/learn`, display a progress indicator while the request is in flight, and display the number of proposed rules returned on success.
4. WHEN the user clicks the "Export Skill" button, THE Desktop_JS SHALL call `POST /skills/export`, display a progress indicator while the request is in flight, and display a message indicating success or failure.
5. WHEN the user submits a URL or text in the account import wizard, THE Desktop_JS SHALL call `POST /monid/import` and display a progress indicator while the request is in flight.
6. WHEN `POST /monid/import` returns, THE Desktop_JS SHALL display the final receipt including nickname, post count, added count, cost, and any style-extraction error.
7. WHEN the account import panel opens, THE Desktop_JS SHALL call `GET /monid/status` and display the connection state (`missing`, `nokey`, `error`, or `ready` with balance).
8. IF the `GET /insights` request fails, THEN THE Desktop_JS SHALL display an error state in the insights view and SHALL retain any previously loaded insights data.
9. IF `POST /skills/learn` or `POST /skills/export` returns an error, THEN THE Desktop_JS SHALL display an error message indicating the operation failed.

---

### Requirement 19: Desktop Plugin — URL Capture and File Upload

**User Story:** As a user, I want to paste a URL or drag a file onto the inspiration board to quickly add web articles and media to my content library.

#### Acceptance Criteria

1. WHEN the user pastes a URL into the inspiration board capture field, THE Desktop_JS SHALL call `POST /capture-url` with the URL.
2. WHEN `POST /capture-url` returns successfully, THE Desktop_JS SHALL dispatch an `add_item` op with the extracted title, description, og:image, and site name fields populated from the response.
3. WHEN the user drops or selects image or video files, THE Desktop_JS SHALL call `POST /upload` for each file (accepted types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/webm`) with the correct `Content-Type` header and enforce a 50 MiB per-file size limit before sending.
4. WHEN `POST /upload` returns successfully, THE Desktop_JS SHALL dispatch an `add_item` op with the returned `src` as `media.src`.
5. THE Backend `capture-url` route SHALL apply SSRF_Check (1.5 MiB body limit, 8 s timeout, 4-redirect maximum) to all fetched URLs, extract title, description, og:image, and site name, and return them to the caller.
6. IF the `capture-url` fetch fails SSRF_Check or times out, THEN THE Backend SHALL return HTTP 400 with an error message indicating why the URL was rejected; THE Desktop_JS SHALL display this error message in the capture field.
7. IF the user attempts to upload a file of an unsupported type or exceeding 50 MiB, THEN THE Desktop_JS SHALL display an error message indicating the rejection reason and SHALL NOT call `POST /upload`.

---

### Requirement 20: Backend Push Events

**User Story:** As a Desktop_JS developer, I want the backend to push state-change notifications so that the UI stays up to date without polling a high-frequency interval.

#### Acceptance Criteria

1. WHEN the Backend completes one of the following operations — an ops-queue mutation, a production-run completion, a settings update, or an asset generation failure — THE Backend SHALL emit a `broadcast_plugin_event("hermes-media-desk", "state.changed", { kind })` event where `kind` is one of `"ops"`, `"produce_completion"`, `"settings_change"`, or `"asset_error"` respectively.
2. WHEN the Desktop_JS receives a `plugin.hermes-media-desk.state.changed` event, THE Desktop_JS SHALL call `ctx.rest('/state')` to refresh the full state.
3. WHEN the Desktop_JS receives a `plugin.hermes-media-desk.state.changed` event while a prior `ctx.rest('/state')` request is still pending, THE Desktop_JS SHALL discard the pending request's result and apply only the response from the most recently initiated request.
4. WHEN an Asset finishes generating successfully during the production pipeline, THE Backend SHALL emit `broadcast_plugin_event("hermes-media-desk", "asset.ready", { item_id, target, src })` so the Desktop_JS can update that specific Asset without a full state reload; no additional `state.changed` event SHALL be emitted for the same asset-generation completion.
5. THE Desktop_JS SHALL register all event subscriptions via `ctx.onEvent` (not bare `host.onEvent`) so that subscriptions are automatically removed when the plugin unloads or is disabled.

---

### Requirement 21: i18n — Full Bilingual Support

**User Story:** As a user who works in English or Chinese, I want the entire workbench UI and AI-generated content to be in my preferred language, with automatic detection from the system locale.

#### Acceptance Criteria

1. THE Backend SHALL resolve the active locale for each request by reading the `x-media-desk-lang` header; IF the header is absent or its value is `"auto"`, THEN THE Backend SHALL derive the locale from the system locale by mapping any `zh-*` variant to `zh` and any `en-*` variant to `en`; IF the system locale does not match either prefix, THEN THE Backend SHALL default to `en`.
2. THE Backend SHALL pass bilingual LLM prompts: Chinese prompts for zh locale, English prompts for en locale; hardcoded Chinese strings in prompts SHALL be replaced with locale-conditional equivalents.
3. THE Desktop_JS SHALL register zh and en locale bundles using `ctx.i18n.register(bundles)` and use `ctx.i18n.t(key, ...args)` for all user-visible strings, including labels, placeholders, tooltips, and accessible names; direct string literals in JSX SHALL NOT appear for translatable text.
4. THE Desktop_JS SHALL send the `x-media-desk-lang` header with every `ctx.rest()` call, using the value from `ctx.i18n` active locale.
5. WHEN the user changes the language setting, THE Backend SHALL localize sample data to the new language on the next `GET state` call, replacing any field value that still matches the original sample template text with the equivalent text in the new locale; fields whose values have been modified by the user to differ from the original sample template text SHALL NOT be changed.
6. WHEN the `produce/save` operation is called, THE Backend SHALL generate the export filename in the language indicated by the `x-media-desk-lang` header of that request, as specified in Requirement 14.
7. THE Backend SHALL return all operation confirmation messages and error messages in the language indicated by the `x-media-desk-lang` header of the request; IF the header is absent or set to `"auto"`, THEN THE Backend SHALL use the resolved fallback locale as defined in criterion 1.

---

### Requirement 22: LLM Integration

**User Story:** As a plugin operator, I want the plugin to use Hermes's host-owned LLM credentials so that users do not need to manage separate API keys for text generation.

#### Acceptance Criteria

1. THE Backend SHALL call `ctx.llm.acomplete()` or `ctx.llm.acomplete_structured()` for all text-generation tasks; it SHALL NOT make direct HTTP calls to LLM provider endpoints.
2. WHEN `assistant.provider` and `assistant.model` are both non-empty in Settings, THE Backend SHALL pass them as `provider` and `model` arguments to `ctx.llm.acomplete()`; IF either `assistant.provider` or `assistant.model` is empty or absent, THEN THE Backend SHALL omit both `provider` and `model` arguments and use the Hermes default model selection.
3. THE Backend SHALL pass `purpose="content-creation"` to `ctx.llm.acomplete()` for all production pipeline calls; THE Backend SHALL pass a `task` label drawn from the set `{"generate-plan", "generate-article", "chat-reply"}` that corresponds to the call's role in the pipeline, to support operator-side usage attribution.
4. WHEN the Backend issues a plan or chat LLM call, THE Backend SHALL pass `light=True` to `ctx.llm.acomplete()`; WHEN the Backend issues an article-generation LLM call, THE Backend SHALL omit `light=True` or pass `light=False`.
5. THE `GET models` route SHALL return a response containing: the list of available provider and model identifiers from the Hermes LLM provider registry, the currently configured `assistant.provider` and `assistant.model` override values, and the identifier of the Hermes default model selection; this enables the Desktop_JS model picker to populate its options.
6. WHEN the LLM call for the production article or plan raises an exception other than AbortError, THE Backend SHALL log the error, invoke the respective fallback function, and return its output as the pipeline result so that the pipeline completes without raising an exception to the caller.
7. WHEN a model call succeeds after a previous failure, THE Backend SHALL update `modelStatus.ok = True`; WHEN it fails, THE Backend SHALL update `modelStatus.ok = False` and store the error message string so `GET state` can surface it in the UI.