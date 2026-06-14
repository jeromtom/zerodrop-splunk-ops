# DEMO_SCRIPT — DropWatch, under 3 minutes

Target runtime **2:40**. Record 1080p+, narrate over it. The story: a live drop
goes viral → telemetry lands in **Splunk via HEC** → the **DropWatch agent** reads
the live stream, reasons with an LLM, detects an oversell-bot cluster + a stampede,
recommends an action → operator applies it.

> **Verified live on 2026-06-14** against the Splunk Cloud trial: HEC ingestion
> works (events land in the `zerodrop` index), and `/ops` runs the agent with the
> **real AI/ML LLM** (`telemetry: buffer · LLM: aiml`), reporting health 75 + a HIGH
> oversell-bot finding. Record what's described below — it matches the actual UI.

## What is and isn't live on the trial (so narration stays honest)
- **LIVE:** ZeroDrop hot paths → Splunk HEC ingestion → the `zerodrop` index +
  dashboard. The DropWatch agent + **live LLM reasoning** (AI/ML API).
- **WIRED but not active on a Cloud *trial*:** reading telemetry *back* out of
  Splunk via the **REST search API / Splunk MCP Server**, and **Splunk Hosted
  Models**. Cloud trials don't expose the search port, so `/ops` analyzes its
  in-process telemetry buffer instead. These paths are implemented + documented
  (README, docs/SPLUNK_MCP.md) and light up on a non-trial stack — that's also the
  path to the optional **$1,000 Best-Use-of-MCP** bonus. Narrate them as "wired,
  shown in the code/docs," not as running, unless you stand up an MCP server.

## Recommended recording mode
- **Primary (best AI story):** keep `AIMLAPI_API_KEY` set → header reads
  `LLM: aiml`, real model reasoning. Reliably shows the **HIGH oversell-bot**
  finding + health 75; the **stampede** shows in the metrics panel (claim rate
  ~7× baseline, peak ~64/min). Narrate the stampede from those metrics.
- **Alternative (guaranteed two finding cards):** unset `AIMLAPI_API_KEY` before
  `npm run dev` → header reads `LLM: rules`; the deterministic engine renders
  **both** "Stampede onset" and "Oversell-bot cluster" as separate HIGH cards
  (this is what `npm run ops:test` asserts, 10/10). Use this if you want two cards
  on screen; you lose the "live LLM" line.

---

**Prep**
- App at `http://localhost:3000` (run `npm run db:local`, then `npm run db:seed`,
  then `npm run dev`; log in `demo@zerodrop.app / drop-zero-2026`). Note: if your
  other project uses :3000, run `PORT=3055 npm run dev` and use that URL.
- Second window: Splunk with the imported `dashboards/dropwatch.xml` (the index
  already holds seeded demo events).
- Terminal ready with `npm run ops:demo` (B-roll: prints the agent report end-to-end).

### 0:00–0:20 — The problem + the guarantee
> "Flash drops sell out in seconds, and the #1 way brands lose trust is
> overselling. ZeroDrop makes that impossible — every claim is one atomic
> DynamoDB conditional write. Once you're safe, the question becomes: what's
> actually happening during the drop? That's DropWatch."

Show the landing page, then a drop at 0/100.

### 0:20–0:50 — Generate a live drop (telemetry → Splunk via HEC)
- Click **Unleash the stampede**. Stock bar races to **100/100, oversold 0**.
> "Every claim, hold, expiry, oversell-reject, waitlist and checkout just emitted
> a structured event to Splunk over HTTP Event Collector."

Cut to Splunk; run `index=zerodrop sourcetype=zerodrop:telemetry | stats count by
event`. The events are there. Point at the **claim-rate timechart** spiking and
the **oversell-reject by /24 subnet** table.

### 0:50–1:50 — The agent reasons (the AI moment)
Open **/ops**, click **Re-scan**.
> "DropWatch is an agent: it reads the live telemetry stream, summarises it, and
> an LLM reasons about drop health."

Point at the header (`telemetry: buffer · LLM: aiml`) and walk the result:
- **Drop-health score: 75/100.**
- **[HIGH] Oversell-bot activity** — narrate the agent's own words: the oversell
  reject rate is ~58%, and the **10.66.6.0/24 subnet** produces the majority of
  rejects — the bot signature. **No oversell happened; the DynamoDB guard held.**
- Point at the **metrics panel**: claim rate ~7× baseline, peak ~64/min — the
  stampede. (In `rules` mode this is its own HIGH card.)

### 1:50–2:25 — Recommend → apply (close the loop)
> "It doesn't just alert — it recommends a concrete action."
- On the finding card, click **Flag IP cluster** (`flag_ip_cluster` →
  10.66.6.0/24) → green "✓ flagged."
> "The action is recorded to the live feed, so the remediation is observable too."

Show the **Applied actions / live feed** updating.

### 2:25–2:40 — Close
> "DropWatch turns ZeroDrop's hot paths into Splunk telemetry over HEC, and an
> agent that reads it, reasons with an LLM, and acts — with the MCP Server and
> Splunk Hosted Models paths wired for a production stack. Oversell-proof, and now
> fully observable."

Optional B-roll: terminal `npm run ops:demo` printing the severity-ranked report.

---

**Backup (no live Splunk at record time):** the whole flow runs offline. On `/ops`
click **Run mock drop** (seeds the buffer), then **Re-scan** — same findings,
header shows `telemetry: buffer`. Narrate that the live Splunk HEC path is verified
and the MCP/Hosted-Models paths are wired + documented, gated behind env.
