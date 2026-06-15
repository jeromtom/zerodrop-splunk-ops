# DropWatch: agentic ops for oversell-proof flash drops

**Splunk Agentic Ops Hackathon** entry · Track: **Observability ($3,000)** · also targeting **Best Use of Splunk MCP Server ($1,000)**

### 🔗 Links

- **🎬 Demo video (2:46):** https://youtu.be/QsFjFh-rE7Y
- **🌐 Live site:** https://dropwatch.pages.dev (also at https://dropwatch.jeromtom.com, custom domain provisioning)
- **💧 Join the waitlist / see it live:** https://dropwatch.pages.dev

---

## The insight: provable correctness creates clean signals

Most observability fights noise. DropWatch starts from a system where one class of
event **cannot lie**.

ZeroDrop, the flash-drop platform underneath, makes overselling **impossible by
construction**: every claim is a single DynamoDB conditional write
(`claimed < totalStock`). There is no lock, no read-modify-write, no race. So a
single fact follows with certainty: an **oversell-reject event only ever fires
when the database guard actually held against a post-sellout claim attempt**.

That turns the oversell-reject stream into a **clean behavioral signal**, not a
guess. Legitimate buyers stop trying when an item sells out. Bots keep hammering.
When provable correctness removes the ambiguity, the reject stream becomes
excellent **bot-detection fuel**: a tight subnet cluster dominating rejects after
sellout is the signature of automated checkout bots, with zero false-positive
risk from real oversells, **because real oversells can't happen.**

> Provable correctness creates clean signals. DropWatch is the agent that reads
> them. It pulls ZeroDrop telemetry back out of Splunk, reasons with an LLM,
> scores drop-health 0-100, recommends one concrete action, and writes the
> action back into Splunk.

## Works on any event stream

The bot-detection story is the sharpest example, but DropWatch is a **general
agentic ops pipeline**, not a drops-only gadget. The loop is:

```
pull → summarize → reason → score → recommend → apply
```

- **pull** telemetry from a Splunk index (via MCP / REST / local buffer)
- **summarize** a window into compact features, including a **generic per-event-type
  rate series** that knows nothing about the flash-drop taxonomy
- **reason** with an LLM over those features, with a deterministic rules engine as
  an always-on fallback
- **score** the stream 0-100
- **recommend** one concrete action
- **apply** it and write a breadcrumb back into Splunk

The drop-specific detectors (stampede, oversell-bot, hold-expiry storm, waitlist
collapse) sit **on top of** a **generic baseline anomaly detector** (z-score over
per-minute rates of *any* event type). Point it at a different index and the
generic detector still flags a service whose error rate jumped 6 sigma, a queue
whose depth is climbing, or a route whose latency events spiked. **Software teams,
ITOps, and NetOps** get the same pull → reason → score → recommend → apply loop
over their own streams; the drop taxonomy is just the demo payload.

## New in this build

- **Generic z-score anomaly detector:** baseline mean/std per event type, scores
  the recent rate in sigma, so DropWatch surfaces anomalies on event streams it
  has never seen a schema for. (`lib/dropwatch/analyze.ts`: `rateSeries`, `RateStats`.)
- **Leading-indicator early warning:** claim-rate **velocity and acceleration**,
  so a building surge is flagged *before* it becomes a hard stampede, not after.
  (`analyze.ts`: `claimVelocity`.)
- **AI alert webhooks (Slack / PagerDuty):** when a scan produces a high/critical
  finding or drop-health drops below threshold, the agent **auto-pages on-call**
  with the reasoning and the one-click action, no human in the loop. Slack Block
  Kit by default, generic JSON for PagerDuty and others.
  (`lib/dropwatch/notify.ts`.)
- **Packaged Splunk app:** `splunk-app/` ships the dashboard plus **scheduled
  detector alerts** that mirror the agent's logic natively in Splunk, so the
  detectors keep running even when the app is offline.
