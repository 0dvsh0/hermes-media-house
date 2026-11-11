import pytest
import json
from fastapi import FastAPI
from fastapi.testclient import TestClient
from dashboard.plugin_api import router, parse_json_body, store
from dashboard.seed import seed_state

app = FastAPI()
app.include_router(router)
client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_store_state():
    # Reset store to fresh seed state for each test
    st = seed_state()
    store._cached = st
    store._mtime = 1.0


def test_issue_1_and_5_double_encoded_json_handling():
    """Verify that double-encoded JSON body (from Electron IPC) does not throw HTTP 400 Missing item id."""
    from unittest.mock import patch, AsyncMock
    from dashboard.plugin_api import pipeline

    payload_str = json.dumps({"id": "seed_1"})
    double_encoded_bytes = json.dumps(payload_str).encode("utf-8")
    
    with patch.object(pipeline, "start", new_callable=AsyncMock, return_value=True) as mock_start, \
         patch.object(pipeline, "cancel", new_callable=AsyncMock, return_value=True) as mock_cancel:
        # 1. Test POST /produce with double-encoded JSON
        resp = client.post(
            "/produce",
            content=double_encoded_bytes,
            headers={"Content-Type": "application/json"}
        )
        assert resp.status_code == 200
        mock_start.assert_called_once()
        assert mock_start.call_args[0][0] == "seed_1"

        # 2. Test POST /produce/cancel with double-encoded JSON
        resp = client.post(
            "/produce/cancel",
            content=double_encoded_bytes,
            headers={"Content-Type": "application/json"}
        )
        assert resp.status_code == 200
        mock_cancel.assert_called_once_with("seed_1")

    # 3. Test POST /ops with double-encoded JSON for drag-and-drop schedule_item
    schedule_payload = json.dumps({
        "ops": [
            {
                "op": "schedule_item",
                "id": "seed_1",
                "scheduledAt": "2026-11-18T12:00:00Z",
                "platform": "X"
            }
        ]
    })
    double_schedule_bytes = json.dumps(schedule_payload).encode("utf-8")
    resp = client.post(
        "/ops",
        content=double_schedule_bytes,
        headers={"Content-Type": "application/json"}
    )
    assert resp.status_code == 200, f"Ops failed: {resp.text}"
    data = resp.json()
    assert "state" in data
    # Verify seed_1 was actually scheduled
    item = next(it for it in data["state"]["items"] if it["id"] == "seed_1")
    assert item["scheduledAt"] == "2026-11-18T12:00:00Z"
    assert item["platform"] == "X"


def test_issue_3_insights_seed_data_and_endpoint():
    """Verify that seed data has historical metrics and /insights returns populated analytics."""
    resp = client.get("/insights")
    assert resp.status_code == 200
    data = resp.json()
    totals = data.get("totals", {})
    items = data.get("items", [])

    assert totals.get("views", 0) > 0, "Expected non-zero views"
    assert totals.get("likes", 0) > 0, "Expected non-zero likes"
    assert totals.get("engagements", 0) > 0, "Expected non-zero engagements"
    assert len(items) >= 4, f"Expected at least 4 aggregated items, got {len(items)}"
    for it in items:
        assert "engagements" in it, f"Item missing engagements: {it}"
        assert it["engagements"] == it["likes"] + it["comments"] + it["shares"] + it["saves"]

    # Verify seed state has diverse published platforms
    st = seed_state()
    pub_items = [i for i in st["items"] if i.get("publishedAt")]
    assert len(pub_items) >= 6
    platforms = {i.get("platform") for i in pub_items}
    for required_plat in ["X", "YouTube", "LinkedIn", "Instagram", "TikTok", "Substack"]:
        assert required_plat in platforms, f"Missing platform {required_plat}"


def test_issue_1_bidirectional_scheduling_and_unscheduling():
    """Verify that schedule_item can schedule to a date and unschedule (scheduledAt: null), with platform normalization."""
    # 1. Schedule with lowercase platform 'x'
    resp = client.post(
        "/ops",
        json={
            "ops": [
                {
                    "op": "schedule_item",
                    "id": "seed_2",
                    "scheduledAt": "2026-11-20T12:00:00Z",
                    "platform": "x"
                }
            ]
        }
    )
    assert resp.status_code == 200
    st = resp.json()["state"]
    it = next(i for i in st["items"] if i["id"] == "seed_2")
    assert it["scheduledAt"] == "2026-11-20T12:00:00Z"
    assert it["platform"] == "X", "Expected lowercase 'x' to be normalized to 'X'"

    # 2. Unschedule back to tray (scheduledAt: null)
    resp = client.post(
        "/ops",
        json={
            "ops": [
                {
                    "op": "schedule_item",
                    "id": "seed_2",
                    "scheduledAt": None
                }
            ]
        }
    )
    assert resp.status_code == 200
    st = resp.json()["state"]
    it = next(i for i in st["items"] if i["id"] == "seed_2")
    assert it["scheduledAt"] is None
    assert it["status"] in ("draft", "idea")


