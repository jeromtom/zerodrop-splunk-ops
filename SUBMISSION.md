# DropWatch · Devpost submission copy

> Ready-to-paste copy for the **Splunk Agentic Ops Hackathon** (Observability track,
> $3,000; also targeting the MCP Server and Hosted Models bonus prizes). Paste each
> section into the matching Devpost field. Every claim below is consistent with
> `UPDATES.md` (see the "what's live vs wired" note in section 12).

---

## 1. Project name + tagline

**DropWatch**

*Provable correctness turns noise into signal: agentic observability on Splunk, starting with oversell-proof flash drops.*

---

## 2. Elevator pitch

An agentic observability layer that starts with a provably correct system and reads
the clean signal that falls out of it. ZeroDrop, an oversell-proof flash-drop app,
ships every hot path to Splunk via HEC. Then an LLM agent reads it back, scores drop
health, flags oversell-bot subnets, and pages on-call automatically. Because the app
cannot oversell by construction, an oversell-reject can only be a behavioral signal,
which makes bots stand out cleanly. The same agent loop plus a generic z-score
detector run over any Splunk index, so the pattern generalizes well beyond drops.

---

## 3. Inspiration

We have all watched a hyped drop go sideways. The "limited to 100 pairs" sneaker
somehow sells 130, and the brand spends the next week apologizing online instead of
celebrating a sellout. ZeroDrop, the app underneath this project, exists to make that
exact failure impossible: every claim is a single DynamoDB conditional write, so even
a thousand buyers hammering the same item at the same instant land on exactly N of N,
with zero oversold.

The insight that became DropWatch is this: when a system is provably correct, its
error signals get clean. Overselling cannot happen here, so the database never rejects
a claim by accident. A reject can only mean one thing: someone tried to buy stock that
was already gone. Overselling is impossible by construction, so an oversell-reject is
never a data-integrity scare and always a behavioral fact. That removes the noise floor.
A flood of those rejects, all from one /24 subnet, is not ambiguous. It is a bot farm
hammering a sold-out drop, and it stands out as cleanly as a flare against a black sky.

So once overselling is off the table, a better question appears. The drop is safe, but
what is actually happening in those frantic ninety seconds? Who is a real fan and who
is a bot farm? When did the stampede really start? Are holds expiring faster than people
can check out? A green "all good" light is not an answer. We wanted an operator's
co-pilot that watches the drop, understands it, and acts on its own. That is DropWatch.

## 4. What it does

DropWatch turns a live flash drop into a stream of structured events and puts an agent
on top of it.

Every hot path in ZeroDrop (claim, hold, expiry, oversell-reject, waitlist, checkout)
emits a clean event to Splunk through the HTTP Event Collector. From there the
DropWatch agent runs a tight loop: it pulls the telemetry back, summarizes it, reasons
over it with an LLM, scores the drop's health from 0 to 100, and ranks what it finds
by severity. Each finding arrives with a recommendation and a one-click action, and
applying that action writes a breadcrumb straight back into Splunk, so even the fix is
observable.

The signal it reads best is the one provable correctness hands it. Because overselling
is impossible by construction, an oversell-reject event only ever fires when the
database guard does its job. That makes a burst of rejects from a single /24 subnet a
remarkably clean bot signature rather than a data-integrity scare. The agent reads
exactly that signal, names the subnet, and offers to flag it.

It also looks ahead, not just behind. DropWatch tracks claim-rate velocity and write
latency as leading indicators: a rising run of accelerating claims and a climbing 95th
percentile write latency both warn that a stampede is building before any user sees an
error. The goal is to act during the surge, not to write the postmortem after it.

When a scan surfaces a high or critical finding, or drop health drops below threshold,
the agent closes the loop itself. It POSTs a formatted incident to an alert webhook,
Slack or PagerDuty style, with the finding, the reasoning, and the recommended action.
No human has to be watching the dashboard. The agent reasons over Splunk telemetry and
pages on-call on its own.

None of this is specific to sneakers. Under the flash-drop detectors sits a generic
z-score anomaly detector: for any event type, it builds a rolling per-minute baseline
and flags the most recent minute when it runs more than three standard deviations hot.
That detector does not know what a "drop" is. Point the same agent loop and the same
baseline detector at any Splunk index, login attempts, API errors, queue depth, packet
drops, and it scores health, ranks anomalies, and pages on-call exactly the same way.
The flash drop is the showcase. The pattern serves software, ITOps, and NetOps teams.

We also ship it as a real Splunk app (`splunk-app/`). Importing it installs the
DropWatch dashboard plus six scheduled detector alerts that run server-side on a cron,
continuously, even when no one has the dashboard open: stampede onset, oversell-bot
clusters, hold-expiry storms, waitlist collapse, the generic z-score rate anomaly, and
write-latency degradation. Each one can fire a Splunk webhook back to the app, so the
detection-to-response loop runs natively inside Splunk too, not only inside our agent.

