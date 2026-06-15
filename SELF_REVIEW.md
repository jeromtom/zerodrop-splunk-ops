# SELF_REVIEW — DropWatch, red-teamed by a tough judge

> Adversarial pre-submission review of the **Splunk Agentic Ops Hackathon** entry
> (Observability track). Every point below is grounded in the actual repo as of
> 2026-06-15. The tone is deliberately critical. No em dashes in this file.

This is not a victory lap. It is the harshest fair reading of DropWatch a judge
could give, paired with the cheapest honest fix for each problem. Where the
project is genuinely strong, that is noted so the rebuttal is credible, not
defensive.

---

## 1. Critiques by judging criterion

### Technological Implementation

**Strongest real critique.** The headline Splunk-native pieces are not running.
On the demo stack, telemetry is read from an in-process ring buffer
(`telemetrySource = "buffer"`), not from Splunk. The MCP Server read path
(`lib/dropwatch/search.ts` `searchViaMcp`) and the Splunk Hosted Models reasoning
tier (`lib/dropwatch/llm.ts`, gated on `SPLUNK_HOSTED_MODEL_URL`) are coded but
never exercised end to end against Splunk. So the live system is: app posts JSON
to HEC, then a Next.js process reasons over its own memory using a third-party
OpenAI-compatible API. The only verified Splunk-touching path is one-directional
HEC ingestion. A judge can fairly say the "agentic observability ON Splunk" story
is, in the running demo, "ingestion to Splunk plus an agent that reads local
memory." The `searchViaMcp` / `searchViaRest` parsers are also unverified against
any real response shape, so "code-complete" overstates confidence.

**Honest mitigation DropWatch can deliver.** Stand up the open-source Splunk MCP
Server locally (or `splunkd` REST on a Splunk Enterprise Docker image, which is
free and does expose port 8089, unlike the Cloud trial) and run one real
`scan()` so the header reads `telemetry: mcp` or `telemetry: rest`. Capture that
as a 15-second clip or screenshot appended to the demo. This converts the single
biggest "wired not live" caveat into "verified live" for a few hours of work and
directly unlocks the MCP bonus prize. Even a recorded `tools/list` + one
`tools/call` round-trip against the MCP server, pasted into `docs/SPLUNK_MCP.md`,
materially raises credibility. Until then, the honest framing already used in
`UPDATES.md` (live vs wired table) is the correct rebuttal: nothing is faked, the
fallbacks are real engineering, and HEC ingestion of 118 events is genuinely
verified.

### Design

**Strongest real critique.** The "agentic loop" is a single forward pass, not a
loop. `agent.ts` `scan()` runs exactly once: pull, summarize, reason, score,
return. There is no iteration, no re-query based on a hypothesis, no tool-use
cycle, no memory between scans, and no autonomous trigger. The LLM is given a
pre-computed feature JSON and asked for findings in one shot; the deterministic
`rulesEngine` already computes essentially the same findings, so the LLM is
closer to a rephrasing layer than an investigator. "Re-scan" is a human clicking
a button. Calling this an "agent" is generous, and a judge who builds agents will
notice. The architecture diagram further oversells with ITOps / NetOps source
connectors and an AI alert webhook that do not exist in the code (no webhook
sender is present in `lib/dropwatch`).

**Honest mitigation DropWatch can deliver.** Two cheap, real upgrades. (a) Give
the LLM the ability to actually issue a follow-up SPL query: after the first
reasoning pass, if a finding is flagged, let the agent request a narrower search
(for example, pull the raw events for the suspect /24) and re-reason. That is a
genuine second hop and makes "agentic loop" defensible. (b) Be precise in the
copy: describe it as a "single-pass reasoning agent with a deterministic floor"
rather than a multi-step autonomous loop, and either remove the
ITOps/NetOps/webhook nodes from `architecture_diagram.md` or clearly mark them as
roadmap, not built. The diagram legend already distinguishes live vs wired;
extend that discipline so nothing in the picture is purely aspirational without a
label.

