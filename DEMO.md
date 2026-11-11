# Hermes Media Desk — Hackathon Demo & Walkthrough Guide 🎬

> **Submission for the Nous Research Hermes Plugins Hackathon**  
> *Plugin ID: `hermes-media-desk`*

This document provides a concise 3-minute video demonstration script and a reproducible test walk-through for hackathon evaluators.

---

## ⏱️ 3-Minute Demo Video Script

### [0:00 - 0:30] Hook & The Creator's Dilemma
- **Visual**: Screen recording opens on Hermes Desktop with the Media Desk plugin loaded (`/media-desk`).
- **Narrator**:
  > *"Every creator and media team faces the same bottleneck: inspiration is scattered across Xiaohongshu, Bilibili, TikTok, and X. Translating an idea into a publishable article, visual posters, and a storyboard requires 5 different disconnected tools. Today, we're introducing **Hermes Media Desk** — an autonomous creative operations cockpit built natively inside Hermes Agent."*

### [0:30 - 1:00] Inspiration Capture & Multi-Platform Intelligence
- **Visual**: 
  1. Demonstrator pastes a trending article link into the URL Harvester. The system extracts title, clean body, and metadata while rejecting SSRF attack URLs.
  2. Demonstrator opens the **Monid Ingestion Wizard** in the Insights tab, pulling real engagement metrics (views, likes, saves) from supported platforms.
- **Narrator**:
  > *"Media Desk ingests content via an SSRF-safe multi-hop scraper or directly from 6 major social platforms using our Monid CLI integration. It automatically maps disparate platform schemas into a unified, searchable inspiration board."*

### [1:00 - 1:50] The Bento Grid Studio & One-Click Production
- **Visual**: 
  1. Click an item card to launch the **Studio Overlay**.
  2. Click **"Generate All"**. The progress card lights up with shimmering steps: Title Copy -> Script Word Count -> Figure Collage -> Storyboard Shots.
  3. Expand the **Article Tile** (smooth 250ms CSS animation).
  4. Highlight a sentence in the script. A floating pill appears: *"Ask assistant to edit this"*. Clicking it instantly populates the ChatDock with Markdown blockquotes.
  5. Send a prompt: *"Make this hook more contrarian and engaging."* The assistant responds with actionable ops.
- **Narrator**:
  > *"Inside the Bento Grid Studio, clicking 'Generate All' triggers concurrent AI planning, copywriting, and visual asset generation. Our text selection affordance lets you collaborate with Hermes Agent contextually without ever leaving your draft."*

### [1:50 - 2:20] 3-Way Merge Undo & Modal Asset Viewer
- **Visual**:
  1. Demonstrator clicks **Undo** on the assistant message. The script effortlessly reverts back using our 3-way merge engine.
  2. Demonstrator clicks the generated Cover Poster to open the **AssetViewer**. Navigates through shots with arrow keys, downloads high-res files, or triggers re-generation.
- **Narrator**:
  > *"Worried about AI hallucinations or bad edits? Media Desk features a mathematical 3-way merge undo engine that cleanly rolls back changes. Our full-screen AssetViewer lets you inspect and regenerate assets in high resolution."*

### [2:20 - 2:45] Editorial Calendar & Rule Extraction
- **Visual**:
  1. Switch to the **Schedule** tab. Demonstrator views the calendar matrix with 40-character truncated cards and assigns an unscheduled post to next Monday.
  2. Switch to **Insights** tab and click **"Export CSV"**, then click **"Learn Rules from Top Posts"**. Hermes analyzes high-engagement posts and exports reusable creative rules directly into `.hermes/skills/`.
- **Narrator**:
  > *"Plan your publication pipeline on our monthly editorial calendar. Media Desk doesn't just produce content — it continuously learns what works by extracting stylistic rules into Hermes skills for your future campaigns."*

### [2:45 - 3:00] One-Click Export & Conclusion
- **Visual**:
  1. Back in Studio, demonstrator clicks **"Export Production"** and **"Reveal in File Manager"**.
  2. The OS Explorer opens up showing a perfectly structured export folder with Markdown scripts, embedded figures, storyboard tables, and validated JPEG video covers.
- **Narrator**:
  > *"With 235 automated tests, 100% property-tested invariants, and zero runtime dependencies on the frontend, Hermes Media Desk is ready for enterprise and indie creators alike. Power your media desk with Hermes Agent today."*

---

## 🛠️ Step-by-Step Evaluator Runbook

Evaluators can run and test every feature locally with these commands:

### 1. Verify Complete Test Suite
```bash
python -m pytest tests/ -v
```
*Expected: 235 passed, 0 failed.*

### 2. Verify Desktop Plugin Syntax & Zero JSX
```bash
node -c desktop/plugin.js
```
*Expected: Exits cleanly with code 0.*

### 3. Start Backend & Explore Endpoints
```bash
uvicorn dashboard.plugin_api:app --host 127.0.0.1 --port 8000
```
- Open `http://127.0.0.1:8000/docs` to test all OpenAPI-documented routes:
  - `GET /state` (loads items, styles, skills, settings)
  - `POST /produce` (runs production pipeline)
  - `POST /ops` (batch ops with atomic rollback)
  - `POST /undo` (3-way merge undo)
  - `POST /produce/save` (export bundle)
  - `POST /produce/reveal` (native file explorer)

### 4. Switch Languages
- In Hermes Desktop Settings or via HTTP Header `x-media-desk-lang: zh` / `en`, switch seamlessly between Chinese and English with full locale parity.

---

## 🌟 Hackathon Submission Summary

- **Repository**: `hermes-media-house` (Plugin ID: `hermes-media-desk`)
- **Prize Track**: Nous Research Hermes Plugins Hackathon
- **Architecture**: Asynchronous Python FastAPI Backend + Uncompiled ESM Frontend Component (`desktop/plugin.js`)
- **Key Invariants**: 100% verified across 14 Hypothesis Property Tests (PBT).
