# STRATEGY — DropWatch positioning + judging strategy

Splunk Agentic Ops Hackathon, Observability track ($3,000) + Best Use of Splunk
MCP Server ($1,000). Deadline Jun 15, 2026, 9:00 AM PDT.

This is an honest strategy doc, not a pitch. Where DropWatch is weak (MCP +
Hosted Models wired but not live on the Cloud trial), the strategy is to lead
with what is provably running and frame the rest as a clearly-labelled config
flip, not to hide it.

What is actually live and demoable:
- HEC ingest of structured ZeroDrop telemetry into `index=zerodrop`.
- The agent loop (`scan()`): pull telemetry -> `summarize()` features ->
  reason -> severity-ranked findings -> `/ops` dashboard -> Apply -> breadcrumb
  back to Splunk.
- Three-tier reasoning with deterministic rules as the always-on floor, so the
  agent never returns empty.
- A generic per-event-type rate-series + z-score path and a claim-velocity
  leading indicator that work on any event stream, not just the drop taxonomy.

What is wired but not live on the trial (be upfront):
- Splunk MCP Server as the primary read channel (`telemetry: mcp`).
- Splunk Hosted Models as tier-1 reasoning.
Both are env-flip integrations with documented fallbacks (REST/buffer for reads,
AIML/rules for reasoning), so the demo runs end to end regardless.

---

## 1. The four judging criteria

The official criteria are generic across all four tracks (verbatim from Devpost):
Technological Implementation, Design, Potential Impact, Quality of the Idea.
There is no separate Observability rubric, so the play is to map DropWatch's real
strengths onto each, and pre-empt the one objection that actually bites.

### 1a. Technological Implementation — "Does the project demonstrate quality software development?"

Talking points:
- Two-directional Splunk integration around one choke point: every hot path
  emits through `lib/dropwatch/sink.ts` to HEC, and the agent reads back the same
  index. One taxonomy (`events.ts`) is the contract for emit, dashboard, and SPL.
- Defense-in-depth fallbacks at every tier: reads degrade MCP -> REST ->
  local ring buffer; reasoning degrades Hosted Models -> AIML -> deterministic
  rules. The agent always returns findings, and the demo never dead-ends on a
  missing key or an offline trial. This is engineering maturity, not a gap.
- Telemetry never touches the critical path: emission is fire-and-forget and the
  HEC client no-ops without env, so ZeroDrop's latency and its by-construction
  oversell guarantee (atomic DynamoDB conditional writes) are untouched.
- Stdlib `fetch`/`http` only, no heavy deps; deterministic test harness
  (`npm run ops:test`, 10/10) proves the rules engine and feature extraction.

Biggest objection: "The two headline Splunk AI features (MCP, Hosted Models)
aren't actually running — you fell back to a third-party LLM and a rules engine."
Rebuttal: Both are implemented against their real contracts (JSON-RPC `tools/call`
for MCP; OpenAI-compatible chat/completions for Hosted Models) and gated only by
env vars. The fallbacks are not an excuse, they are the correct production design
for an SRE agent: the thing that watches your system must not itself go down when
a dependency does. Show the SPL the agent runs and the `telemetry:` source label
live, then state plainly that flipping `SPLUNK_MCP_URL` / `SPLUNK_HOSTED_MODEL_URL`
routes the identical code through Splunk's surfaces. Honesty here reads as
competence, not weakness.

### 1b. Design — "Is the user experience and design of the project well thought out?"

Talking points:
- The `/ops` dashboard closes the loop a human can actually run: health score
  (0-100), severity-ranked findings, the grounded reasoning string, and a single
  Apply button per finding. Operator effort is one click, not a query session.
- Radical transparency: the exact SPL the agent ran and the live telemetry
  source (`mcp` / `rest` / `buffer`) and LLM tier (`hosted-model` / `aiml` /
  `rules`) are shown in the header. The agent shows its work; nothing is a
  black box. That is unusually good UX for an AI ops tool and is itself a design
  argument.
- Every finding carries a concrete, parameterised action (enable_throttle,
  extend_hold, flag_ip_cluster, notify) with a human-readable label, and Apply
  emits a breadcrumb event back to Splunk so the remediation is itself observable.
- A second importable artifact (`dashboards/dropwatch.xml`) means the same signals
  live natively inside Splunk for teams that prefer it.