### Potential Impact

**Strongest real critique.** The addressable problem is narrow. DropWatch only
produces interesting signal during a flash drop, on a platform that already
guarantees no oversell. The flagship insight (oversell-reject bursts equal a bot
signature) only exists because the base app made the actual failure impossible,
so the agent is detecting a low-stakes secondary phenomenon. Outside this exact
niche the value proposition is unproven, and the broader "general observability
agent" claim in `architecture_diagram.md` is asserted, not demonstrated, because
the only worked source is ZeroDrop and the only detectors with real teeth are the
four flash-drop domain rules.

**Honest mitigation DropWatch can deliver.** Lean into the genuinely
transferable parts rather than the breadth claim. The generic z-score anomaly
detector and the leading-indicator claim-velocity feature in `analyze.ts` really
are source-agnostic and operate on the `rateSeries` of any event type. Show that
with one non-ZeroDrop event stream (even a synthetic CPU or request-rate series
fed through `summarize`) to prove portability with evidence instead of prose.
Frame impact honestly: this is a sharp, demonstrable tool for high-stakes drop
events (sneaker, ticketing, NFT mints) where bot abuse and stampede are real
operational money, not a universal APM replacement. A tight, true niche beats a
broad, unsupported claim.

### Quality of the Idea

**Strongest real critique.** The core idea (ship app telemetry to Splunk via HEC,
then have an LLM summarize it and suggest actions) is a well-trodden pattern;
"LLM reads observability data and recommends fixes" is the default shape of every
AIOps pitch. The one original twist (provable correctness yields a clean
behavioral reject signal) is clever but subtle, and risks being lost on a judge
skimming submissions. There is also a framing risk: a skeptic could read the
whole project as ZeroDrop (a pre-existing app) with an observability wrapper
bolted on for the hackathon, which the eligibility rules scrutinize.

**Honest mitigation DropWatch can deliver.** Make the original insight the lead,
not a footnote: "because overselling is impossible by construction, the
oversell-reject stream is pure behavior, so a /24 reject burst is a clean bot
signature rather than a data-integrity scare." That one sentence is the idea's
moat and it should be the first thing the video and the Devpost elevator pitch
say. `UPDATES.md` already handles the eligibility angle well by documenting the
DropWatch layer as a wholly new feature built Jun 14 to 15; keep that front and
center so the "bolted on" reading never takes hold.

---

## 2. Top 5 credibility risks

Ranked by how badly each could sink the submission if a judge probes it.

### Risk 1 — The headline "oversell-bot" finding comes from synthesized mock data
**Severity: HIGH.** The dramatic 10.66.6.0/24 bot cluster, the 75 health score,
and the stampede are all produced by `lib/dropwatch/synth.ts`, which deliberately
plants both incidents (`botIp = 10.66.6.x`, `isBot = rand() < 0.55`). No real
traffic produced this. If the video implies a live attack was caught, that is the
most damaging possible misread. The HEC ingestion is real, but the events being
ingested and analyzed in the demo are synthetic.
**Cheapest honest fix.** Say the word "simulated" out loud in the video at the
moment the finding appears, and once in the Devpost "What it does" section. The
phrasing "we synthesize a realistic drop with a planted bot cluster, and the
agent independently rediscovers it" is both true and still impressive (it shows
the detector works). The `DEMO_SCRIPT.md` already gestures at this with "Run mock
drop"; make the honesty explicit in the narration, not just the script comments.

### Risk 2 — MCP Server and Hosted Models are not live, but are pitched for two bonus prizes
**Severity: HIGH.** The repo targets Best Use of Splunk MCP Server and Best Use
of Splunk Hosted Models, yet on the demo stack neither runs (`telemetry: buffer`,
`LLM: aiml`). A judge evaluating those specific prizes will look for the path
firing and not find it. Claiming a prize for a capability that no-ops in the demo
is the fastest way to lose judge trust on every other claim.
**Cheapest honest fix.** Either (a) actually light one up against a local Splunk
Enterprise / MCP server, even briefly, and screenshot it (see criterion 1), or
(b) drop the explicit bonus-prize claims to "MCP-ready / Hosted-Models-ready,
wired in code" and let the judges decide. The current `JUDGING.md` and
`SUBMISSION.md` are commendably honest about live-vs-wired; the risk is the
mismatch between that honesty and the prize targeting. Align them.