- **Agent self-observability (AI agent monitoring):** DropWatch instruments its
  **own** reasoning loop. Every scan records which LLM tier fired (Hosted Models /
  AIML / rules), the model, LLM latency, scan time, and fallbacks, ships them to
  Splunk as `dropwatch:agent`, and shows them in an "Agent runtime" panel on `/ops`.
  The direct fit for Splunk's newest capability: the agent is observable the same
  way the app it watches is. (`lib/dropwatch/agentObs.ts`.)

## What's AI/agentic about it

Splunk's rules require a real AI/agentic element (a passive dashboard is not
enough). DropWatch satisfies this several ways:

1. **LLM reasoning:** the agent feeds grounded features to an LLM and gets back
   severity-ranked findings (`lib/dropwatch/llm.ts`).
2. **Closed agentic loop:** pull → summarize → reason → score → recommend →
   apply, surfaced at `/ops` with one-click remediation that writes a breadcrumb
   back into Splunk.
3. **Automated response:** high/critical findings page ops via webhook with no
   human in the loop (`lib/dropwatch/notify.ts`).
4. **Splunk MCP Server:** the agent issues its SPL through the MCP server's
   search tool (`lib/dropwatch/search.ts`). See [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md).

## Live vs wired (honest status)

We are explicit about what runs today versus what is implemented and documented
but not provisioned on the Splunk Cloud trial.

| Capability | Status |
| --- | --- |
| **HEC ingestion** (ZeroDrop hot paths → Splunk via HTTP Event Collector) | **LIVE / verified** |
| **LLM reasoning via AI/ML API** (OpenAI-compatible, `gpt-4o-mini`) | **LIVE / verified** |
| Generic z-score anomaly detector + leading-indicator early warning | live in-app |
| AI alert webhooks (Slack / PagerDuty) | live in-app (no-op without `ALERT_WEBHOOK_URL`) |
| Deterministic rules engine (zero-key fallback) | live in-app |
| **Splunk MCP Server** search path | **wired + documented, not running on the Cloud trial** |
| **Splunk Hosted Models** reasoning path | **wired + documented, not running on the Cloud trial** |

The MCP and Hosted-Models paths are real code with documented contracts
(`search.ts`, `llm.ts`, [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md)); they take
priority automatically the moment their env vars are set. We do **not** claim
they are live. The agent is built so it **always** produces output regardless:
Hosted Models → AI/ML API → deterministic rules.

## Architecture

```
ZeroDrop hot paths
   → lib/splunk.ts (HEC)                 [LIVE]
   → Splunk index (zerodrop)
   → DropWatch agent
        pull   : search.ts (MCP → REST → buffer)
        reason : llm.ts (Hosted Models → AIML → rules)
        score  : analyze.ts (features, z-score, velocity, health 0-100)
        apply  : actions.ts (+ breadcrumb back to Splunk)
        page   : notify.ts (Slack / PagerDuty webhook)
   → /ops UI (live feed, health score, findings, Apply buttons)
   → splunk-app/ (dashboard + scheduled detector alerts, native in Splunk)
```

See [architecture_diagram.md](./architecture_diagram.md) for the full mermaid diagram.

## Quick start: MOCK MODE (zero Splunk, zero LLM keys)