## 5. How we built it

We started from ZeroDrop, a Next.js app on DynamoDB whose entire personality is one
atomic conditional `UpdateItem` per claim. Then we wrapped it in observability.

The telemetry layer is deliberately small. `lib/splunk.ts` is a HEC client built on
Node's own `fetch`, with no Splunk SDK and no heavy dependencies; it posts structured
JSON to the collector and quietly no-ops when no HEC is configured, so local runs
behave exactly like production. `lib/dropwatch/events.ts` defines the event taxonomy
and masks buyer identity before anything leaves the app, and `lib/dropwatch/sink.ts`
is the single choke point every hot path calls, fanning each event out to both Splunk
and a bounded in-memory ring buffer.

The agent lives in `lib/dropwatch`. `search.ts` pulls telemetry back through a
three-tier path: the Splunk MCP Server first, then the REST search API, then the local
buffer when neither is reachable. `analyze.ts` extracts features and runs a
deterministic rules engine (stampede ratio, oversell-reject rate, /24 cluster
detection, hold-expiry storms, waitlist collapse) plus two things that make it general:
a per-event-type rate series that powers a baseline z-score anomaly detector on any
event stream, and a claim-velocity feature that surfaces leading indicators before a
hard stampede. `llm.ts` layers reasoning on top with the same fall-through discipline:
Splunk Hosted Models first, then an OpenAI-compatible API, then the rules engine, so the
agent always has something intelligent to say. `agent.ts` orchestrates one scan cycle,
`actions.ts` applies the chosen remediation and records it back into telemetry, and
`notify.ts` is the automated-response stage: it gates on severity and health threshold,
formats a Slack or generic JSON incident, and POSTs it to an alert webhook, no-op clean
when no webhook is set so tests and local runs stay quiet.

The `/ops` route and `OpsDashboard` component put a face on all of it: a live feed, a
health score, severity-ranked finding cards with Apply buttons, and the exact SPL the
agent ran. `dashboards/dropwatch.xml` ships an importable Splunk dashboard for the
classic view. `splunk-app/` packages the whole thing as a deployable Splunk app:
`app.conf` plus a `savedsearches.conf` of six scheduled detector alerts whose SPL
mirrors the agent's rules engine, including the generic z-score detector, so the same
logic runs natively and continuously inside Splunk and can fire its own webhooks.

## 6. Challenges we ran into

Our most honest challenge was the trial environment. A Splunk Cloud trial happily
accepts HEC ingestion but does not expose the search port, so the agent cannot read its
own telemetry back through REST or the MCP Server on that stack. We could have faked
it. Instead we leaned all the way into graceful degradation: the read path falls back
from MCP to REST to the in-memory buffer, and the reasoning path falls back from Hosted
Models to a hosted API to a deterministic engine. The payoff is an agent that never
goes dark, online or offline, keyed or keyless, plus a deterministic floor we can
actually assert against in CI. Designing the rules engine to mirror the LLM's output
shape quietly turned a limitation into a testable contract.

## 7. Accomplishments that we're proud of

- Live HEC ingestion verified against a real Splunk Cloud stack, with the drop's hot
  paths landing in the `zerodrop` index.
- A live agent that reasons with a real LLM and returns a drop-health score of 75 with
  a high-severity oversell-bot finding.
- An agent that always produces output, thanks to three read tiers and three reasoning
  tiers.
- A closed automated loop: the agent pages on-call through an alert webhook (Slack or
  PagerDuty style) the moment a scan trips severity or the health threshold, no human
  in the loop.
- A generic z-score anomaly detector that works on any event type, so the same agent
  generalizes past flash drops to any Splunk index for software, ITOps, and NetOps.
- Leading-indicator early warning: claim-rate velocity and 95th percentile write
  latency flag a building stampede before users hit an error.
- A deployable Splunk app (`splunk-app/`) with six scheduled detector alerts that run
  the same detection logic server-side and continuously, dashboard or no dashboard.
- A green end-to-end test (10 of 10) proving the agent catches both planted incidents
  and leaves a healthy drop alone.
- Telemetry that never touches the hot path's latency or the oversell guarantee, which
  stays at exactly zero.

## 8. What we learned

- Provable correctness creates clean signals. Because overselling cannot happen, the
  reject stream is purely behavioral, with no integrity noise to filter, which is
  exactly what makes it such good bot-detection fuel. Build the guarantee into the
  system and your observability gets sharper for free.
