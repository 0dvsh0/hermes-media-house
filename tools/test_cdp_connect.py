import subprocess
import time
import urllib.request
import json
import sys
from playwright.sync_api import sync_playwright

exe = r'C:\Users\smash\AppData\Local\hermes\hermes-agent\apps\desktop\release\win-unpacked\Hermes.exe'

print("Launching Hermes...")
proc = subprocess.Popen([exe, '--remote-debugging-port=9222'])

try:
    print("Waiting for CDP on port 9222...")
    for i in range(30):
        time.sleep(1)
        try:
            with urllib.request.urlopen('http://localhost:9222/json/version', timeout=2) as resp:
                print("CDP responsive!")
                break
        except Exception:
            pass
    else:
        raise RuntimeError("CDP did not become responsive within 30 seconds")

    print("Connecting Playwright over CDP...")
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        print("Connected! Contexts:", len(browser.contexts))
        context = browser.contexts[0]
        pages = context.pages
        print("Pages found:", len(pages))
        for idx, page in enumerate(pages):
            print(f"Page {idx}: title='{page.title()}' url='{page.url}'")
finally:
    print("Test finished.")
