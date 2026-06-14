# PLAN — DropWatch (Splunk Agentic Ops Hackathon)

**Hackathon:** [Splunk Agentic Ops Hackathon](https://splunk.devpost.com/) · $20k pool
**Deadline:** **Jun 15, 2026, 9:00 AM PDT** (≈ 9:30 PM IST)
**Tracks:** **Observability ($3,000)** + **Best Use of Splunk MCP Server ($1,000)**
**Explicitly NOT entering:** the Security track.

---

## Concept

**DropWatch** is an **agentic observability layer** on **ZeroDrop**, an
oversell-proof flash-drop SaaS (Next.js + DynamoDB; every claim is a single
atomic conditional write, so overselling is impossible by construction).

ZeroDrop instruments its hot paths and ships structured telemetry to **Splunk
via HEC**. The **DropWatch agent** reads that telemetry back out of Splunk
(preferring the **Splunk MCP Server**), summarises it, and uses an **LLM on
Splunk Hosted Models** to reason about drop health — detecting stampede onset,
oversell-bot clusters, hold-expiry storms and waitlist collapse — then assigns
severity and recommends one-click ops actions.

### Why this fits the theme
The rules require a real **AI/agentic** element using a Splunk AI capability.
DropWatch is an agent (pull → reason → recommend → act) that uses **two**:
the **MCP Server** (for tool-based search) and **Hosted Models** (for reasoning),
with graceful fallbacks (REST/buffer; AIML/rules) so it always runs.

### Eligibility
ZeroDrop pre-existed. The entire DropWatch layer is the **significant update**
built Jun 14–15 2026 for this hackathon — logged in [UPDATES.md](./UPDATES.md).

---

## Architecture
See [architecture_diagram.md](./architecture_diagram.md). Flow:
`hot paths → lib/splunk.ts (HEC) → Splunk index → agent (MCP/REST search →
summarise → LLM → findings) → /ops UI + apply (breadcrumb back to Splunk)`.

## What is done
- HEC client + telemetry taxonomy + sink (stdlib only). ✅
- Instrumented ZeroDrop hot paths. ✅
- Agent: MCP/REST/buffer search, feature extraction, rules engine, 3-tier LLM,
  orchestrator, action store. ✅
- `/ops` dashboard + API routes; importable `dashboards/dropwatch.xml`. ✅
- Mock mode: synthesizer + `npm run ops:demo` + `npm run ops:test` (10/10 pass). ✅
- Docs: README, UPDATES, architecture, SETUP (incl. Chrome runbook), DEMO_SCRIPT,
  SPLUNK_MCP. ✅

## What Jerom must do (see SETUP.md §Submission checklist)
Register on Splunk + Devpost, enable HEC, (optionally) run an MCP server, record
the <3 min video, make the repo public, submit before the deadline.