Biggest objection: "This looks like a single-purpose flash-sale panel, not a
general observability product." Rebuttal: The UI is intentionally opinionated —
findings + one-click remediation is the design thesis (reduce mean-time-to-action,
not just mean-time-to-detect). The underlying engine is generic (per-event-type
rate series + z-score, section 3); the drop-specific labels are a thin
presentation layer over a domain-agnostic detector.

### 1c. Potential Impact — "How big of an impact could the project have?"

Talking points:
- The pattern (instrument hot paths -> HEC -> agent reads back -> recommend ->
  one-click apply -> breadcrumb) is reusable on any service that can POST JSON to
  HEC. Flash drops are the vivid demo, not the ceiling (see section 3).
- It targets MTTA, not just MTTD. The 2026 AIOps bar has moved from "detect the
  anomaly" to "draft and apply the fix"; DropWatch's Apply-plus-breadcrumb loop is
  exactly that closed loop, on a Splunk index, with a human in the seat.
- Concrete, costly failure modes it catches in real time: stampede onset (tail
  latency / outage risk), oversell-bot clusters (scalpers, fairness, fraud),
  hold-expiry storms (stock locked by abandoned carts), waitlist-conversion
  collapse (lost revenue). Each maps to a specific operator action.
- A leading indicator, not just a lagging alarm: claim-velocity acceleration and
  rising-run flag a stampede before stock is gone, which is where prevention
  beats firefighting.

Biggest objection: "Splunk already ships ITSI, the AI troubleshooting agent,
adaptive thresholds and Event iQ — what does a hackathon agent add?" Rebuttal:
DropWatch is not competing with ITSI; it is a worked, open example of the pattern
those products enable — application-level domain events (not infra metrics)
flowing through HEC into an agent that recommends domain-specific actions. The
differentiator is upstream of the analytics (section 2): because ZeroDrop's
correctness is guaranteed by construction, its telemetry is unusually clean, so
the same event is unambiguous signal rather than noise to be de-duplicated.

### 1d. Quality of the Idea — "How creative and unique is the project?"

Talking points:
- The non-obvious insight: provable correctness creates clean signals. ZeroDrop
  can never oversell (atomic conditional write), so an `oversell_reject` is never
  an ambiguous "did we double-sell?" incident — it is a pure, attributable signal
  of intent (a bot retrying after sellout). The guarantee turns a noisy alert
  class into a high-precision one. Most observability fights noise; DropWatch is
  built on a substrate that emits less of it.
- Pairing a provably-correct core with an agentic layer is a fresh framing: the
  deterministic system handles correctness, the probabilistic agent handles
  judgement and triage. They are complementary, not redundant.
- Closing the loop in one surface (detect -> reason -> recommend -> apply ->
  re-observe the remediation) inside a single Splunk index is a tidy, complete
  story rather than yet another dashboard.

Biggest objection: "Anomaly detection on event rates is well-trodden — z-scores
and spike alerts aren't novel." Rebuttal: The novelty isn't the detector, it's
the framing and the loop: (1) building on a correctness guarantee so signals are
clean by construction, and (2) tying each finding to a one-click, auditable
remediation that is itself re-ingested as telemetry. The detector is deliberately
simple and explainable because an SRE agent's recommendations have to be trusted.

---

## 2. Landscape and where DropWatch is differentiated

Categories of AI/agentic observability tooling in 2026:
- AIOps platforms — event correlation, noise reduction, anomaly detection across
  metrics/logs/traces (Datadog AI, New Relic AI / Applied Intelligence, Dynatrace,
  BigPanda, Selector, OpenObserve).
- Anomaly detection / adaptive thresholding — baseline-and-deviation engines;
  Splunk ITSI ships Adaptive Thresholds and Drift Detection for KPIs.
- Incident-response copilots / automation — PagerDuty AIOps, Rootly, Metoro,
  alert correlation and runbook automation; the 2026 trend is drafting and in some
  cases auto-applying fixes, not just paging a human.
- Splunk-native AI — AI Assistant (natural-language SPL), AI Toolkit (custom
  models), ITSI (Configuration Assistant, Event iQ, adaptive thresholds), the AI
  troubleshooting agent (root-cause + action plan), MCP Server (agents query
  Splunk as a tool surface), and Hosted Models (foundation + Cisco Deep Time
  Series models).

