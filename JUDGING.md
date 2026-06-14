# JUDGING — judge-facing map for DropWatch

**Splunk Agentic Ops Hackathon** · Track: **Observability ($3,000)** · plus one
bonus prize (Best Use of Splunk MCP Server **or** Best Use of Splunk Hosted Models,
$1,000). This page maps DropWatch's features to likely judging criteria and states
plainly what is live versus wired, so you can trust every claim. All claims here are
consistent with [UPDATES.md](./UPDATES.md).

---

## Feature → criteria map

### Technical execution
- HEC client on Node stdlib `fetch` — no Splunk SDK, no heavy deps
  (`lib/splunk.ts`). **Verified live**: 118 events ingested to the `zerodrop` index.
- A single telemetry choke point (`lib/dropwatch/sink.ts`) ships to HEC *and* a
  bounded ring buffer; emission is fire-and-forget and never blocks the hot path.
- Full `next build` succeeds; `npm run ops:test` passes 10/10.
- Three-tier read path (`search.ts`) and three-tier reasoning path (`llm.ts`), each
  gated behind env and no-op-safe.

### AI / agentic depth
- A real agentic loop, not a passive dashboard: **pull → summarise → reason →
  score → recommend → apply** (`agent.ts` `scan()`).
- LLM reasoning over extracted features, **verified live** on the AI/ML API
  (`LLM: aiml`), with Splunk Hosted Models wired as the primary tier.
- One-click remediation writes a breadcrumb back into telemetry, so the agent's own
  actions are observable.
- A deterministic rules engine (`analyze.ts`) gives the agent a testable floor and
  guarantees output when no model/keys are present.

### Observability value
- Instruments the six hot paths that matter for a flash drop (claim, hold-create,
  hold-expiry, oversell-reject, waitlist-add, checkout).
- Detects real incidents: stampede onset, oversell-bot clusters by `/24` subnet,
  hold-expiry storms, waitlist-conversion collapse — with a 0–100 health score.
- Importable Splunk dashboard (`dashboards/dropwatch.xml`): KPIs, claim-rate
  timechart, bot-cluster-by-subnet table, hold-expiry storm.
- Novel signal: because overselling is impossible by construction, oversell-rejects
  are a *clean behavioural* signal — a bot signature, never a data-integrity bug.

### Completeness / polish
- Runs three ways: offline mock (`npm run ops:demo`, zero keys), local app + `/ops`,
  and live against Splunk.
- Documented end to end: README, SETUP runbook, DEMO_SCRIPT (<3 min),
  architecture diagram (mermaid, bidirectional), and `docs/SPLUNK_MCP.md`.
- `UPDATES.md` documents the significant update built Jun 14–15 2026 for this
  hackathon, satisfying the pre-existing-project eligibility rule.

### Use of Splunk AI capability
- **MCP Server**: the agent issues SPL through the MCP search tool
  (`run_splunk_search`) via JSON-RPC `tools/call` (`search.ts`) — code-complete and
  documented (`docs/SPLUNK_MCP.md`).
- **Hosted Models**: the agent's reasoning tier targets Splunk Hosted Models over an
  OpenAI-compatible endpoint (`llm.ts`) — wired and shown in code/docs.

---

## Why this wins the Observability track

DropWatch is end-to-end observability with a real agent on top, not a dashboard with
an LLM bolted on. It instruments a production-shaped SaaS at the six hot paths that
define a flash drop, ships them to Splunk over HEC (**verified live** — 118 events in
the `zerodrop` index), and then runs an agentic loop that reads that telemetry back,
reasons with a live LLM, scores drop health, and recommends one-click remediations
that are themselves observable. The standout is the signal quality: because the base
app makes overselling impossible by construction, oversell-rejects become a clean
bot-detection signal the agent mines — observability that is only possible *because*
the underlying system is provably correct. It is demoable offline in one command,
verified live on a real Splunk stack, and honest about its trial-environment limits.

---

## What's live vs wired (caveats box)

> Verified **live on 2026-06-14** against a Splunk Cloud trial stack (`prd-p-p8i91`).

**LIVE and verified:**
- ZeroDrop hot paths → Splunk HEC ingestion (118 events in the `zerodrop` index).
- Full `next build` succeeds.
- `/ops` runs the agent with a **real LLM** via the AI/ML API
  (header `telemetry: buffer · LLM: aiml`), reporting **health 75 + a HIGH
  oversell-bot finding**.
- Offline agent pipeline: `npm run ops:test` passes 10/10; `npm run ops:demo` flags
  both planted incidents.
- ZeroDrop base guarantee unchanged: **oversold 0** under a 1,000-buyer stampede.

**WIRED but NOT active on the Cloud *trial* (code-complete + documented):**
- Reading telemetry back via the **Splunk REST search API / Splunk MCP Server** —
  Cloud trials don't expose the search port, so on the trial `/ops` analyses its
  in-process buffer (which is itself fed by the live HEC path). Lights up unchanged
  on a non-trial stack. See `docs/SPLUNK_MCP.md`.
- **Splunk Hosted Models** as the primary reasoning tier — wired in `llm.ts`; the
  live demo reasoned on the AI/ML API fallback instead.

All wired paths are gated behind env and no-op safely. We describe them as "wired,
shown in code/docs" — never as running on the trial.