### Risk 3 — Niche impact dressed as general-purpose
**Severity: MEDIUM.** `architecture_diagram.md` claims a "general agentic
observability layer" serving ITOps and NetOps, but those source connectors and
the Slack/PagerDuty alert webhook are not in the code. Only ZeroDrop is wired, and
only the four flash-drop rules have real detection logic. A judge who reads the
diagram then greps the repo will find the gap.
**Cheapest honest fix.** Mark the ITOps, NetOps, and webhook nodes in the diagram
as "roadmap" (the legend already has a `wired` class; add a third `roadmap`
class), or delete them. Then make the one true generality claim with evidence:
the z-score detector runs on any `rateSeries`. Demonstrate it once.

### Risk 4 — The "agent" is a single LLM pass, not a multi-step loop
**Severity: MEDIUM.** Covered under Design. `scan()` is one pass with no
iteration, memory, or autonomous trigger, and the rules engine duplicates the
LLM's job. Splunk's rules require a real AI/agentic element; a strict judge could
argue this is an LLM-annotated dashboard rather than an agent.
**Cheapest honest fix.** Add the single follow-up SPL re-query described under
Design (genuine second hop), and describe the system precisely as a "single-pass
reasoning agent with a deterministic fallback." Do not claim autonomy the code
does not have. Even without the re-query, the pull plus reason plus recommend
plus apply-with-breadcrumb chain is more than a passive dashboard; argue that
honestly rather than inflating it to "autonomous multi-step loop."