The whole field converges on the same loop DropWatch implements: pull telemetry,
reason, recommend, sometimes act. So "we built an agent that reasons over Splunk
data" is table stakes, not a differentiator. Two things actually separate
DropWatch:

1. Provable correctness creates clean signals (the load-bearing idea). Most
   observability spend goes to fighting ambiguous and duplicate signals — was this
   a real oversell, a retry, a race? ZeroDrop removes the ambiguity at the source:
   overselling is impossible by construction, so each event class has a single
   unambiguous meaning. An `oversell_reject` is definitionally "someone tried to
   buy sold-out stock," which makes bot-cluster detection high-precision instead of
   a guess. Cleaner inputs beat cleverer models. This is an argument about data
   quality at the source, which the big platforms cannot make for arbitrary
   customer apps — it is a property of the instrumented system, and DropWatch ships
   the instrumented system and the agent together.

2. Closing the loop with Apply plus a re-ingested breadcrumb. Many tools detect
   and recommend; fewer make the remediation a first-class, one-click, auditable
   action whose execution is itself emitted back as telemetry so the fix is
   observable in the same index. DropWatch's Apply does exactly this — the
   `sim_summary` breadcrumb with `opsAction` means the loop is visible end to end
   in Splunk, which is what an auditable agentic ops trail should look like.

Honest positioning: DropWatch is a sharp, end-to-end reference implementation of
the agentic-ops loop with a genuinely novel data-quality thesis, not a platform
competitor. Lean into being complete and explainable, not broad.

---

## 3. Broadening the Potential-Impact narrative beyond flash drops

The risk is a judge filing DropWatch as "a flash-sale tool." The defense is that
the engine is already generic; the drop taxonomy is one instantiation.

The generic core (already built, in `analyze.ts`):
- `summarize()` buckets every event type per minute into `rateSeries` — a generic
  per-event-type rate series, not drop-specific.
- The z-score / baseline path (`RateStats`) scores any series for deviation, so
  the detector runs on any event stream.
- `claimVelocity` is a generic leading-indicator pattern (acceleration + rising
  run) that applies to any rising-rate signal.
Only the four named findings and the action labels are domain-specific; they sit
on top of a domain-agnostic anomaly detector.

Three concrete broadenings to say out loud:

- Software / app reliability. Rename the event types and the same loop watches
  error-rate spikes, 5xx storms, retry amplification, queue-depth runaway, or
  latency-percentile drift. `oversell_reject` becomes any "guard rejected an
  attempt" event; stampede detection becomes traffic-surge detection.

- ITOps. Point it at any `index=*` of host/service events: job-failure bursts,
  auth-failure clusters by subnet (the exact `topRejectSubnets` logic is already a
  generic "one cluster dominating a failure class" detector), batch-window
  overruns, capacity drift. The Apply actions generalise to throttle / scale /
  block / notify.

- NetOps. Per-interface or per-flow event rates feed the same series:
  link-flap storms, BGP churn, DDoS-shaped surges (stampede detection by another
  name), top-talker subnet concentration. The subnet-clustering finding is already
  a NetOps-flavoured primitive.

Framing line for the video and Devpost: "DropWatch is a generic, explainable
anomaly-and-remediation agent for any Splunk index. We demo it on oversell-proof
flash drops because that domain produces unusually clean signals, which is the
whole point — but rename the events and it watches your services, hosts, or
network the same way."

The Shopify-app angle (the crisp commercial story): flash sales are a real,
recurring ops pain — overselling, bots/scalpers, cart-abandonment locking stock,
waiting-room and queue management are active problems merchants pay third-party
apps to solve. DropWatch productised is a Shopify app: a merchant installs it, the
app ships drop/checkout events to the merchant's Splunk via HEC, and the agent
gives one-click stampede throttling, bot-subnet flagging, hold-window tuning, and
restock-notify — backed by the same oversell-proof claim core. This gives the
impact narrative a named buyer and a named distribution channel without
overclaiming: it is a plausible product, framed as a direction, not a shipped one.

---

## 4. Prioritised, deadline-aware emphasis list

Deadline is imminent (Jun 15, 9:00 AM PDT). Optimise for the artifacts judges
actually score: the <3-min video, the Devpost text, the repo/README, and the
architecture diagram. Do not start new features. Priority order:

P0 — must be true at submit:
1. Get at least HEC ingest genuinely live on the trial and show it. The single
   most credible thing is real events landing in `index=zerodrop` and the agent
   reading them back. If only one Splunk capability is live, make it this one.
