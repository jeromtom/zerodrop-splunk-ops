# UPDATES – the significant update for the Splunk Agentic Ops Hackathon

> **Eligibility note (Splunk rules):** a pre-existing project must be
> *significantly updated after the start of the Hackathon Submission Period
> (May 18, 2026)*. ZeroDrop existed before this hackathon as an oversell-proof
> flash-drop app. The **DropWatch agentic observability layer documented here is
> that significant update** – a new, first-class feature built on **Jun 14–15,
> 2026**, well after the May 18, 2026 submission-period start, specifically for
> this hackathon. None of it existed before; every file listed below is new or
> newly instrumented for DropWatch.

## What was added (all new, Jun 14–15 2026)

### 1. Telemetry / HEC ingestion (app → Splunk)
- **`lib/splunk.ts`** – a HTTP Event Collector client using only Node's built-in
  `fetch` (no Splunk SDK, no heavy deps). Posts structured JSON events and
  metric points to `${SPLUNK_HEC_URL}` with `Authorization: Splunk ${TOKEN}`.
  No-ops cleanly when no HEC env is configured, so local/mock runs are identical.
- **`lib/dropwatch/events.ts`** – the telemetry taxonomy: `claim`, `hold_create`,
  `hold_expiry`, `oversell_reject`, `waitlist_add`, `checkout`, `sim_summary`,
  with buyer masking (no raw PII leaves the app).
- **`lib/dropwatch/sink.ts`** – the single choke point every hot path calls:
  ships to HEC + keeps a bounded local ring buffer (powers mock mode + /ops).
- **Instrumented ZeroDrop's hot paths** in `lib/drops.ts`: `claimDrop`,
  `waitlistDrop`, `reconcileHold` (hold expiry), `confirmClaim` (checkout), and
  `simulateBuyers` now emit telemetry. The claim API route forwards client IP.

### 2. The DropWatch agent (Splunk AI / agentic element)
- **`lib/dropwatch/search.ts`** – pulls telemetry back *out* of Splunk. Priority:
  **Splunk MCP Server** (JSON-RPC `tools/call` to the search tool) → Splunk REST
  search API → local buffer (offline). This is the MCP-prize integration.
- **`lib/dropwatch/llm.ts`** – LLM reasoning with a 3-tier fallback: **Splunk
  Hosted Models** (live) → AI/ML API (OpenAI-compatible, gpt-4o-mini) →
  deterministic rules engine. The agent always produces findings.
- **`lib/dropwatch/analyze.ts`** – feature extraction + the deterministic rules
  engine (stampede ratio, oversell-reject rate, /24 bot-cluster detection,
  hold-expiry storm, waitlist-conversion collapse) + health scoring.
- **GENERIC baseline anomaly detector (`lib/dropwatch/analyze.ts`)** – a
  taxonomy-agnostic **z-score** detector. `summarize()` now emits a per-event-type
  `rateSeries` (per-minute counts for every event type), and a `RateStats` pass
  scores each series as `(recent - mean) / std` sigma against its own baseline.
  This lets DropWatch flag rate anomalies on **any** event stream, not just the
  flash-drop taxonomy, so the agent generalises beyond ZeroDrop's hot paths.
- **Leading-indicator early warning (`lib/dropwatch/analyze.ts`)** – a
  `claimVelocity` feature (per-minute deltas of the claim rate, acceleration, and
  the length of the rising run). A consistently rising claim velocity fires an
  early-warning finding *before* a hard stampede crosses the absolute threshold –
  the agent gets ahead of the incident instead of reacting to it.
- **`lib/dropwatch/agent.ts`** – the orchestrator: one scan cycle of
  pull → summarise → reason → score → rank.
- **`lib/dropwatch/actions.ts`** – applies recommended remediations (enable
  throttle / extend hold / flag IP cluster / notify) and writes a breadcrumb
  back into telemetry so the loop is visible in Splunk.
- **`lib/dropwatch/notify.ts` (AI alert webhooks – automate operational response)**
  – closes the loop: when a scan produces a high/critical finding *or* drop-health
  falls below `ALERT_HEALTH_THRESHOLD`, DropWatch auto-POSTs a concise incident to a
  webhook. Ships a **Slack** Incoming-Webhook payload (header + severity/health
  fields + per-finding reasoning, recommendation, and one-click action label, with a
  red/amber side-bar) and a **PagerDuty/generic** JSON shape (`ALERT_WEBHOOK_FORMAT`).
  De-dupes findings by id, never throws into the scan, and – like the HEC client –
  no-ops cleanly when `ALERT_WEBHOOK_URL` is unset (local dev, mock mode, CI). This
  is the AI reasoning over Splunk telemetry paging on-call **without a human in the
  loop**.

- **`lib/dropwatch/agentObs.ts` + `lib/splunk.ts` (agent self-observability, AI agent monitoring)**
  - DropWatch now watches its OWN agent. Each scan records the reasoning tier that
  fired (Hosted Models / AIML / rules), the model, LLM latency, total scan time, and
  whether the LLM fell back, then ships those metrics to Splunk under a distinct
  `dropwatch:agent` sourcetype and surfaces them in an "Agent runtime" panel on `/ops`.
  This is the direct fit for Splunk's newest capability (AI Agent Monitoring): the
  agent is observable the same way the app it monitors is. Covered by `npm run ops:test`.