### Risk 5 — "Apply" actions are breadcrumbs, not enforcement
**Severity: MEDIUM.** `lib/dropwatch/actions.ts` `applyAction` only pushes to an
in-process array and emits one `sim_summary` telemetry event. No throttle is
toggled, no hold window changes, no IP is ever blocked. The code comment admits
this ("In a production deploy each action kind would call the corresponding
control plane"). If the video says "the operator fixes it in one click," that
overstates reality: the click records intent, it does not remediate.
**Cheapest honest fix.** Narrate it accurately: "applying records the action as
an observable breadcrumb back into Splunk, closing the loop so the fix is itself
auditable." That is exactly what the code does and it is a legitimately nice
property. Reserve "real enforcement (edge throttle, IP blocklist)" for the
What's Next section, where `SUBMISSION.md` already correctly places it.

---

## 3. Pre-submission QA checklist

Concrete, checkable items. Anything marked FOUND is a live issue in the repo
right now.

**Links and assets**
- [ ] Demo video https://youtu.be/QsFjFh-rE7Y opens in an incognito/logged-out
      window (confirm it is Public or Unlisted, not Private; private videos are a
      common silent submission killer). Page title resolves to "DropWatch demo",
      which is a good sign, but verify the player actually plays.
- [x] Live site https://dropwatch.pages.dev loads (verified; waitlist page).
- [ ] Custom domain https://dropwatch.jeromtom.com either resolves or the
      "(custom domain provisioning)" hedge in `README.md` is kept so a dead link
      is not presented as live.
- [ ] Public repo https://github.com/jeromtom/zerodrop-splunk-ops is actually
      public and the pushed tree matches local (the agent code, `docs/`,
      `dashboards/`, `splunk-app/` are all present).
- [ ] Every relative link in `README.md` resolves on GitHub: `docs/SPLUNK_MCP.md`,
      `architecture_diagram.md`, `SETUP.md`, `DEMO_SCRIPT.md`, `UPDATES.md`,
      `.env.example`, `dashboards/dropwatch.xml`.

**Repo hygiene / Devpost requirements**
- [x] License present and detectable: `LICENSE` (MIT) at root and `"license":
      "MIT"` in `package.json`.
- [x] `architecture_diagram.md` is at repo root (Splunk often asks for an
      architecture diagram; mermaid renders on GitHub).
- [x] `ops:test` is green: 10/10 assertions pass (re-verified this session).
- [x] `ops:demo` flags stampede + oversell-bot offline.
- [ ] `next build` still succeeds on a clean checkout (claimed in docs; re-run
      before submitting since `AGENTS.md` warns this is a non-standard Next.js
      build and `node_modules`/`.next` are gitignored).
- [ ] No secrets committed: confirm `.env.local` (present in the working tree) is
      gitignored and the real HEC token / AIML key are not in git history.
      `.env.example` should carry placeholders only.
- [ ] `.dynalite-data/` and `.next/` are gitignored (build/runtime artifacts).

**Copy consistency (the embarrassing-if-caught tier)**
- [ ] FOUND: em dashes are present throughout despite `SUBMISSION.md` stating "No
      em dashes anywhere by design." Real U+2014 counts: `README.md` 23,
      `UPDATES.md` 34, `DEMO_SCRIPT.md` 15, `JUDGING.md` 11,
      `architecture_diagram.md` 5, `docs/SPLUNK_MCP.md` 4. `SUBMISSION.md` itself
      is clean (0). If the no-em-dash rule matters for the submission, strip them
      from the judge-facing files (`README.md`, `JUDGING.md`,
      `architecture_diagram.md`, `docs/SPLUNK_MCP.md`) at minimum, or delete the
      "by design" claim. Right now the claim is self-contradicting and a sharp
      judge who notices undermines trust in the other "verified" claims.
- [ ] Every "verified live" claim names the same stack (`prd-p-p8i91`) and date,
      and matches across `README.md`, `SUBMISSION.md`, `UPDATES.md`, `JUDGING.md`,
      `DEMO_SCRIPT.md`. Today's date drift (review run 2026-06-15) vs the
      "2026-06-14" verification stamp is fine, but keep them internally
      consistent.
- [ ] The number "118 events" is consistent everywhere it appears (README,
      SUBMISSION, UPDATES, JUDGING all currently say 118).
- [ ] Health score "75" and "HIGH oversell-bot finding" are consistent across
      docs and match what the recorded video actually shows on screen.
- [ ] The word "simulated" or "synthesized" appears in the video narration at the
      moment the bot finding is shown (ties to Risk 1).

**Diagram / claim integrity**
- [ ] `architecture_diagram.md` nodes that are not built (ITOps, NetOps,
      Slack/PagerDuty webhook) are labeled roadmap or removed (ties to Risk 3).
      The diagram currently classes the webhook as `live` though no webhook
      sender exists in `lib/dropwatch/`.
- [ ] `dashboards/dropwatch.xml` imports cleanly into Splunk and its SPL matches
      `buildSpl()` in `search.ts` (`index=zerodrop sourcetype=zerodrop:telemetry
      ... earliest=-Nm | sort 0 -_time | head 1000`).
- [ ] `splunk-app/` packaged app (`app.conf`, `savedsearches.conf`,
      `default.meta`, the view) is valid if it is being submitted as an installable
      app; otherwise do not reference it as "scheduled alerts" capability it has
      not been shown to run.

---

## Bottom line

The honest core is genuinely solid: real HEC ingestion, a clean deterministic
test, a real (if single-pass) LLM reasoning step, and one legitimately clever
insight about provable-correctness producing clean behavioral signal. The
exposure is the gap between the pitch and the running demo: the marquee finding
is planted synthetic data, the two Splunk-native bonus paths do not actually run,
and some copy (general-purpose claims, "one-click fix", "no em dashes by design")
overstates what the code does. Close those gaps with precise language and one
short live-MCP clip and this is a strong, trustworthy Observability entry.
