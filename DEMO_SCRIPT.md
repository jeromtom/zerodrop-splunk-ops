# DEMO_SCRIPT — DropWatch, under 3 minutes

Target runtime **2:40**. Record 1080p+, narrate over it. The story: a live drop
goes viral → telemetry lands in Splunk → the DropWatch agent detects a stampede
**and** an oversell-bot cluster → recommends a throttle → operator applies it.

**Prep**
- Two browser windows: (1) the app at `http://localhost:3000`, (2) Splunk with
  the imported DropWatch dashboard (or skip Splunk and stay in mock mode if no
  account — the `/ops` page tells the same story offline).
- Logged in as demo@zerodrop.app; AURA-1 drop reset to 0/100.
- A terminal ready with `npm run ops:demo` (fallback / B-roll).

---

### 0:00–0:20 — The problem + the guarantee
> "Flash drops sell out in seconds. The #1 way brands lose trust is overselling.
> ZeroDrop makes that impossible — every claim is one atomic DynamoDB
> conditional write. But once you're safe, the next question is: *what's actually
> happening during the drop?* That's DropWatch."

Show the landing page, then the AURA-1 drop at 0/100.

### 0:20–0:50 — Generate a live drop (telemetry → Splunk)
- Click **Unleash the stampede** (250 buyers). Stock bar races to **100/100,
  oversold 0**.
> "Every claim, hold, expiry, oversell-reject, waitlist and checkout just emitted
> a structured event to Splunk over HTTP Event Collector."

Cut to the Splunk dashboard; run `index=zerodrop sourcetype=zerodrop:telemetry
| stats count by event` — the events are there. Point at the **claim-rate
timechart** spiking and the **oversell-reject by /24 subnet** table.

### 0:50–1:50 — The agent reasons (the AI moment)
Open **/ops**.
> "DropWatch is an agent. It pulls recent telemetry back out of Splunk — through
> the Splunk MCP Server — summarises it, and an LLM on Splunk Hosted Models
> reasons about drop health."

Point at the header: `telemetry: mcp · LLM: hosted-model` (or `buffer · rules`
in offline mock mode). Click **Re-scan**. Walk the finding cards:
- **Drop-health score** drops from 100.
- **[HIGH] Stampede onset** — "claim rate spiked 7x baseline."
- **[HIGH] Oversell-attempt bot cluster** — "subnet 10.66.6.0/24, 12 IPs,
  produced 54% of all oversell-rejects — the bot signature. No oversell happened;
  the DynamoDB guard held."

Show the **SPL run by agent** panel — the exact search it issued.

### 1:50–2:25 — Recommend → apply (close the loop)
> "It doesn't just alert — it recommends concrete actions."
- Click **Enable queue throttle** on the stampede card → green "✓ throttle
  enabled."
- Click **Flag 10.66.6.0/24** on the bot card → "✓ flagged for soft-block."
> "Each action writes a breadcrumb back into Splunk, so the whole remediation
> loop is observable too."

Show the **Applied actions** list and the live feed updating.

### 2:25–2:40 — Close
> "DropWatch turns ZeroDrop's hot paths into Splunk telemetry, and an agent that
> reads it back through the MCP Server, reasons with Splunk Hosted Models, and
> acts. Oversell-proof — and now fully observable."

Optional B-roll: terminal `npm run ops:demo` printing the same two findings, to
prove it runs end-to-end offline.

---

**Backup (no Splunk account at record time):** the entire flow works in mock
mode. On `/ops`, click **Run mock drop** instead of using a live Splunk index —
the header shows `telemetry: buffer · LLM: rules` and the same findings appear.
Note in narration that the live Splunk/MCP/Hosted-Models paths are wired and
documented (README + docs/SPLUNK_MCP.md), gated behind env.
