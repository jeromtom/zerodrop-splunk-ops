# SUBMIT_DAY.md — DropWatch last-mile runbook

**Deadline: Jun 15, 2026, 9:00 AM PDT = 9:30 PM IST (Jun 15).** Devpost lets you
**edit a submission until the deadline**, so submit once you have a working video
link — you can still polish afterward.

> The whole submission is automatable **except one step: the demo video.** Nobody
> can screen-record the product but you. Do Step 1, then Step 2/4 can be done by
> the Claude-in-Chrome agent even while you're away.

---

## 0. Pre-flight before you step away (2 min)

- [ ] Logged into **Devpost** as dev.jeromtom@gmail.com (so the agent isn't blocked by a login wall).
- [ ] Logged into **Google/YouTube** (for the upload).
- [ ] Repo is **public** ✅ (already) · MIT license detected ✅ · Splunk trial live ✅ (119 events).
- [ ] You have the **public video URL** (Step 1) and a **gallery screenshot** ready (Step 1d).

---

## 1. The one thing only you can do — the video (~20–40 min)

**Start the app (live Splunk run):**
```
npm run db:local            # terminal 1
npm run db:seed             # terminal 2
PORT=3055 npm run dev       # terminal 2  -> http://localhost:3055
```
Log in `demo@zerodrop.app / drop-zero-2026`. Second tab: Splunk with the imported
`dashboards/dropwatch.xml` (index already holds the 119 events).

**1a. Record** with **Win+Alt+R** (Xbox Game Bar), following `DEMO_SCRIPT.md` beats:
landing → **Unleash the stampede** (100/100, oversold 0) → Splunk
`index=zerodrop sourcetype=zerodrop:telemetry | stats count by event` + timechart →
`/ops` **Re-scan** (health 75, HIGH oversell-bot, 10.66.6.0/24) → **Flag IP cluster**
→ live feed. Record 1080p+.

**1b. Audio — pick one:**
- **Fast (no avatar, ~single pass):** record the screen **silent**, then in
  **Clipchamp** (built into Windows) drop the `audio/*.mp3` clips over the matching
  beats in this order → **Option B (2:37):**
  `01-problem → 02-hec → 03-agent-short → 04-apply → 05-close`.
- **Polished (avatar bookends, ~+30 min) → Option D (2:48):** build a ~9s
  **avatar intro** and **~9s avatar outro** in **ElevenLabs Avatars** (ElevenCreative
  → Image & Video; your Creator plan unlocks it — see `VOICEOVER.md` §3 for the
  step-by-step + futuristic prompt). Sandwich the Option-B screen+VO between them.

**1c.** Export MP4 (H.264) 1080p. **Confirm total runtime < 3:00.**

**1d.** Take **one screenshot of `/ops`** showing the findings (health score + the
HIGH oversell-bot card) — this is your Devpost **gallery image**.

**1e. Upload to YouTube** → set **Public** (Unlisted is fine while testing, but the
final link must be Public) → **English** → **copy the watch URL.**

---

## 2. Devpost form — exact field → value (source of truth: `SUBMISSION.md`)

Go to https://splunk.devpost.com/ → **Submit a project / Manage submission**.

| Devpost field | What to paste |
|---|---|
| **Project name** | `DropWatch` |
| **Elevator pitch** (tagline, ~200 char) | `SUBMISSION.md` §1 tagline → *"An agentic observability layer that turns oversell-proof flash drops into Splunk telemetry — and reasons over it."* |
| **Project story** (the big rich-text box) | Paste `SUBMISSION.md` **§3 Inspiration → §9 What's next**, in order (Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next). Keep the headings. |
| **Built with** (tags) | `SUBMISSION.md` §10 → splunk, splunk-hec, splunk-mcp-server, splunk-hosted-models, mcp, next.js, react, typescript, dynamodb, aws, node.js, llm, observability, agentic-ai |
| **"Try it out" links** | Repo: `https://github.com/jeromtom/zerodrop-splunk-ops` |
| **Video demo link** | your YouTube URL from Step 1e |
| **Image gallery / thumbnail** | the `/ops` screenshot from Step 1d |
| **Submission category / track** | **Observability** |
| **Bonus / additional prizes** (if shown) | tick **Best Use of Splunk MCP Server**, and **Best Use of Splunk Hosted Models** (we use both in code/docs — honest framing is already in §12) |
| **"Which Splunk AI capability"** (if asked) | `SUBMISSION.md` §12 |
| **"Significant update" / pre-existing project** (if asked) | From `UPDATES.md`: DropWatch is a new agentic-observability layer built Jun 14–15 2026, after the May 18 2026 submission-period start; ZeroDrop's base existed before, the DropWatch layer did not. |
| **Eligibility / region** (if asked) | India — eligible (not on the excluded list). |

---

## 3. Submit

Click through to **Submit**. After submitting, **open your own submission page** and
confirm the video plays and the repo link works. You can keep editing until the
deadline.

---

## 4. Claude-in-Chrome automation prompt (fills + submits the form)

> Paste the block in Step 4 of this file's companion (also in chat). **Replace the
> video URL placeholder first.** The agent reads `SUBMISSION.md` for the exact copy,
> fills every field, opts into the right tracks, and submits — pausing only if a
> login/captcha wall appears.