def test_issue_7_skills_preset_fields():
    """Verify that skills presets have name, rule, text, and status."""
    st = seed_state()
    skills = st.get("skills", [])
    assert len(skills) >= 3
    for sk in skills:
        assert sk.get("name"), f"Missing name: {sk}"
        assert sk.get("rule"), f"Missing rule: {sk}"
        assert sk.get("text"), f"Missing text: {sk}"
        assert sk.get("status") in ("active", "proposed", "inactive")


def test_hermes_agent_llm_connection_and_transparent_chat(monkeypatch):
    """Verify that /chat connects to real LLM, records receipts, and returns modelOk: True."""
    from unittest.mock import AsyncMock, MagicMock
    from dashboard import ai

    mock_llm = MagicMock()
    mock_llm.acomplete = AsyncMock(return_value="""```json
    {
        "reply": "I refined your headline to be shorter and punchier.",
        "ops": [],
        "revise": {"title": "Deleted Features, Doubled Velocity"},
        "actions": []
    }
    ```""")
    monkeypatch.setattr(ai, "get_llm", lambda ctx=None: mock_llm)

    resp = client.post(
        "/chat",
        json={"message": "Make title shorter", "focusId": "seed_1"},
        headers={"sec-fetch-site": "same-origin"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["modelOk"] is True
    assert data["modelError"] is None
    assert "Deleted Features" in str(data.get("receipts", []))
    assert "I refined your headline" in data["answer"]
    assert "offline fallback" not in data["answer"].lower()

    # Verify chat history saved to state
    chat_log = data["state"]["chat"]
    last_assistant = [m for m in chat_log if m["role"] == "assistant"][-1]
    assert last_assistant["engine"] == "model"
    assert "receipts" in last_assistant


def test_hermes_agent_transparent_error_reporting(monkeypatch):
    """Verify that when an error occurs, the actual error is returned transparently with no fake mogging."""
    from unittest.mock import AsyncMock, MagicMock
    from dashboard import ai

    mock_llm = MagicMock()
    mock_llm.acomplete = AsyncMock(side_effect=RuntimeError("Rate limit reached: 429 quota exhausted"))
    monkeypatch.setattr(ai, "get_llm", lambda ctx=None: mock_llm)

    resp = client.post(
        "/chat",
        json={"message": "Write a caption", "focusId": "seed_1"},
        headers={"sec-fetch-site": "same-origin"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["modelOk"] is False
    assert "429 quota exhausted" in data["modelError"]
    assert "Model error: Rate limit reached: 429 quota exhausted" in data["answer"]
    assert "offline fallback" not in data["answer"].lower()

    chat_log = data["state"]["chat"]
    last_assistant = [m for m in chat_log if m["role"] == "assistant"][-1]
    assert len(last_assistant["errors"]) >= 1
    assert "429 quota exhausted" in last_assistant["errors"][0]


def test_built_bundle_has_no_sparkle_in_produce_and_contains_chat_styles():
    """Verify built plugin.js bundle has removed sparkle icon from produce and contains proper styles."""
    from pathlib import Path
    bundle_path = Path("desktop/plugin.js")
    assert bundle_path.is_file(), "desktop/plugin.js must exist"
    bundle_text = bundle_path.read_text(encoding="utf-8")

    # Verify studio produce button has no sparkle icon
    # Previously: jsx(Icon, { name: 'spark', size: 14 }), jsx('span', {}, t('studio.produce'))
    assert "jsx(Icon, { name: 'spark', size: 14 })" not in bundle_text

    # Verify all dsh-media-desk aligned CSS classes are in the bundle
    for expected_cls in [
        ".md-chat",
        ".md-dock-head",
        ".md-engine.is-live",
        ".md-engine.is-down",
        ".md-dock-intro",
        ".md-msg.is-user",
        ".md-msg.is-bot",
        ".md-receipt",
        ".md-receipt-check",
        ".md-suggest",
        ".md-composer",
        ".md-model-alert"
    ]:
        assert expected_cls in bundle_text, f"Missing CSS class in bundle: {expected_cls}"