The whole agent runs offline against a synthesized telemetry stream. No account,
no install of the Next app required (uses Node's built-in TS support):

```bash
npm run ops:demo    # synth a drop -> agent detects stampede + oversell-bot
npm run ops:test    # end-to-end assertions (all green)
```

Sample `ops:demo` output:

```
[HIGH] Stampede onset detected
        why : Claim rate spiked to 65/min, 7.22x the baseline...
        fix : Enable the queue throttle on drop aura-1-lunar...
[HIGH] Oversell-attempt bot cluster
        why : 140 oversell-reject events; subnet 10.66.6.0/24 (12 IPs) alone produced 75 (54%)...
        fix : Flag IP cluster 10.66.6.0/24 ...
```

## Quick start: the full app + /ops dashboard

```bash
npm install
npm run db:local    # terminal 1: local DynamoDB (dynalite, no Docker)
npm run db:seed     # terminal 2: table + demo data
npm run dev         # http://localhost:3000
```

- Demo brand login: **demo@zerodrop.app / drop-zero-2026**
- Open **/ops** → click **Run mock drop** → watch the live telemetry feed,
  drop-health score, and the agent's severity-ranked findings with **Apply**
  buttons. (Works with no Splunk: telemetry buffers locally and the rules engine
  reasons. Add Splunk/LLM env to go live, see [.env.example](./.env.example).)

## Go live with Splunk

1. Create a Splunk account + HEC token, enable an index, then set
   `SPLUNK_HEC_URL` / `SPLUNK_HEC_TOKEN`. Full runbook in [SETUP.md](./SETUP.md).
2. Import [dashboards/dropwatch.xml](./dashboards/dropwatch.xml), or install the
   packaged app in `splunk-app/` for the dashboard **plus scheduled detector alerts**.
3. (Optional) set `ALERT_WEBHOOK_URL` to a Slack or PagerDuty endpoint to have the
   agent auto-page ops on high/critical findings.
4. (Optional, for the MCP prize) run a Splunk MCP Server and set `SPLUNK_MCP_URL`.
   See [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md).

## Repo map (DropWatch additions in **bold**)

```
lib/drops.ts             ZeroDrop data layer, now emits telemetry on every hot path
lib/splunk.ts            **HEC client (stdlib fetch, no-ops without env), LIVE**
lib/dropwatch/
  events.ts              **telemetry taxonomy (event types, masking)**
  sink.ts                **the choke point: ship to HEC + local ring buffer**
  search.ts              **pull telemetry back: MCP server -> REST -> buffer**
  synth.ts               **mock-mode synthesizer (planted stampede + bot)**
  analyze.ts             **features + GENERIC z-score detector + leading-indicator + rules**
  llm.ts                 **LLM reasoning: Hosted Models -> AIML -> rules**
  notify.ts              **AI alert webhooks (Slack / PagerDuty), automated response**
  agent.ts               **the orchestrator (scan cycle)**
  actions.ts             **applied-action store + telemetry breadcrumb**
app/ops/page.tsx         **the /ops dashboard route**
components/OpsDashboard.tsx  **live feed, health score, findings, apply**
app/api/ops/*            **scan / feed / seed / apply endpoints**
dashboards/dropwatch.xml **importable Splunk SimpleXML dashboard**
splunk-app/              **packaged Splunk app: dashboard + scheduled detector alerts**
scripts/ops-demo.mts     **`npm run ops:demo` (offline)**
scripts/ops-test.mts     **`npm run ops:test` (e2e assertions)**
docs/SPLUNK_MCP.md       **MCP Server integration writeup**
```

## ZeroDrop (the base app, unchanged guarantee)

Every claim is one DynamoDB conditional `UpdateItem` (`claimed < totalStock`),
no locks, no read-modify-write, so overselling is impossible by construction.
Sold-out claims fall through to an atomic waitlist; holds last 10 minutes with
lazy conditional expiry and DynamoDB TTL cleanup. The dashboard's stress-test
button fires up to 1,000 concurrent buyers; the stock bar lands on exactly
N/N, oversold **0**, and now every one of those events is observable in Splunk.
That guarantee is exactly what makes the telemetry trustworthy enough to act on.

## Docs

- [UPDATES.md](./UPDATES.md): what was added for this hackathon (the significant update)
- [architecture_diagram.md](./architecture_diagram.md): mermaid, app → Splunk → agent
- [SETUP.md](./SETUP.md): Splunk + Devpost runbook incl. Claude-in-Chrome steps
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md): <3 min demo script
- [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md): Splunk MCP Server integration
