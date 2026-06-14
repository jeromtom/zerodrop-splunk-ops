# DropWatch — agentic ops for oversell-proof flash drops

**Splunk Agentic Ops Hackathon** entry · Track: **Observability ($3,000)** · also targeting **Best Use of Splunk MCP Server ($1,000)**

DropWatch is an **agentic observability layer** built on top of **ZeroDrop**, an
oversell-proof flash-drop SaaS. ZeroDrop instruments every hot path (claim,
hold-create, hold-expiry, oversell-reject, waitlist-add, checkout) and ships
structured telemetry to **Splunk via HTTP Event Collector (HEC)**. The
**DropWatch agent** then pulls that telemetry *back out of Splunk* — preferably
through the **Splunk MCP Server** — and uses an LLM to reason about drop health:
it detects stampede onset, oversell-bot clusters, hold-expiry storms and
waitlist collapse, assigns severity, and recommends concrete ops actions you can
apply in one click.

> ZeroDrop's core guarantee — *overselling is impossible by construction* (every
> claim is a single DynamoDB conditional write) — is exactly what makes its
> telemetry interesting: the oversell-reject stream is a clean bot-detection
> signal, because rejects only ever happen when the database guard holds.

## What's AI/agentic about it

Splunk's rules require a real AI/agentic element (a passive dashboard is not
enough). DropWatch satisfies this three ways:

1. **Splunk MCP Server** — the agent issues its SPL searches through the MCP
   server's search tool (`lib/dropwatch/search.ts`). See
   [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md).
2. **Splunk Hosted Models** — the agent's reasoning runs on Splunk Hosted Models
   in live mode (`lib/dropwatch/llm.ts`), with an OpenAI-compatible fallback
   (AI/ML API) and a deterministic rules engine so it **always** produces output.
3. **Agentic loop** — pull → summarise → reason → recommend → apply, surfaced at
   `/ops` with one-click remediation that writes a breadcrumb back into Splunk.

## Quick start — MOCK MODE (zero Splunk, zero LLM keys)

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

## Quick start — the full app + /ops dashboard

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
  reasons. Add Splunk/LLM env to go live — see [.env.example](./.env.example).)

## Go live with Splunk

1. Create a Splunk account + HEC token, enable an index, then set
   `SPLUNK_HEC_URL` / `SPLUNK_HEC_TOKEN` — full runbook in [SETUP.md](./SETUP.md).
2. Import [dashboards/dropwatch.xml](./dashboards/dropwatch.xml) into Splunk.
3. (Optional, for the MCP prize) run a Splunk MCP Server and set `SPLUNK_MCP_URL`
   — see [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md).

## Architecture

See [architecture_diagram.md](./architecture_diagram.md) for the full diagram.
In short: `ZeroDrop hot paths → lib/splunk.ts (HEC) → Splunk index → DropWatch
agent (MCP/REST search → summarise → LLM → findings) → /ops UI + apply`.

## Repo map (DropWatch additions in **bold**)

```
lib/drops.ts             ZeroDrop data layer — now emits telemetry on every hot path
lib/splunk.ts            **HEC client (stdlib fetch, no-ops without env)**
lib/dropwatch/
  events.ts              **telemetry taxonomy (event types, masking)**
  sink.ts                **the choke point: ship to HEC + local ring buffer**
  search.ts              **pull telemetry back: MCP server -> REST -> buffer**
  synth.ts               **mock-mode synthesizer (planted stampede + bot)**
  analyze.ts             **feature extraction + deterministic rules engine**
  llm.ts                 **LLM reasoning: Hosted Models -> AIML -> rules**
  agent.ts               **the orchestrator (scan cycle)**
  actions.ts             **applied-action store + telemetry breadcrumb**
app/ops/page.tsx         **the /ops dashboard route**
components/OpsDashboard.tsx  **live feed, health score, findings, apply**
app/api/ops/*            **scan / feed / seed / apply endpoints**
dashboards/dropwatch.xml **importable Splunk SimpleXML dashboard**
scripts/ops-demo.mts     **`npm run ops:demo` (offline)**
scripts/ops-test.mts     **`npm run ops:test` (e2e assertions)**
docs/SPLUNK_MCP.md       **MCP Server integration writeup**
```

## ZeroDrop (the base app, unchanged guarantee)

Every claim is one DynamoDB conditional `UpdateItem` (`claimed < totalStock`) —
no locks, no read-modify-write — so overselling is impossible by construction.
Sold-out claims fall through to an atomic waitlist; holds last 10 minutes with
lazy conditional expiry and DynamoDB TTL cleanup. The dashboard's stress-test
button fires up to 1,000 concurrent buyers; the stock bar lands on exactly
N/N, oversold **0** — and now every one of those events is observable in Splunk.

## Docs

- [UPDATES.md](./UPDATES.md) — what was added for this hackathon (the significant update)
- [architecture_diagram.md](./architecture_diagram.md) — mermaid: app → Splunk → agent
- [SETUP.md](./SETUP.md) — Splunk + Devpost runbook incl. Claude-in-Chrome steps
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) — <3 min demo script
- [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md) — Splunk MCP Server integration
