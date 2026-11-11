import base64
import json
from pathlib import Path
import re
import sys
import urllib.request
import urllib.error

# 1. Connect to gateway control socket
sys.path.insert(0, r'C:\Users\smash\AppData\Local\hermes\hermes-agent')
from gateway.control_socket import identify_gateway, query_gateway_control

home = Path(r'C:\Users\smash\AppData\Local\hermes')
ident = identify_gateway(home)
assert ident is not None, "Gateway could not be identified!"
origin = ident['api_origin']
print(f"[E2E] Connected to live gateway at: {origin}")

def get_ticket():
    ticket_info = query_gateway_control(
        home,
        'session-ticket',
        params={'profile_id': str(home), 'instance_id': ident['instance_id'], 'purpose': 'native-http'}
    )
    return ticket_info['ticket']

print("[E2E] Session ticket minting helper ready.")

def api_call(path, method='GET', body=None, headers=None):
    url = f"{origin}/api/plugins/hermes-media-desk{path}"
    req_headers = {
        'x-hermes-gateway-ticket': get_ticket(),
        'sec-fetch-site': 'same-origin',
    }
    if headers:
        req_headers.update(headers)
    data = None
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode('utf-8')
            req_headers['Content-Type'] = 'application/json'
        elif isinstance(body, bytes):
            data = body
        elif isinstance(body, str):
            data = body.encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req) as resp:
        content_type = resp.headers.get('Content-Type', '')
        resp_data = resp.read()
        if 'application/json' in content_type:
            return resp.status, json.loads(resp_data.decode('utf-8'))
        return resp.status, resp_data

# Reset state.json to ensure test starts completely clean
state_file = Path(r'C:\Users\smash\.hermes\plugin_data\hermes-media-desk\state.json')
if state_file.exists():
    state_file.unlink()

# 3. Test GET /state (Initial empty state)
print("\n[Step 1] Verifying initial empty state...")
status, state = api_call('/state')
assert status == 200, f"Expected 200, got {status}"
assert state.get('version') == 4, f"Expected version 4, got {state.get('version')}"
assert state.get('sampleCleared') is False
assert len(state.get('items', [])) == 0, f"Expected 0 items, got {len(state.get('items', []))}"
assert len(state.get('styles', [])) == 0, f"Expected 0 styles, got {len(state.get('styles', []))}"

# Verify no Chinese characters in state JSON
state_str = json.dumps(state)
chinese_in_state = re.findall(r'[\u4e00-\u9fff]', state_str)
assert not chinese_in_state, f"Found Chinese characters in state: {chinese_in_state}"
print("✓ Initial state is empty and 100% English.")

