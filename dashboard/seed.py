"""
seed.py - Rich initial sample state for hermes-media-desk.

Provides ``seed_state() -> dict`` returning sample data matching DSH media desk,
100% English only (RAW_EN text, no Chinese characters).
All sample items and entities are tagged with `sample: True`.

Entities included:
- 25 creative posts (items)
- 8 angles
- 4 personas (people)
- 9 style presets (styles)
- 3 skills
- 4 accounts
- Historical metrics for published items
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math


def _shift(base: datetime, days: int, hour: int = 10, minute: int = 0) -> str:
    """Shift base datetime by days and set hour/minute in ISO 8601 UTC format."""
    d = base + timedelta(days=days)
    d = d.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


RAW_ITEMS = [
    {
        "k": "image",
        "img": ["hills", 900, 620],
        "t": "Why your first AI side project never makes a dollar",
        "b": "It's not the prompts. It's not knowing what your first sellable thing should look like. Break that step down in three images.",
        "tags": ["AI", "Monetization"],
        "a": "case",
        "p": ["newbie"],
        "st": "draft",
        "day": 0,
        "src": "Thought on a walk",
    },
    {
        "k": "quote",
        "t": "Good topics aren't dreamed up. They're the things you keep complaining about.",
        "b": "Log a week of complaints. Anything that comes up three times is a topic.",
        "tags": ["Method"],
        "a": "opinion",
        "p": ["creator"],
        "st": "idea",
        "day": 0,
        "src": "Reading notes",
    },
    {
        "k": "video",
        "vid": ["v-aurora", 540, 720],
        "t": "Agents vs. chatbots, explained in 30 seconds",
        "b": "One waits for you to ask, the other does the work. Open on a task map that flows like an aurora.",
        "tags": ["AI", "Explainer"],
        "a": "explain",
        "p": ["newbie"],
        "st": "outline",
        "day": -1,
        "sch": [2, 20],
        "pf": "TikTok",
        "src": "Vertical script",
    },
    {
        "k": "web",
        "img": ["topo", 720, 720],
        "t": "A pricing map for indie developers",
        "b": "Forty indie pricing pages on one topographic map, so the peaks and valleys jump out.",
        "tags": ["Indie hacking", "Pricing"],
        "a": "data",
        "p": ["indie"],
        "st": "published",
        "day": -6,
        "pub": -2,
        "pf": "X",
        "url": "https://example.com/pricing-map",
        "src": "example.com",
    },
    {
        "k": "image",
        "img": ["facade", 720, 940],
        "t": "Old facades: a design system rewritten by time",
        "b": "Every window is a patch from whoever came later. A perfect way to talk about tech debt.",
        "tags": ["Design", "Metaphor"],
        "a": "analogy",
        "p": ["creator"],
        "st": "idea",
        "day": -2,
        "src": "Street photo",
    },
    {
        "k": "note",
        "t": "A 10-minute checklist before you hit publish",
        "b": "Does the title have a verb? Are the first three seconds plain English? Is the cover readable on a phone? Does the ending ask for just one thing?",
        "tags": ["Workflow"],
        "a": "list",
        "p": ["creator"],
        "st": "ready",
        "day": -2,
        "sch": [1, 9],
        "pf": "X",
        "src": "My own checklist",
    },
    {
        "k": "image",
        "img": ["poster-en", 720, 960],
        "t": "Slow writing: growing one thought into a long-form post",
        "b": "A week of not chasing trends: 200 words a day, stitched into one piece on day seven.",
        "tags": ["Writing"],
        "a": "story",
        "p": ["creator"],
        "st": "published",
        "day": -12,
        "pub": -5,
        "pf": "Substack",
        "src": "Cover experiment",
    },
    {
        "k": "quote",
        "t": "The best tools end up forgotten.",
        "b": "A product essay about the things you stop noticing.",
        "tags": ["Product"],
        "a": "opinion",
        "p": ["indie"],
        "st": "idea",
        "day": -3,
        "src": "Quick note",
    },
    {
        "k": "video",
        "vid": ["v-tide", 720, 540],
        "t": "Tidal working: two hours deep, one hour ashore",
        "b": "Attention as a tide. Open with five seconds of waves and one question.",
        "tags": ["Productivity"],
        "a": "analogy",
        "p": ["newbie", "creator"],
        "st": "published",
        "day": -8,
        "pub": -3,
        "pf": "YouTube",
        "src": "Storyboard sketch",
    },
    {
        "k": "image",
        "img": ["ink", 720, 960],
        "t": "What landscape painting knows about visual hierarchy",
        "b": "Sharp foreground, misty distance. Classical landscape painters worked out interface hierarchy centuries ago.",
        "tags": ["Design", "Culture"],
        "a": "analogy",
        "p": ["creator"],
        "st": "outline",
        "day": -4,
        "sch": [6, 20],
        "pf": "LinkedIn",
        "src": "Exhibition notes",
    },
    {
        "k": "web",
        "img": ["collage", 780, 620],
        "t": "Ten charts worth a screenshot",
        "b": "Collect restrained, beautiful charts and break down what each one chose to leave out.",
        "tags": ["Data", "Design"],
        "a": "list",
        "p": ["creator"],
        "st": "idea",
        "day": -4,
        "url": "https://example.com/charts",
        "src": "example.com",
    },
    {
        "k": "image",
        "img": ["dunes", 720, 960],
        "t": "Day 300 of a one-person company: three pivots in the desert",
        "b": "The revenue curve, the mistakes, and the afternoon I almost quit.",
        "tags": ["Solo business", "Retrospective"],
        "a": "story",
        "p": ["indie"],
        "st": "published",
        "day": -14,
        "pub": -7,
        "pf": "LinkedIn",
        "src": "Retro draft",
    },
    {
        "k": "note",
        "t": "The 5 questions people ask most in the comments",
        "b": "1. Can I do this without a tech background? 2. What does it cost per month? 3. Which model? 4. Is my data safe? 5. How long until I get the hang of it?",
        "tags": ["Audience insight"],
        "a": "qa",
        "p": ["newbie"],
        "st": "outline",
        "day": -5,
        "src": "Comments",
    },
    {
        "k": "image",
        "img": ["riso", 720, 860],
        "t": "Cover color test: why bold stripes get more clicks",
        "b": "Three A/B rounds. Stripes won on clicks but didn't keep people watching any longer.",
        "tags": ["Covers", "Experiment"],
        "a": "data",
        "p": ["creator"],
        "st": "published",
        "day": -20,
        "pub": -9,
        "pf": "Instagram",
        "src": "Test log",
    },
    {
        "k": "quote",
        "t": "You don't lack ideas. You lack a place to keep them.",
        "b": "Could be the opening line for Media Desk itself.",
        "tags": ["Method"],
        "a": "opinion",
        "p": ["creator"],
        "st": "idea",
        "day": -6,
        "src": "Quick note",
    },
    {
        "k": "video",
        "vid": ["v-bus", 720, 480],
        "t": "The first product I finished on a night bus",
        "b": "City lights in the background, told in first person. Mood first, go light on the tech.",
        "tags": ["Story", "Indie hacking"],
        "a": "story",
        "p": ["indie", "newbie"],
        "st": "published",
        "day": -25,
        "pub": -12,
        "pf": "TikTok",
        "src": "Vlog",
    },
    {
        "k": "image",
        "img": ["sea", 900, 600],
        "t": "The nerve to leave space: three products that got better after cutting half their features",
        "b": "Deleting is a design decision too. Make the case with real examples.",
        "tags": ["Product", "Design"],
        "a": "case",
        "p": ["indie", "creator"],
        "st": "idea",
        "day": -7,
        "src": "Product notes",
    },
    {
        "k": "web",
        "img": ["stairs", 720, 720],
        "t": "The growth staircase: the real stages from 0 to 10k followers",
        "b": "Each step needs different work. Don't use a 100k playbook to win your first thousand.",
        "tags": ["Growth"],
        "a": "data",
        "p": ["creator"],
        "st": "draft",
        "day": -8,
        "sch": [8, 20],
        "pf": "LinkedIn",
        "url": "https://example.com/steps",
        "src": "example.com",
    },
    {
        "k": "image",
        "img": ["still", 720, 860],
        "t": "An orange on the desk: an opening about attention",
        "b": "Stare at an orange for one minute, then ask the viewer: when did you last focus like that?",
        "tags": ["Openings", "Productivity"],
        "a": "story",
        "p": ["newbie"],
        "st": "idea",
        "day": -9,
        "src": "Quick idea",
    },
    {
        "k": "image",
        "img": ["emboss-en", 760, 760],
        "t": "The feel of type: why embossed letters make you want to touch the screen",
        "b": "From letterpress to the comeback of skeuomorphism in interfaces.",
        "tags": ["Design", "Typography"],
        "a": "explain",
        "p": ["creator"],
        "st": "idea",
        "day": -10,
        "src": "Type specimen",
    },
    {
        "k": "video",
        "vid": ["v-ink", 600, 600],
        "t": "Eight seconds of ink: a transition library",
        "b": "Ink spreading in water works as a chapter transition. Package it as a set.",
        "tags": ["Footage", "Editing"],
        "a": "list",
        "p": ["creator"],
        "st": "idea",
        "day": -11,
        "src": "Stock clips",
    },
    {
        "k": "note",
        "t": "Just one thing this week",
        "b": "Cut the path from idea to finished post to under 24 hours, then track how much more you publish in a week.",
        "tags": ["Experiment", "Workflow"],
        "a": "story",
        "p": ["creator"],
        "st": "idea",
        "day": -12,
        "src": "Weekly plan",
    },
    {
        "k": "image",
        "img": ["aurora", 800, 800],
        "t": "Gradients are back: why every AI product looks the same",
        "b": "When every product uses the same gradient, where does the difference go?",
        "tags": ["Design", "AI"],
        "a": "opinion",
        "p": ["creator", "indie"],
        "st": "idea",
        "day": -13,
        "src": "Trend watch",
    },
    {
        "k": "image",
        "img": ["night", 720, 900],
        "t": "City lights at night: 6 moods for long-form images",
        "b": "A mood board of images that won't look like everyone else's.",
        "tags": ["Footage"],
        "a": "list",
        "p": ["creator"],
        "st": "idea",
        "day": -15,
        "src": "Mood board",
    },
    {
        "k": "image",
        "img": ["blush", 800, 800],
        "t": "A letter to the anxious beginner",
        "b": "No tactics. Just what actually happens in your first year.",
        "tags": ["Beginners", "Empathy"],
        "a": "story",
        "p": ["newbie"],
        "st": "outline",
        "day": -16,
        "src": "Reader letter",
    },
]

ANGLES = [
    {
        "id": "case",
        "name": "Real case",
        "hook": "What one person did, and how it went",
        "prompt": "Start from a specific person and specific numbers, then pull out the method.",
        "sample": True,
    },
    {
        "id": "opinion",
        "name": "Contrarian take",
        "hook": "Everyone says A. It's actually B.",
        "prompt": "Lay out the common view, knock it down with evidence, and end on a question worth discussing.",
        "sample": True,
    },
    {
        "id": "explain",
        "name": "30-second explainer",
        "hook": "One plain sentence that makes a concept click",
        "prompt": "One analogy, no jargon, so an outsider could explain it back.",
        "sample": True,
    },
    {
        "id": "data",
        "name": "Data experiment",
        "hook": "I tested it N times. Here's what happened.",
        "prompt": "Give the sample size, the process and the counterintuitive result, plus a way to reproduce it.",
        "sample": True,
    },
    {
        "id": "analogy",
        "name": "Cross-domain analogy",
        "hook": "This is really the same thing as X",
        "prompt": "Re-explain an old problem with a picture from another field.",
        "sample": True,
    },
    {
        "id": "list",
        "name": "Save-worthy list",
        "hook": "Save this, you'll need it",
        "prompt": "Clear structure people can follow as is. Built to be saved and shared.",
        "sample": True,
    },
    {
        "id": "story",
        "name": "First-person story",
        "hook": "The day I almost quit",
        "prompt": "A scene, a turn and real feeling. Keep the tech light.",
        "sample": True,
    },
    {
        "id": "qa",
        "name": "Answering comments",
        "hook": "The questions you ask most",
        "prompt": "Answer real questions directly and put readers' own words in the title.",
        "sample": True,
    },
]

PEOPLE = [
    {
        "id": "newbie",
        "name": "Lena, curious beginner",
        "role": "Target reader",
        "note": "25 to 32, office job, wants AI to save time or start a side project, but gets scared off by jargon.",
        "traits": ["Jargon-shy", "Wants a first step", "Watches short videos"],
        "tone": 0,
        "sample": True,
    },
    {
        "id": "creator",
        "name": "Alex, fellow creator",
        "role": "Target reader",
        "note": "A few thousand followers. Cares about topics, covers and workflow, and will pay for a good method.",
        "traits": ["Method nerd", "Saves everything", "Checks the numbers"],
        "tone": 1,
        "sample": True,
    },
    {
        "id": "indie",
        "name": "Sam, indie developer",
        "role": "Target reader",
        "note": "Can code, but short on growth and pricing experience. Loves honest revenue breakdowns.",
        "traits": ["Wants the real story", "Hates fluff", "Long-form reader"],
        "tone": 2,
        "sample": True,
    },
    {
        "id": "editor",
        "name": "Maya, editing partner",
        "role": "Collaborator",
        "note": "Handles short-video edits and covers. Free on Tuesdays and Thursdays.",
        "traits": ["Editing", "Covers"],
        "tone": 3,
        "sample": True,
    },
]

SKILLS = [
    {
        "id": "seed_s_1",
        "name": "Lead with a number",
        "rule": "Put a concrete number or result in the first 50 words. No warm-up.",
        "text": "Lead with a number — Put a concrete number or result in the first 50 words. No warm-up.",
        "source": "Sample",
        "evidence": "Example: from 3 high-performing posts",
        "status": "active",
        "confidence": 0.82,
        "sample": True,
    },
    {
        "id": "seed_s_2",
        "name": "One piece, one point",
        "rule": "Cut every paragraph that doesn't serve the main point. Split it into a series if you have to.",
        "text": "One piece, one point — Cut every paragraph that doesn't serve the main point.",
        "source": "Sample",
        "evidence": "Example: you made this edit in 2 drafts",
        "status": "active",
        "confidence": 0.74,
        "sample": True,
    },
    {
        "id": "seed_s_3",
        "name": "Use readers' words in the title",
        "rule": "Lift exact phrases from the comments into the title. They get more clicks than your own summary.",
        "text": "Use readers' words in the title — Lift exact phrases from the comments into the title.",
        "source": "Sample",
        "evidence": "Example: needs more data to confirm",
        "status": "proposed",
        "confidence": 0.51,
        "sample": True,
    },
]

ACCOUNTS = [
    {"id": "seed_ac_1", "platform": "X", "handle": "hermes_creator", "followers": 14840, "url": "https://x.com/hermes_creator", "sample": True},
    {"id": "seed_ac_2", "platform": "YouTube", "handle": "Hermes Media Lab", "followers": 28620, "url": "https://youtube.com/@hermesmedialab", "sample": True},
    {"id": "seed_ac_3", "platform": "LinkedIn", "handle": "Hermes Engineering", "followers": 21300, "url": "https://linkedin.com/in/hermes-engineering", "sample": True},
    {"id": "seed_ac_4", "platform": "Substack", "handle": "The Agent Dispatch", "followers": 9470, "url": "https://agentdispatch.substack.com", "sample": True},
]

STYLES = [
    {
        "id": "preset_ai_tech",
        "category": "Tech & Digital",
        "icon": "🤖",
        "name": "AI tech creator",
        "summary": "Turns complex tech into one analogy you can follow, then tells you why it matters to you.",
        "tone": "Curious and clear-headed. Excited without the hype, and says so when a claim is unverified.",
        "sentences": "Mostly short sentences. Conclusion first, then the why. Every technical term is followed by a plain-English line.",
        "opening": "Open on something that just changed and say within three seconds why it's worth watching.",
        "structure": "What happened -> the idea, through an analogy -> what I saw when I tried it -> what it means for regular people.",
        "words": ["Put simply", "I tried it", "The key is", "Which means"],
        "avoid": ["game-changer", "mind-blowing", "insane", "conclusions without testing"],
        "samples": [
            "Put simply, it didn't get smarter. It finally remembers what you said a minute ago.",
            "I tried it. The first ten minutes were impressive. By minute eleven it was making things up.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_gadget",
        "category": "Tech & Digital",
        "icon": "📱",
        "name": "Gadget reviewer",
        "summary": "No spec-sheet reading. Just what's great and what makes you want a refund after two weeks.",
        "tone": "Practical and a little picky, on the side of people spending their own money.",
        "sentences": "Numbers and experience come in pairs. Lots of comparisons, few adjectives.",
        "opening": "Lead with the verdict: who should buy it and who should not.",
        "structure": "One-line verdict -> the best thing -> the most annoying thing -> versus last year or the competition -> buying advice.",
        "words": ["In my testing", "battery life", "worth it?", "who should buy", "who should skip"],
        "avoid": ["flagship experience", "punches above its weight", "copying the marketing"],
        "samples": [
            "In my testing it needed two charges a day. The thirty hours on the box only exist on the box.",
            "If the one you have still works, you can skip this year.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_travel",
        "category": "Travel & Food",
        "icon": "✈️",
        "name": "Travel creator",
        "summary": "Not a checklist. It puts you in the place, then hands you the details that actually help.",
        "tone": "Relaxed and visual, honest about what went wrong.",
        "sentences": "Mix long and short. Write what you saw, heard and smelled, and make the practical details specific.",
        "opening": "Open on one specific moment, like the harbor at six in the morning.",
        "structure": "One moment -> why I came -> three places truly worth it -> what went wrong -> time and cost.",
        "words": ["That day", "locals", "per person", "book ahead", "skip"],
        "avoid": ["paradise on earth", "once in a lifetime", "hidden gem"],
        "samples": [
            "At six that morning the harbor had no tourists, just fish being unloaded and a bowl of noodles too hot to eat.",
            "About $15 a person, but skip the place by the entrance. Locals all head down the alley.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_food",
        "category": "Travel & Food",
        "icon": "🍜",
        "name": "Food reviewer",
        "summary": "What the first bite is like, whether it's worth the price and how long the line is, all spelled out.",
        "tone": "Hungry and honest. Praises what is good and says when it isn't.",
        "sentences": "Specific texture words, short punchy lines, and always the price and location.",
        "opening": "Open on the bite you want most.",
        "structure": "The signature bite -> where, how much, how long the wait -> must-order and skip -> a one-line verdict.",
        "words": ["this bite", "per person", "the line", "skip it", "would go back"],
        "avoid": ["to die for", "literally crying", "praise without a verdict"],
        "samples": [
            "The first bite is crackly, and the richness only comes through after.",
            "About $8 a person and a forty-minute line. The food is worth it, the wait isn't. Go after two.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_vlog",
        "category": "Vlog & Life",
        "icon": "🎬",
        "name": "Daily vlogger",
        "summary": "Like a friend carrying a camera through the day. Small, funny moments and a quiet feeling at the end.",
        "tone": "Warm and natural, happy to laugh at yourself, never stiff.",
        "sentences": "Conversational, like talking while walking. Lots of 'then' and 'turns out'. Pauses are fine.",
        "opening": "Open with a small thing or a small surprise from today.",
        "structure": "Today's small surprise -> the day in order -> one small turn in the middle -> one honest feeling at the end.",
        "words": ["today", "then", "turns out", "didn't expect", "it was nice"],
        "avoid": ["hey guys", "lecturing", "forced life lessons"],
        "samples": [
            "I only went downstairs to grab a package. Turns out I sat out there for an hour.",
            "Nothing big happened, but it was a nice day.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_reading",
        "category": "Opinion & Thought",
        "icon": "📚",
        "name": "Book notes creator",
        "summary": "Not a summary of the book. One idea that changed your mind, turned into one thing you can do.",
        "tone": "Calm and sincere, about how a book won you over.",
        "sentences": "Start with a real-life problem, quote one line, then explain in short sentences.",
        "opening": "Open with a specific problem, then bring in the book.",
        "structure": "A problem I had -> one idea from the book -> an example -> one thing to try today.",
        "words": ["this book", "that's when I realized", "in other words", "try this"],
        "avoid": ["this book will change your life", "packed with value", "reciting the table of contents"],
        "samples": [
            "On this page I realized I wasn't short on time. I just refused to give anything up.",
            "In other words, decide what not to do first. You can try it today.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_career",
        "category": "Opinion & Thought",
        "icon": "💼",
        "name": "Career creator",
        "summary": "Opinion first. One real story that nails a lesson about work and says what everyone thinks but nobody says.",
        "tone": "Direct and clear-eyed, a little sharp but never mean.",
        "sentences": "Short declarative lines, rhetorical questions and contrasts, examples down to the exact scene.",
        "opening": "Open by rejecting something everyone believes.",
        "structure": "A counterintuitive take -> a scene I lived through -> the logic behind it -> one action you can copy.",
        "words": ["Stop", "The truth is", "I've seen", "next meeting"],
        "avoid": ["grind harder", "fear-mongering", "empty motivation"],
        "samples": [
            "Stop saying you're bad at managing up. You've been waiting for someone to notice you first.",
            "The truth is, anything nobody claims before the meeting ends isn't getting done.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_tutorial",
        "category": "Tutorials & Guides",
        "icon": "🛠️",
        "name": "How-to creator",
        "summary": "Shows you the result first, then walks you through step by step, with where each step tends to go wrong.",
        "tone": "Patient and efficient, like a friend sitting next to you.",
        "sentences": "Short sentences that start with a verb. Clear steps, one thing per step.",
        "opening": "Show the finished result and the time it saves.",
        "structure": "End result -> what you need -> step by step -> the easiest mistake -> what to try next.",
        "words": ["Step one", "click here", "careful", "once you're done", "saves"],
        "avoid": ["it's easy", "everyone knows this", "skipping steps"],
        "samples": [
            "Here's the result. What used to take two hours now takes three minutes.",
            "Careful, don't click OK yet. Check the format in the top right first. That's where nine out of ten mistakes happen.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
    {
        "id": "preset_story",
        "category": "Stories & Emotion",
        "icon": "🌙",
        "name": "Personal story creator",
        "summary": "Like a late-night talk with a friend, going from one small moment to something you finally understood.",
        "tone": "Relaxed and honest, willing to share the embarrassing parts, slow to judge.",
        "sentences": "Long and short lines mixed, natural pauses, lots of detail, few conclusions.",
        "opening": "Open on a specific time and place.",
        "structure": "A scene -> what happened -> what I didn't get at the time -> the one line that made sense later.",
        "words": ["That night", "only later did I realize", "actually", "honestly"],
        "avoid": ["if you know you know", "life-coach voice", "putting anyone down"],
        "samples": [
            "At eleven that night we sat in the car and neither of us spoke first.",
            "Only later did I realize she didn't want an answer. She wanted someone to hear her out.",
        ],
        "source": "Preset",
        "preset": True,
        "sample": True,
        "createdAt": "2026-01-01T00:00:00Z",
    },
]


def _build_media(row: dict) -> dict | None:
    if "img" in row:
        name, w, h = row["img"]
        return {"src": f"media-desk/files/{name}.jpg", "w": w, "h": h}
    if "vid" in row:
        name, w, h = row["vid"]
        return {
            "src": f"media-desk/files/{name}.mp4",
            "poster": f"media-desk/files/{name}-poster.jpg",
            "w": w,
            "h": h,
        }
    return None


def seed_state(now: datetime | None = None) -> dict:
    """Return rich initial sample state with 25 posts, 8 angles, 4 personas, 9 style presets."""
    if now is None:
        now = datetime.now(timezone.utc)

    items = []
    for index, row in enumerate(RAW_ITEMS):
        item_id = f"seed_{index + 1}"
        media = _build_media(row)
        created_at = _shift(now, row["day"], 9 + (index % 11), (index * 7) % 60)

        pub_day = row.get("pub")
        sch = row.get("sch")
        published_at = _shift(now, pub_day, 20) if pub_day is not None else None
        if sch is not None:
            scheduled_at = _shift(now, sch[0], sch[1])
        elif published_at is not None:
            scheduled_at = published_at
        else:
            scheduled_at = None

        items.append({
            "id": item_id,
            "kind": row["k"],
            "title": row["t"],
            "body": row["b"],
            "tags": list(row["tags"]),
            "status": row["st"],
            "angleId": row["a"],
            "personaIds": list(row["p"]),
            "media": media,
            "url": row.get("url"),
            "source": row["src"],
            "createdAt": created_at,
            "scheduledAt": scheduled_at,
            "publishedAt": published_at,
            "platform": row.get("pf"),
            "drafts": {},
            "sample": True,
        })

    # Historical metrics for published items across all platforms
    peak_views = {
        "seed_4": 15400,
        "seed_7": 9200,
        "seed_9": 28600,
        "seed_12": 18400,
        "seed_14": 14200,
        "seed_16": 32800,
    }
    metrics = []
    published_items = [it for it in items if it.get("publishedAt")]
    for it in published_items:
        pub_dt = datetime.fromisoformat(it["publishedAt"].replace("Z", "+00:00"))
        peak = peak_views.get(it["id"], 12000)
        days_live = max(1, (now - pub_dt).days + 1)
        for d in range(min(days_live, 15)):
            metric_dt = pub_dt + timedelta(days=d)
            if metric_dt > now:
                break
            decay = math.exp(-d * 0.28)
            jitter = 0.88 + ((d * 37 + hash(it["id"])) % 24) / 100.0
            views = max(120, round(peak * decay * jitter))
            is_viral = it.get("platform") in ("X", "Instagram", "TikTok")
            saves = round(views * (0.05 if is_viral else 0.018))
            likes = round(views * (0.062 if is_viral else 0.042))
            comments = round(views * 0.012)
            shares = round(views * (0.024 if is_viral else 0.008))
            metrics.append({
                "id": f"seed_m_{it['id']}_{d}",
                "itemId": it["id"],
                "platform": it.get("platform"),
                "date": metric_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "views": views,
                "likes": likes,
                "comments": comments,
                "shares": shares,
                "saves": saves,
                "engagements": likes + comments + shares + saves,
                "sample": True,
            })

    return {
        "version": 4,
        "items": items,
        "people": [dict(p) for p in PEOPLE],
        "angles": [dict(a) for a in ANGLES],
        "styles": [dict(s) for s in STYLES],
        "skills": [dict(sk) for sk in SKILLS],
        "accounts": [dict(acc) for acc in ACCOUNTS],
        "metrics": metrics,
        "chat": [],
        "activeStyleId": None,
        "modelStatus": {"ok": True, "error": None},
        "presetVersion": 2,
        "sampleCleared": False,
    }