- The domain detectors were the easy part to generalize. Once we separated the
  hand-tuned drop rules from a plain z-score over a per-event baseline, the agent stopped
  being a sneaker tool and became a detector that runs on any Splunk index. The flash
  drop is a vivid demo of a pattern that fits ITOps and NetOps just as well.
- Detection without response is half a loop. Wiring the webhook so the agent pages
  on-call by itself turned a dashboard into an actual operator that does something.
- Treating Splunk as a tool surface, querying it through the MCP search tool rather
  than hard-wiring REST, is the idiomatic agentic move, and it makes the same agent
  portable to any MCP-aware host.
- Graceful degradation is a feature, not an apology. The tiers we built to survive a
  trial also made the whole thing easier to demo and more honest to talk about.
- A deterministic floor under an LLM keeps an agent testable while still letting live
  reasoning shine in the demo.

## 9. What's next for DropWatch

- Stand up a Splunk MCP Server against a non-trial stack so the live demo header reads
  `telemetry: mcp` from end to end.
- Promote Splunk Hosted Models to the primary reasoning tier for a fully Splunk-native
  AI loop.
- Ship a non-drop reference index (API errors or login attempts) to show the generic
  z-score detector and the same agent loop running unchanged on an ITOps stream.
- Teach the agent new detectors (price-scalper resale patterns, geo-anomalies,
  hold-griefing) and let it propose SPL it was never pre-programmed with.
- Push applied actions and webhook pages through a real enforcement path, such as an
  edge throttle or an IP blocklist, instead of a recorded breadcrumb.

## 10. Built with

`splunk`, `splunk-hec`, `splunk-mcp-server`, `splunk-hosted-models`,
`splunk-app`, `saved-searches`, `mcp`, `next.js`, `react`, `typescript`,
`dynamodb`, `aws`, `node.js`, `llm`, `openai-compatible-api`, `anomaly-detection`,
`slack`, `pagerduty`, `webhooks`, `observability`, `agentic-ai`

## 11. How to try it

**Public repo:** https://github.com/jeromtom/zerodrop-splunk-ops

**Offline mock mode (zero Splunk, zero LLM keys):**

```bash
npm run ops:demo    # synth a drop, agent detects stampede + oversell-bot
npm run ops:test    # end-to-end assertions (10 of 10 green)
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
and import `dashboards/dropwatch.xml`. To get on-call paging, set `ALERT_WEBHOOK_URL`
to a Slack incoming webhook (or any POST endpoint) and the agent pages automatically on
high-severity findings. To run the detectors natively in Splunk, drop `splunk-app/`
into `$SPLUNK_HOME/etc/apps/` for the dashboard plus six scheduled alerts. The full
runbook is in `SETUP.md`.

## 12. Which Splunk AI capability we use

DropWatch reasons over Splunk telemetry and automates the operational response: it
scores drop health, ranks anomalies, and pages on-call through an alert webhook with
no human in the loop. It is built to use two Splunk AI capabilities, and we are honest
about which one is running today.

- **Splunk MCP Server (Best Use of Splunk MCP Server, $1,000).** The agent's "pull
  telemetry" step is a tool call: it issues its SPL through the MCP Server's search tool
  (`run_splunk_search`) via JSON-RPC `tools/call` in `lib/dropwatch/search.ts`, with
  REST and buffer fallbacks. It is code-complete and documented (`docs/SPLUNK_MCP.md`)
  and is the primary read path on a non-trial stack. It is wired but not active on the
  Cloud trial we demoed on, because trials do not expose the search port.
- **Splunk Hosted Models (Best Use of Splunk Hosted Models, $1,000).** The agent's
  reasoning tier targets Splunk Hosted Models via an OpenAI-compatible endpoint in
  `lib/dropwatch/llm.ts`. It is wired and shown in code and docs; on the trial the live
  reasoning ran on the OpenAI-compatible fallback instead.

**What is live and verified (2026-06-14, stack `prd-p-p8i91`):** ZeroDrop hot paths
flow to Splunk HEC ingestion (118 events in the `zerodrop` index), a full `next build`,
and `/ops` reasoning with a real LLM (header `telemetry: buffer`, `LLM: aiml`),
reporting health 75 and a high-severity oversell-bot finding. The automated-response
webhook (`lib/dropwatch/notify.ts`) and the packaged Splunk app with its six scheduled
detector alerts (`splunk-app/`) are in the repo and exercised by the offline test suite.

**What is wired and shown in code and docs (not running on the trial):** reading
telemetry back via the Splunk REST search API or MCP Server, and Splunk Hosted Models.
These are gated behind env, no-op safely, and light up unchanged on a non-trial stack.
We never claim MCP or Hosted Models ran live on the trial; HEC ingestion and the
OpenAI-compatible reasoning tier are the parts verified end to end.
