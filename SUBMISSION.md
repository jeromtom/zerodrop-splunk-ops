# DropWatch — Devpost submission copy

> Ready-to-paste copy for the **Splunk Agentic Ops Hackathon** (Observability track,
> $3,000; also targeting one bonus prize). Paste each section into the matching
> Devpost field. Every claim below is consistent with `UPDATES.md` — see the
> "what's live vs wired" note in section 12.

---

## 1. Project name + tagline

**DropWatch**

*An agentic observability layer that turns oversell-proof flash drops into Splunk telemetry — and reasons over it.*

---

## 2. Elevator pitch

DropWatch instruments an oversell-proof flash-drop SaaS so every hot path ships
structured telemetry to Splunk over HEC, then runs an LLM agent that reads that
telemetry back, scores drop health, and recommends one-click remediations.
Overselling is impossible by construction, which makes the oversell-reject stream
a clean bot-detection signal the agent mines.

---

## 3. Inspiration

Flash drops sell out in seconds, and the fastest way for a brand to lose trust is
overselling. The base app, **ZeroDrop**, already makes that impossible: every claim
is a single DynamoDB conditional write, so even a 1,000-buyer stampede lands on
exactly N/N with **oversold 0**. Once you're safe, the real question becomes *what
is actually happening during the drop?* — who's a bot, when does a stampede start,
are holds expiring in a storm, is the waitlist converting? We built DropWatch to
answer that with an agent instead of a passive dashboard, and Splunk is the natural
system of record for the telemetry.

---

## 4. What it does

DropWatch wraps ZeroDrop's hot paths (claim, hold-create, hold-expiry,
oversell-reject, waitlist-add, checkout) in a telemetry choke point that ships
structured JSON events to **Splunk via HTTP Event Collector (HEC)**. The
**DropWatch agent** then runs a monitoring loop — **pull → summarise → reason →
score → recommend → apply** — surfaced at the `/ops` dashboard:

- **Pulls** recent telemetry back out of Splunk and summarises it into features.
- **Reasons** over those features with an LLM to detect stampede onset,
  oversell-bot clusters (by `/24` subnet), hold-expiry storms, and waitlist
  collapse.
- **Scores** a 0–100 drop-health number and ranks findings by severity.
- **Recommends** a concrete action per finding (enable queue throttle, extend
  hold, flag IP cluster, notify) with a one-click **Apply** button.
- **Closes the loop** by writing an applied-action breadcrumb back into telemetry,
  so remediation is observable too.

Because overselling can't happen, an oversell-reject event only ever fires when the
database guard holds — so a cluster of rejects from one subnet is a clean bot
signature, not a data-integrity failure. The agent reads exactly that signal.

---

## 5. How we built it

**Base app:** ZeroDrop — Next.js (App Router) + DynamoDB. Every claim is one
atomic conditional `UpdateItem` (`claimed < totalStock`); sold-out claims fall
through to an atomic waitlist; holds expire lazily with DynamoDB TTL cleanup.

**Telemetry (app → Splunk):**
- `lib/splunk.ts` — a HEC client built on Node's stdlib `fetch` (no Splunk SDK, no
  heavy deps). Posts structured JSON events to the collector with
  `Authorization: Splunk <token>`; no-ops cleanly when no HEC env is set.
- `lib/dropwatch/events.ts` — the telemetry taxonomy and buyer masking (no raw PII
  leaves the app).
- `lib/dropwatch/sink.ts` — the single choke point every hot path calls; ships to
  HEC *and* keeps a bounded local ring buffer.
- `lib/drops.ts` — ZeroDrop's hot paths, now instrumented to emit on claim,
  waitlist, hold expiry, checkout, and the load simulator.

**The agent (`lib/dropwatch/`):**
- `search.ts` — pulls telemetry back out via a **3-tier read path: Splunk MCP
  Server → Splunk REST search API → local buffer (offline)**.
- `analyze.ts` — feature extraction + a deterministic rules engine (stampede ratio,
  oversell-reject rate, `/24` bot-cluster detection, hold-expiry storm,
  waitlist-conversion collapse) + health scoring.
- `llm.ts` — reasoning with a **3-tier model path: Splunk Hosted Models → AI/ML API
  (OpenAI-compatible, `gpt-4o-mini`) → the rules engine** — so the agent *always*
  produces findings.
- `agent.ts` — the orchestrator that runs one scan cycle.
- `actions.ts` — applies remediations and writes the breadcrumb back into telemetry.

**UI & dashboards:**
- `app/ops/` + `components/OpsDashboard.tsx` — the `/ops` route: live feed,
  health score, severity-ranked finding cards with Apply, and the exact SPL the
  agent ran.
- `dashboards/dropwatch.xml` — an importable Splunk SimpleXML dashboard (KPIs,
  claim-rate timechart, bot-cluster-by-subnet table, hold-expiry storm).

---

## 6. Challenges we ran into

The honest one: **a Splunk Cloud *trial* doesn't expose the search port**, so the
agent can't read its telemetry back out via the REST search API or the MCP Server
on a trial stack — even though HEC ingestion works fine. Rather than fake it, we
built graceful degradation into every tier: the read path falls back **MCP → REST →
in-process buffer**, and the reasoning path falls back **Hosted Models → AI/ML API →
a deterministic rules engine**. The result is that `/ops` always produces real
findings — on a trial it analyses the live HEC-backed in-process buffer with a real
LLM, and on a non-trial stack the MCP/REST search paths light up with no code
changes. Building the rules engine to match the LLM's output shape also meant the
agent has a deterministic floor we can assert against in CI.