# 4. Test POST /upload (Upload real media asset)
print("\n[Step 2] Testing real image upload via POST /upload...")
# 1x1 transparent PNG bytes
TEST_PNG = base64.b64decode(
    b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
status, upload_res = api_call(
    '/upload?filename=test_cover.png',
    method='POST',
    body=TEST_PNG,
    headers={'Content-Type': 'image/png'}
)
assert status == 200, f"Upload failed with status {status}"
asset_src = upload_res.get('src')
print(f"✓ Uploaded real PNG asset: {asset_src}")
assert asset_src and 'files/' in asset_src

# 5. Test GET /asset (Data URL rendering for desktop img)
print("\n[Step 3] Testing desktop image loading via GET /asset dataUrl endpoint...")
status, asset_res = api_call(f'/asset?src={urllib.parse.quote(asset_src)}')
assert status == 200, f"GET /asset failed with status {status}"
data_url = asset_res.get('dataUrl', '')
assert data_url.startswith('data:image/png;base64,'), f"Invalid dataUrl: {data_url[:40]}"
# Decode dataUrl and verify bytes match exactly
b64_part = data_url.split(',', 1)[1]
decoded_bytes = base64.b64decode(b64_part)
assert decoded_bytes == TEST_PNG, "Decoded dataUrl does not match uploaded image bytes!"
print("✓ GET /asset returned valid authenticated dataUrl matching source bytes.")

# 6. Test POST /ops (Real content creation and updates)
print("\n[Step 4] Creating real content via POST /ops...")
ops = [
    {
        'op': 'add_item',
        'id': 'it_real_001',
        'title': 'Deterministic Agent Systems in 2026',
        'kind': 'image',
        'platform': 'Xiaohongshu',
        'body': 'Architecting robust local workflows with zero hallucinated states.',
        'media': {'src': asset_src, 'type': 'image'},
    },
    {
        'op': 'schedule_item',
        'id': 'it_real_001',
        'scheduledAt': '2026-11-20T14:00:00Z',
        'platform': 'Bilibili',
    },
    {
        'op': 'add_style',
        'name': 'Deep Dive Technical',
        'category': 'General',
        'summary': 'Structured, evidence-backed breakdowns.',
        'tone': 'Rigorous, pragmatic',
    },
    {
        'op': 'update_production',
        'id': 'it_real_001',
        'title': 'Deterministic Agent Systems in 2026',
        'article': '## Introduction\n\nDeterministic systems minimize state drift.\n\n## Key Analysis\n\nPredictable workflows yield reproducible results.',
        'cover': {'src': asset_src, 'status': 'done', 'prompt': 'Engineering diagram of local architecture'},
        'images': [
            {'src': asset_src, 'status': 'done', 'target': 'figure_1', 'prompt': 'System pipeline topology'}
        ],
        'shots': [
            {'idx': 0, 'visual': 'Opening scene showing architecture diagram', 'duration': 5, 'src': asset_src}
        ]
    }
]

status, ops_res = api_call('/ops', method='POST', body={'ops': ops})
assert status == 200, f"Ops failed with status {status}"
assert not ops_res.get('errors'), f"Ops returned errors: {ops_res.get('errors')}"
new_state = ops_res.get('state', {})
items = new_state.get('items', [])
assert len(items) == 1, f"Expected 1 item, got {len(items)}"
it = items[0]
assert it['title'] == 'Deterministic Agent Systems in 2026'
assert it['platform'] == 'Bilibili'
assert it['scheduledAt'] == '2026-11-20T14:00:00Z'
assert it['status'] == 'outline'
assert it['production']['cover']['src'] == asset_src

styles = new_state.get('styles', [])
assert len(styles) == 1
assert styles[0]['name'] == 'Deep Dive Technical'
assert styles[0]['category'] == 'General'
print("✓ Content, schedule, style, and production updated cleanly via ops.")

# 7. Test Export functionality
print("\n[Step 5] Testing production export via POST /produce/save...")
status, save_res = api_call('/produce/save', method='POST', body={'id': 'it_real_001'})
assert status == 200, f"produce/save failed with status {status}"
export_dir = Path(save_res.get('path', ''))
assert export_dir.exists(), f"Export directory does not exist: {export_dir}"
exported_files = [f.name for f in export_dir.iterdir()]
print(f"✓ Exported directory: {export_dir}")
print(f"  Files created: {exported_files}")

# Verify filenames are English only
for fn in exported_files:
    assert not re.search(r'[\u4e00-\u9fff]', fn), f"Exported filename contains Chinese: {fn}"
    # Verify file contents are English only
    p = export_dir / fn
    if p.suffix in ('.md', '.txt', '.json'):
        txt = p.read_text(encoding='utf-8')
        assert not re.search(r'[\u4e00-\u9fff]', txt), f"Exported file {fn} contains Chinese: {txt}"

print("✓ All exported files and content are 100% English.")

# 8. Test Monid status endpoint
print("\n[Step 6] Testing GET /monid/status...")
status, monid_res = api_call('/monid/status')
assert status == 200, f"monid/status failed with status {status}"
print(f"✓ Monid status: {monid_res.get('state')}")

print("\n" + "="*60)
print("ALL LIVE END-TO-END GATEWAY TESTS PASSED SUCCESSFULLY!")
print("="*60)