2. Repo public, license present, README setup steps verified to run, architecture
   diagram (the mermaid in `architecture_diagram.md`) included. These are hard
   submission requirements; a miss here is disqualifying regardless of quality.
3. Video under 3 minutes, publicly hosted (YouTube/Vimeo). Over-length or private
   risks the entry.

P1 — the highest-leverage things to emphasize, in this order:

Video (the highest-scoring artifact — front-load the proof and the idea):
1. Open on the live loop, not the slide: a drop under load, events streaming to
   Splunk, `/ops` re-scan, a critical finding, click Apply, then show the breadcrumb
   back in Splunk. Detect -> reason -> recommend -> apply -> re-observe, in ~45s.
2. State the one big idea in one sentence early: "Because ZeroDrop can never
   oversell, its telemetry is clean by construction, so the agent gets
   high-precision signals." This is the memorable differentiator; say it plainly.
3. Show the agent's transparency on screen: the exact SPL it ran and the
   `telemetry:` / LLM-tier labels. This sells Technological Implementation and
   Design at once.
4. Say the generic line: "rename the events and this watches any Splunk index"
   with one quick gesture at the rate-series / z-score path. Buys Potential Impact.
5. Be honest in one breath about MCP + Hosted Models being env-flip integrations
   with live fallbacks. One clean sentence; do not dwell, do not hide.

Devpost text description (skimmed fast — lead with the differentiators):
1. First paragraph: the clean-signals thesis + the closed loop. Not the feature list.
2. Explicit "What's AI/agentic about it" section naming MCP Server + Hosted Models
   (the two prize-relevant capabilities) and the three-tier fallback design.
3. The generic-engine / any-index framing and the Shopify-app direction, kept to a
   few sentences so impact reads as broad without overclaiming.
4. A short, honest "What's live vs wired" note. Judges reward candor and it
   pre-empts the biggest objection in 1a.
5. Call out the MCP integration specifically and concretely (JSON-RPC `tools/call`,
   configurable tool name, `telemetry: mcp` proof) — that is the separate $1,000
   prize and costs nothing extra to win attention.

Live demo / dashboard polish (only if P0 done and time remains):
1. Make sure the Apply -> breadcrumb is visibly working; it is the part most
   competitors lack.
2. Make the SPL panel and source/tier labels obviously visible — they are free
   credibility.
3. Pre-seed a scenario that triggers a critical stampede + an oversell-bot finding
   so the demo reliably shows high-severity, actionable output, not just "healthy."

Do NOT spend remaining time on: standing up a live MCP server or Hosted Models on
the trial if it is not quick (the fallbacks already make the demo whole), new
detector types, or UI restyling. The marginal point is in the video and the
honest, sharp framing, not in more code.

---

## Sources

- https://splunk.devpost.com/
- https://splunk.devpost.com/resources
- https://info.devpost.com/blog/understanding-hackathon-submission-and-judging-criteria
- https://www.splunk.com/en_us/blog/observability/splunk-observability-ai-agent-monitoring-innovations.html
- https://www.splunk.com/en_us/blog/observability/latest-splunk-observability-innovations.html
- https://www.apmdigest.com/splunk-introduces-advanced-ai-enhancements-for-observability-security-and-it-service-intelligence
- https://www.networkworld.com/article/4053995/ciscos-splunk-embeds-agentic-ai-into-security-and-observability-products
- https://metoro.io/blog/best-aiops-tools
- https://www.dash0.com/comparisons/ai-powered-observability-tools
- https://rootly.com/sre/predictive-ai-observability-trends-shaping-2026-incident-ops
- https://www.selector.ai/learning-center/aiops-4-components-and-4-key-capabilities/
- https://openobserve.ai/blog/top-10-aiops-platforms/
- https://aiopsschool.com/blog/top-10-ai-observability-copilots-features-pros-cons-comparison/
- https://www.augmentcode.com/guides/what-is-aiops
- https://acecloud.ai/blog/ecommerce-flash-sale-readiness-checklist/
- https://singhajit.com/flash-sale-system-design/
- https://www.crowdhandler.com/blog/waiting-room-queue-for-shopify-flash-sales
- https://help.shopify.com/en/manual/checkout-settings/bot-protection
- https://www.syncio.co/blog/how-to-solve-and-prevent-overselling-on-shopify-the-easy-way-w9fiy
