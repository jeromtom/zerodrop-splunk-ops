# UPDATES — the significant update for the Splunk Agentic Ops Hackathon

> **Eligibility note (Splunk rules):** a pre-existing project must be
> *significantly updated after the start of the submission period*. ZeroDrop
> existed before this hackathon as an oversell-proof flash-drop app. The
> **DropWatch agentic observability layer documented here is that significant
> update** — a new, first-class feature built on **Jun 14–15, 2026** specifically
> for this hackathon. None of it existed before.

## What was added (all new, Jun 14–15 2026)

### 1. Telemetry / HEC ingestion (app → Splunk)
- **`lib/splunk.ts`** — a HTTP Event Collector client using only Node's built-in
  `fetch` (no Splunk SDK, no heavy deps). Posts structured JSON events and
  metric points to `${SPLUNK_HEC_URL}` with `Authorization: Splunk ${TOKEN}`.
  No-ops cleanly when no HEC env is configured, so local/mock runs are identical.
- **`lib/dropwatch/events.ts`** — the telemetry taxonomy: `claim`, `hold_create`,
  `hold_expiry`, `oversell_reject`, `waitlist_add`, `checkout`, `sim_summary`,
  with buyer masking (no raw PII leaves the app).
- **`lib/dropwatch/sink.ts`** — the single choke point every hot path calls:
  ships to HEC + keeps a bounded local ring buffer (powers mock mode + /ops).
- **Instrumented ZeroDrop's hot paths** in `lib/drops.ts`: `claimDrop`,
  `waitlistDrop`, `reconcileHold` (hold expiry), `confirmClaim` (checkout), and
  `simulateBuyers` now emit telemetry. The claim API route forwards client IP.

### 2. The DropWatch agent (Splunk AI / agentic element)
- **`lib/dropwatch/search.ts`** — pulls telemetry back *out* of Splunk. Priority:
  **Splunk MCP Server** (JSON-RPC `tools/call` to the search tool) → Splunk REST
  search API → local buffer (offline). This is the MCP-prize integration.
- **`lib/dropwatch/llm.ts`** — LLM reasoning with a 3-tier fallback: **Splunk
  Hosted Models** (live) → AI/ML API (OpenAI-compatible, gpt-4o-mini) →
  deterministic rules engine. The agent always produces findings.
- **`lib/dropwatch/analyze.ts`** — feature extraction + the deterministic rules
  engine (stampede ratio, oversell-reject rate, /24 bot-cluster detection,
  hold-expiry storm, waitlist-conversion collapse) + health scoring.
- **`lib/dropwatch/agent.ts`** — the orchestrator: one scan cycle of
  pull → summarise → reason → score → rank.
- **`lib/dropwatch/actions.ts`** — applies recommended remediations (enable
  throttle / extend hold / flag IP cluster / notify) and writes a breadcrumb
  back into telemetry so the loop is visible in Splunk.

### 3. Ops UI
- **`app/ops/page.tsx` + `components/OpsDashboard.tsx`** — a `/ops` dashboard with
  a live telemetry feed, a 0–100 drop-health score, severity-ranked finding cards
  (reasoning + recommendation + **Apply** button), and the exact SPL the agent ran.
- **`app/api/ops/{scan,feed,seed,apply}/route.ts`** — supporting endpoints.
- **`dashboards/dropwatch.xml`** — an importable Splunk SimpleXML dashboard
  (KPIs, claim-rate timechart, bot-cluster-by-subnet table, hold-expiry storm).

### 4. Mock mode (offline, zero keys)
- **`lib/dropwatch/synth.ts`** — a deterministic synthesizer producing a realistic
  drop telemetry stream with **two planted incidents** (stampede + oversell-bot).
- **`scripts/ops-demo.mts`** (`npm run ops:demo`) — runs the full agent offline.
- **`scripts/ops-test.mts`** (`npm run ops:test`) — end-to-end test asserting the
  agent flags both planted incidents and leaves a healthy drop unflagged.
- **`scripts/ts-resolve.mjs`** — tiny ESM loader so the demo/test run via Node's
  built-in TS support (no tsx/ts-node install needed — keeps disk usage low).

### 5. Docs (rewritten from the old H0/AWS hackathon to Splunk)
- `README.md`, `SETUP.md` (now a Splunk + Devpost runbook incl. a
  Claude-in-Chrome registration runbook), `DEMO_SCRIPT.md`, `PLAN.md`,
  `architecture_diagram.md` (new), `docs/SPLUNK_MCP.md` (new), `.env.example`
  (Splunk + LLM entries added).

## What is verified vs. mocked

| Area | Status |
|---|---|
| Agent pipeline (synth → summarise → reason → findings) | **Verified** — `npm run ops:test` passes (10/10 assertions), `npm run ops:demo` flags stampede + oversell-bot |
| Rules-engine reasoning tier | **Verified** offline |
| HEC client, MCP/REST search, Hosted-Models/AIML LLM tiers | **Code-complete; not exercised against live Splunk/LLM** (no Splunk account yet — see SETUP.md). All gated behind env and no-op safely. |
| `/ops` page + API routes | **Code-complete; not run in a full Next build** (node_modules not installed in this constrained environment). Logic is shared with the verified scripts. |
| ZeroDrop base guarantee | Unchanged from the original, oversell still 0 |
