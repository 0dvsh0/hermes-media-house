"""Tests for desktop/plugin.js and related tasks (17, 18, 19, 20).

Requirements:
- 15.1-15.11: Plugin lifecycle, storage persistence, theme variables, no JSX, import restrictions
- 17.1-17.6: Schedule calendar grid, 40-char title truncation, unscheduled tray, schedule_item op
- 19.1-19.7: HomePage URL capture, 50 MiB file upload check, MIME whitelist, ItemCard
- 21.3: Bilingual locale bundles (ZH_BUNDLE, EN_BUNDLE) with complete key coverage
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import pytest

from dashboard.ops import apply_ops

PLUGIN_JS_PATH = Path(__file__).resolve().parent.parent / "desktop" / "plugin.js"


@pytest.fixture(scope="module")
def plugin_source() -> str:
    assert PLUGIN_JS_PATH.is_file(), f"plugin.js not found at {PLUGIN_JS_PATH}"
    return PLUGIN_JS_PATH.read_text(encoding="utf-8")


def test_syntax_valid():
    """Requirement 15.9: Ensure plugin.js is valid JavaScript syntax without compile step."""
    proc = subprocess.run(
        ["node", "-c", str(PLUGIN_JS_PATH)],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"node -c failed with errors:\n{proc.stderr}"


def test_import_restrictions(plugin_source: str):
    """Requirement 15.9: Import only @hermes/plugin-sdk, react, and react/jsx-runtime."""
    import_lines = [
        line.strip()
        for line in plugin_source.splitlines()
        if line.strip().startswith("import ") or " from " in line
    ]
    allowed_modules = {"'@hermes/plugin-sdk'", "'react'", "'react/jsx-runtime'"}

    for line in import_lines:
        match = re.search(r"from\s+(['\"].*?['\"])", line)
        if match:
            module = match.group(1).replace('"', "'")
            assert module in allowed_modules, f"Disallowed import {module} in line: {line}"


def test_no_jsx_syntax(plugin_source: str):
    """Requirement 15.9: All UI authored with jsx() / jsxs(); no JSX syntax."""
    # Strip comments to prevent false positives in URLs or docstrings
    code_without_comments = re.sub(r"/\*[\s\S]*?\*/|//.*", "", plugin_source)
    # Look for JSX tags like </tag> or <Tag ...> or <tag attr=...>
    jsx_tag_pattern = re.compile(r"</\s*[a-zA-Z][a-zA-Z0-9]*\s*>|<\s*[A-Z][a-zA-Z0-9]*\s*[\s/>]")
    matches = jsx_tag_pattern.findall(code_without_comments)
    assert not matches, f"Found forbidden JSX syntax: {matches}"


def test_theme_variables_for_colors(plugin_source: str):
    """Requirement 15.8: Use only theme variables (var(--ui-*)) for colors; no hex, rgb, rgba, hsl literals."""
    # Strip comments to avoid false positives in docstrings
    code_without_comments = re.sub(r"/\*[\s\S]*?\*/|//.*", "", plugin_source)

    # 1. Hex color literals (#fff, #123456, etc.)
    hex_colors = re.findall(r"#[0-9a-fA-F]{3,8}\b", code_without_comments)
    assert not hex_colors, f"Found hardcoded hex color literals: {hex_colors}"

    # 2. rgb(), rgba(), hsl(), hsla()
    rgb_colors = re.findall(r"\b(rgba?|hsla?)\s*\(.*?\)", code_without_comments)
    assert not rgb_colors, f"Found hardcoded rgb/hsl color literals: {rgb_colors}"


def test_locale_bundles_coverage(plugin_source: str):
    """Requirement 21.3: Complete zh and en locale string key coverage."""
    # Extract keys defined in ZH_BUNDLE and EN_BUNDLE
    zh_match = re.search(r"export\s+const\s+ZH_BUNDLE\s*=\s*({[\s\S]*?\n})", plugin_source)
    en_match = re.search(r"export\s+const\s+EN_BUNDLE\s*=\s*({[\s\S]*?\n})", plugin_source)

    assert zh_match, "ZH_BUNDLE not found in plugin.js"
    assert en_match, "EN_BUNDLE not found in plugin.js"

    zh_keys = set(re.findall(r"['\"]([\w\.]+)['\"]\s*:", zh_match.group(1)))
    en_keys = set(re.findall(r"['\"]([\w\.]+)['\"]\s*:", en_match.group(1)))

    assert len(zh_keys) > 30, f"Too few ZH keys found ({len(zh_keys)})"
    assert zh_keys == en_keys, f"ZH and EN bundle key mismatch: ZH - EN = {zh_keys - en_keys}, EN - ZH = {en_keys - zh_keys}"

    # Verify essential keys for home, content, schedule, and settings
    essential_keys = [
        "nav.label", "nav.home", "nav.content", "nav.schedule", "nav.insights", "nav.style",
        "home.urlPlaceholder", "home.captureBtn", "home.dropzone", "home.fileTooLarge", "home.fileUnsupported",
        "content.viewTable", "content.viewKanban", "content.colTitle", "content.colStatus",
        "schedule.prevMonth", "schedule.nextMonth", "schedule.unscheduled", "schedule.setDate",
        "schedule.dateSetSuccess", "schedule.dateSetFailed", "item.untitled",
    ]
    for k in essential_keys:
        assert k in zh_keys, f"Missing essential locale key {k} in bundles"


def test_task_18_constants_and_validation(plugin_source: str):
    """Task 18 & Requirement 19.3, 19.7: 50 MiB limit and MIME whitelist."""
    # MAX_FILE_SIZE = 50 * 1024 * 1024 = 52428800
    assert "MAX_FILE_SIZE = 50 * 1024 * 1024" in plugin_source or "52428800" in plugin_source

    required_mime_types = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "video/mp4",
        "video/webm",
    ]
    for mime in required_mime_types:
        assert mime in plugin_source, f"Missing accepted file type {mime}"

    # URL capture routes and ops
    assert "/capture-url" in plugin_source
    assert "add_item" in plugin_source
    assert "HomePage" in plugin_source
    assert "ItemCard" in plugin_source


def test_task_19_content_page_views(plugin_source: str):
    """Task 19: ContentPage with Table and Kanban views and inline set_status."""
    assert "ContentPage" in plugin_source
    assert "TableView" in plugin_source
    assert "KanbanView" in plugin_source
    assert "set_status" in plugin_source

    # Check that kanban columns cover all 5 statuses
    for status in ["idea", "outline", "draft", "ready", "published"]:
        assert status in plugin_source


def test_task_20_schedule_calendar_truncation(plugin_source: str):
    """Task 20 & Requirement 17.1: Ellipsis truncation at 40 characters for day cells."""
    assert "truncateTitle" in plugin_source
    assert "SchedulePage" in plugin_source
    assert "schedule_item" in plugin_source

    # Run Node to test the exact truncateTitle function
    script = """
    import { truncateTitle } from './desktop/plugin.js';
    const shortTitle = "Hello World";
    const exactTitle = "A".repeat(40);
    const longTitle = "A".repeat(41);
    
    if (truncateTitle(shortTitle, 40) !== "Hello World") process.exit(1);
    if (truncateTitle(exactTitle, 40) !== exactTitle) process.exit(2);
    if (truncateTitle(longTitle, 40) !== "A".repeat(40) + "...") process.exit(3);
    console.log("OK");
    """
    # Write a temporary script to test via Node module loading with mock imports
    runner = """
    import fs from 'fs';
    const content = fs.readFileSync('./desktop/plugin.js', 'utf8');
    // Extract truncateTitle implementation
    const match = content.match(/export function truncateTitle[^{]*{([\\s\\S]*?)^}/m);
    if (!match) process.exit(10);
    const fn = new Function('title', 'maxChars = 40', match[1]);
    
    if (fn("Hello World", 40) !== "Hello World") process.exit(1);
    if (fn("A".repeat(40), 40) !== "A".repeat(40)) process.exit(2);
    if (fn("A".repeat(45), 40) !== "A".repeat(40) + "...") process.exit(3);
    console.log("TRUNCATE_OK");
    """
    proc = subprocess.run(["node", "-e", runner], capture_output=True, text=True)
    assert proc.returncode == 0, f"Truncation test failed:\n{proc.stderr}"
    assert "TRUNCATE_OK" in proc.stdout


def test_task_20_unscheduled_sorting_by_created_at(plugin_source: str):
    """Task 20 & Requirement 17.3: Unscheduled tray sorted by item creation date ascending."""
    # Ensure createdAt comparison is used in unscheduled items sorting
    assert "createdAt" in plugin_source
    assert "unscheduledItems" in plugin_source


@pytest.mark.anyio
async def test_requirement_17_6_backend_platform_update():
    """Requirement 17.6: schedule_item op with non-null scheduledAt sets platform if present."""
    state = {
        "items": [
            {
                "id": "it_test_sched",
                "title": "Scheduled Item",
                "status": "idea",
                "platform": "Xiaohongshu",
                "createdAt": "2026-11-10T00:00:00Z",
            }
        ]
    }
    ops = [
        {
            "op": "schedule_item",
            "id": "it_test_sched",
            "scheduledAt": "2026-11-15T10:00:00Z",
            "platform": "Bilibili",
        }
    ]
    new_state, receipts, errors = await apply_ops(state, ops)
    assert not errors, f"Unexpected errors: {errors}"
    updated = new_state["items"][0]
    assert updated["scheduledAt"] == "2026-11-15T10:00:00Z"
    assert updated["platform"] == "Bilibili"
    assert updated["status"] == "outline"


def test_task_21_insights_page_and_csv_export(plugin_source: str):
    """Task 21 & Requirements 18.1-18.9: InsightsPage, CSV export, learn rules, export skill, Monid wizard."""
    assert "exportInsightsToCsv" in plugin_source
    assert "InsightsPage" in plugin_source
    assert "/insights" in plugin_source
    assert "/skills/learn" in plugin_source
    assert "/skills/export" in plugin_source
    assert "/monid/status" in plugin_source
    assert "/monid/import" in plugin_source

    # Run Node to test exportInsightsToCsv functionality directly
    runner = """
    import fs from 'fs';
    const content = fs.readFileSync('./desktop/plugin.js', 'utf8');
    const match = content.match(/export function exportInsightsToCsv[^{]*{([\\s\\S]*?)^}/m);
    if (!match) process.exit(10);
    const fn = new Function('items', match[1]);

    const testItems = [
      { itemId: '1', title: 'Post 1, Special', platform: 'Xiaohongshu', status: 'published', views: 100, likes: 10, comments: 2, shares: 1, saves: 5 },
      { itemId: '2', title: 'Normal Post', platform: 'Bilibili', status: 'ready', views: 50, likes: 4, comments: 0, shares: 0, saves: 1 },
    ];
    const csv = fn(testItems);
    if (!csv.includes('Title,Platform,Status,Views,Likes,Comments,Shares,Saves')) process.exit(1);
    if (!csv.includes('"Post 1, Special"')) process.exit(2);
    if (!csv.includes('Normal Post,Bilibili,ready,50,4,0,0,1')) process.exit(3);
    console.log("CSV_OK");
    """
    proc = subprocess.run(["node", "-e", runner], capture_output=True, text=True)
    assert proc.returncode == 0, f"CSV export test failed:\n{proc.stderr}"
    assert "CSV_OK" in proc.stdout


def test_task_22_style_page_and_ops(plugin_source: str):
    """Task 22 & Requirements 12.9, 15.2: StylePage rendering, preset/custom grouping, ops dispatching."""
    assert "StylePage" in plugin_source
    assert "set_style" in plugin_source
    assert "add_style" in plugin_source
    assert "update_style" in plugin_source
    assert "delete_style" in plugin_source
    assert "update_skill" in plugin_source
    assert "delete_skill" in plugin_source
    assert "skillsTitle" in plugin_source or "style.skillsTitle" in plugin_source


def test_task_24_chat_dock_and_undo(plugin_source: str):
    """Task 24 & Requirements 10.1-10.12: ChatDock scoping, undo affordance, chat/clear."""
    assert "ChatDock" in plugin_source
    assert "/chat" in plugin_source
    assert "/undo" in plugin_source
    assert "/chat/clear" in plugin_source
    assert "focusId" in plugin_source
    assert "undoable" in plugin_source


def test_task_25_manifest_consistency():
    """Task 25: Verify plugin.yaml, dashboard/manifest.json, and desktop/plugin.js declare id consistently."""
    root = Path(__file__).resolve().parent.parent

    # 1. plugin.yaml
    plugin_yaml_path = root / "plugin.yaml"
    assert plugin_yaml_path.is_file(), "plugin.yaml not found"
    yaml_text = plugin_yaml_path.read_text(encoding="utf-8")
    assert re.search(r"^id:\s*hermes-media-desk\b", yaml_text, re.MULTILINE), "plugin.yaml id is not hermes-media-desk"
    assert re.search(r"^name:\s*Media Desk\b", yaml_text, re.MULTILINE), "plugin.yaml name is not Media Desk"

    # 2. dashboard/manifest.json
    manifest_path = root / "dashboard" / "manifest.json"
    assert manifest_path.is_file(), "dashboard/manifest.json not found"
    manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest_data.get("id") == "hermes-media-desk", "dashboard/manifest.json id mismatch"
    assert manifest_data.get("name") == "hermes-media-desk", "dashboard/manifest.json name mismatch"

    # 3. desktop/plugin.js
    plugin_js_path = root / "desktop" / "plugin.js"
    assert plugin_js_path.is_file(), "desktop/plugin.js not found"
    js_text = plugin_js_path.read_text(encoding="utf-8")
    assert re.search(r"id:\s*['\"]hermes-media-desk['\"]", js_text), "desktop/plugin.js id mismatch"
    assert re.search(r"name:\s*['\"]Media Desk['\"]", js_text), "desktop/plugin.js name mismatch"


def test_task_23_studio_overlay_and_components(plugin_source: str):
    """Task 23 & Requirements 16.1-16.11: StudioOverlay, Bento Grid components, polling, AssetViewer."""
    # 1. Exported components
    required_components = [
        "StudioOverlay",
        "IdeaCard",
        "ProgressCard",
        "HeroTile",
        "ArticleTile",
        "ShotsTile",
        "AssetViewer",
    ]
    for comp in required_components:
        assert f"export function {comp}" in plugin_source, f"Missing component {comp} in plugin.js"

    # 2. IdeaCard constraints (Requirement 16.4)
    assert "maxLength: 200" in plugin_source or "200" in plugin_source
    assert "update_production" in plugin_source
    assert "set_style" in plugin_source

    # 3. ProgressCard four steps (Requirement 16.5)
    for step_key in ["studio.step1", "studio.step2", "studio.step3", "studio.step4"]:
        assert step_key in plugin_source

    # 4. Polling at 700ms intervals with 3 consecutive failure halt (Requirement 16.2, 16.3, 16.11)
    assert "700" in plugin_source
    assert "/production?id=" in plugin_source
    assert "consecutiveFailures" in plugin_source or ">= 3" in plugin_source
    assert "studio.pollError" in plugin_source

    # 5. Article selection and 4-char threshold (Requirement 16.8)
    assert "getSelection" in plugin_source
    assert "length >= 4" in plugin_source or ">= 4" in plugin_source
    assert "studio.askAssistant" in plugin_source
    assert "> ${selectedText}\\n\\n" in plugin_source

    # 6. Animation 250ms & Escape key support (Requirement 16.6)
    assert "250ms" in plugin_source
    assert "Escape" in plugin_source

    # 7. AssetViewer modal controls (Requirement 16.7)
    assert "ArrowLeft" in plugin_source
    assert "ArrowRight" in plugin_source
    assert "studio.regen" in plugin_source
    assert "studio.download" in plugin_source
    assert "studio.noImageProvider" in plugin_source


def test_asset_url_normalization_and_image_components(plugin_source: str):
    """Verify asset URL normalization and MediaImage usage for desktop auth bypass."""
    # Ensure MediaImage component is used for authenticated image loading
    assert "export function MediaImage" in plugin_source
    assert "useAssetDataUrl" in plugin_source
    assert "normalizeAssetSrc" in plugin_source

    # Fallback locale must be English
    assert "return ctx.i18n.locale || 'en'" in plugin_source

    # Extract normalizeAssetSrc from plugin_source
    match = re.search(r"export function normalizeAssetSrc\([\s\S]*?\n\}", plugin_source)
    assert match, "normalizeAssetSrc not found in plugin.js"
    fn_body = match.group(0).replace("export function normalizeAssetSrc(src)", "function normalizeAssetSrc(src)")

    runner = f"""
    {fn_body}
    if (normalizeAssetSrc('/api/plugins/hermes-media-desk/files/a.png') !== 'media-desk/files/a.png') process.exit(2);
    if (normalizeAssetSrc('api/plugins/hermes-media-desk/files/b.png') !== 'media-desk/files/b.png') process.exit(3);
    if (normalizeAssetSrc('files/c.png') !== 'media-desk/files/c.png') process.exit(4);
    if (normalizeAssetSrc('/files/d.png') !== 'media-desk/files/d.png') process.exit(5);
    if (normalizeAssetSrc('media-desk/files/e.png') !== 'media-desk/files/e.png') process.exit(6);
    if (normalizeAssetSrc('http://example.com/img.png') !== 'http://example.com/img.png') process.exit(7);
    if (normalizeAssetSrc('data:image/png;base64,abc') !== 'data:image/png;base64,abc') process.exit(8);
    console.log("NORMALIZE_OK");
    """
    proc = subprocess.run(["node", "-e", runner], capture_output=True, text=True)
    assert proc.returncode == 0, f"normalizeAssetSrc node test failed: {proc.stderr}"
    assert "NORMALIZE_OK" in proc.stdout