---

## 7. Accomplishments that we're proud of

- **Verified live HEC ingestion** — 118 ZeroDrop events landed in the `zerodrop`
  index on a real Splunk Cloud trial stack (`prd-p-p8i91`) on 2026-06-14.
- **Verified live agent reasoning** — `/ops` runs with a real LLM via the AI/ML API
  (header reads `telemetry: buffer · LLM: aiml`), reporting health 75 and a HIGH
  oversell-bot finding.
- **An agent that never goes dark** — three read tiers and three reasoning tiers
  mean it always returns findings, online or offline, keyed or keyless.
- **A passing end-to-end test** — `npm run ops:test` is 10/10: the agent flags both
  planted incidents (stampede + oversell-bot) and leaves a healthy drop unflagged.
- **Telemetry that never breaks the hot path** — emission is fire-and-forget and the
  HEC client no-ops without env, so ZeroDrop's latency and oversell guarantee are
  untouched. A full `next build` succeeds.

---

## 8. What we learned

- **Provable correctness creates clean signals.** Because overselling is impossible
  by construction, the oversell-reject stream is *only* ever a behavioural signal —
  that's what makes it a high-quality bot-detection feature for the agent.
- **Treating Splunk as a tool surface is the idiomatic agentic pattern.** Issuing
  SPL through the MCP Server's search tool (rather than hard-wiring REST) means the
  same agent could drop into any MCP-aware host and immediately query Splunk.
- **Graceful degradation is a feature, not a fallback.** Trial-environment limits
  forced us to design tiers that each stand alone — and that made the whole system
  more demoable and more honest.
- **A deterministic floor under an LLM** keeps an agent testable in CI while still
  letting live reasoning shine in the demo.

---

## 9. What's next for DropWatch

- Stand up a **Splunk MCP Server** against a non-trial stack so the live demo header
  reads `telemetry: mcp` end-to-end.
- Wire **Splunk Hosted Models** as the primary reasoning tier for a fully
  Splunk-native AI loop.
- Add more detectors (price-scalper resale patterns, geo-anomalies, hold-griefing)
  and let the agent propose SPL it hasn't been pre-programmed with.
- Push applied actions through a real enforcement path (edge throttle / IP blocklist)
  rather than a recorded breadcrumb.

---

## 10. Built with

`splunk`, `splunk-hec`, `splunk-mcp-server`, `splunk-hosted-models`, `mcp`,
`next.js`, `react`, `typescript`, `dynamodb`, `aws`, `node.js`, `llm`,
`openai-compatible-api`, `observability`, `agentic-ai`

---

## 11. How to try it

**Public repo:** https://github.com/jeromtom/zerodrop-splunk-ops

**Offline mock mode (zero Splunk, zero LLM keys):**

```bash
npm run ops:demo    # synth a drop -> agent detects stampede + oversell-bot
npm run ops:test    # end-to-end assertions (10/10 green)
```

**The full app + `/ops` dashboard:**

```bash
npm install
npm run db:local    # terminal 1: local DynamoDB (dynalite, no Docker)
npm run db:seed     # terminal 2: table + demo data
npm run dev         # http://localhost:3000
```

Log in `demo@zerodrop.app / drop-zero-2026`, open `/ops`, click **Run mock drop**,
then **Re-scan** to watch the live feed, health score, and severity-ranked findings
with Apply buttons. To go live with Splunk, set `SPLUNK_HEC_URL` / `SPLUNK_HEC_TOKEN`
and import `dashboards/dropwatch.xml` — full runbook in `SETUP.md`.

---

## 12. Which Splunk AI capability we use

DropWatch is built to use two Splunk AI capabilities, and we are honest about which
is running today:

- **Splunk MCP Server (Best Use of Splunk MCP Server, $1,000).** The agent's
  "pull telemetry" step is a tool call: it issues its SPL through the MCP Server's
  search tool (`run_splunk_search`) via JSON-RPC `tools/call` in
  `lib/dropwatch/search.ts`, with REST and buffer fallbacks. This is **code-complete
  and documented** (`docs/SPLUNK_MCP.md`) and is the primary read path on a
  non-trial stack; it is **wired but not active on the Cloud *trial*** we demoed on,
  because trials don't expose the search port.
- **Splunk Hosted Models (Best Use of Splunk Hosted Models, $1,000).** The agent's
  reasoning tier targets Splunk Hosted Models via an OpenAI-compatible endpoint in
  `lib/dropwatch/llm.ts`. This is **wired and shown in code/docs**; on the trial the
  live reasoning ran on the AI/ML API fallback instead (header `LLM: aiml`).

**What is live and verified (2026-06-14, stack `prd-p-p8i91`):** ZeroDrop hot paths
→ Splunk HEC ingestion (118 events in the `zerodrop` index), a full `next build`,
and `/ops` reasoning with a real LLM via the AI/ML API (`telemetry: buffer ·
LLM: aiml`), reporting health 75 and a HIGH oversell-bot finding.

**What is wired and shown in code/docs (not running on the trial):** reading
telemetry back via the Splunk REST search API / MCP Server, and Splunk Hosted
Models. These are gated behind env, no-op safely, and light up unchanged on a
non-trial stack.