### 3. Ops UI
- **`app/ops/page.tsx` + `components/OpsDashboard.tsx`** – a `/ops` dashboard with
  a live telemetry feed, a 0–100 drop-health score, severity-ranked finding cards
  (reasoning + recommendation + **Apply** button), and the exact SPL the agent ran.
- **`app/api/ops/{scan,feed,seed,apply}/route.ts`** – supporting endpoints.
- **`dashboards/dropwatch.xml`** – an importable Splunk SimpleXML dashboard
  (KPIs, claim-rate timechart, bot-cluster-by-subnet table, hold-expiry storm),
  upgraded this session with the generic rate-anomaly and claim-velocity panels.
- **`splunk-app/` (packaged Splunk app – installable artifact)** – a
  drop-in app (`splunk-app/default/app.conf` packaging metadata: id `dropwatch`,
  v1.0.0) that bundles the DropWatch **dashboard** plus a set of **scheduled
  detector alerts** (`savedsearches.conf`) which mirror, *natively in Splunk*, the
  same logic the in-app agent runs – stampede onset, oversell-bot clusters,
  hold-expiry storms, waitlist collapse, and the generic rate anomaly – over
  `index=zerodrop sourcetype=zerodrop:telemetry`. Copy into `$SPLUNK_HOME/etc/apps`
  on a real Splunk instance to get the same detectors running on a cron schedule,
  independent of the Next.js app.

### 4. Mock mode (offline, zero keys)
- **`lib/dropwatch/synth.ts`** – a deterministic synthesizer producing a realistic
  drop telemetry stream with **two planted incidents** (stampede + oversell-bot).
- **`scripts/ops-demo.mts`** (`npm run ops:demo`) – runs the full agent offline.
- **`scripts/ops-test.mts`** (`npm run ops:test`) – end-to-end test asserting the
  agent flags both planted incidents and leaves a healthy drop unflagged.
- **`scripts/ts-resolve.mjs`** – tiny ESM loader so the demo/test run via Node's
  built-in TS support (no tsx/ts-node install needed – keeps disk usage low).

### 5. Docs (rewritten from the old H0/AWS hackathon to Splunk)
- `README.md`, `SETUP.md` (now a Splunk + Devpost runbook incl. a
  Claude-in-Chrome registration runbook), `DEMO_SCRIPT.md`, `PLAN.md`,
  `architecture_diagram.md` (new), `docs/SPLUNK_MCP.md` (new), `.env.example`
  (Splunk + LLM entries added).

## What is verified vs. mocked

> Verified **live on 2026-06-14** against a Splunk Cloud trial (stack
> `prd-p-p8i91`): HEC ingestion works end-to-end (118 events landed in the
> `zerodrop` index), a full `next build` succeeds, and `/ops` runs the agent with
> a real LLM (`telemetry: buffer · LLM: aiml`).

| Area | Status |
|---|---|
| Agent pipeline (synth → summarise → reason → findings) | **Verified** – `npm run ops:test` passes (10/10 assertions), `npm run ops:demo` flags stampede + oversell-bot |
| Rules-engine reasoning tier | **Verified** offline |
| Generic baseline (z-score) anomaly detector | **Verified** offline – exercised deterministically by `npm run ops:test`; taxonomy-agnostic so it scores any event stream |
| Leading-indicator early warning (claim velocity) | **Verified** offline – deterministic; fires ahead of a hard stampede, asserted in `npm run ops:test` |
| AI alert webhooks (Slack / PagerDuty) | **Verified** offline – deterministic severity/health gating + payload build covered by `npm run ops:test`; POST path no-ops safely until `ALERT_WEBHOOK_URL` is set (not wired to a live channel in this run) |
| HEC client (app → Splunk) | **Verified live** – 118 events ingested to the `zerodrop` index via HEC on the Cloud trial |
| AIML LLM reasoning tier | **Verified live** – `/ops` reasons with the AI/ML API (`LLM: aiml`), health 75 + HIGH oversell-bot finding |
| MCP/REST search + Splunk Hosted-Models tiers | **Code-complete + documented; wired but not active on a Cloud *trial*** (trials don't expose the search port, so `/ops` analyzes the in-process buffer). Light up on a non-trial stack – see README + docs/SPLUNK_MCP.md. All gated behind env and no-op safely. |
| `/ops` page + API routes | **Verified** – full `next build` succeeds and the live `/ops` scan/feed/apply API flow runs |
| Packaged Splunk app (`splunk-app/`: scheduled alerts + `app.conf` + dashboard) | **Artifact, not live here** – an installable app for a real Splunk instance (copy into `$SPLUNK_HOME/etc/apps`). Mirrors the agent's detectors as native scheduled searches; not deployed on the Cloud *trial*. |
| ZeroDrop base guarantee | Unchanged from the original, oversell still 0 |
