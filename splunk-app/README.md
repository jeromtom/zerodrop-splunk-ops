# DropWatch — Agentic Drop Observability (Splunk app)

DropWatch is the observability layer for **ZeroDrop**, a flash-drop commerce
platform. Every hot path in ZeroDrop emits a structured telemetry event that is
shipped to Splunk via HEC. This app packages that observability story as a
real, installable Splunk app:

- a **dashboard** for humans (the live drop-health view), and
- a set of **scheduled detector alerts** that run the same drop-health logic
  natively in Splunk, continuously, server-side.

The detectors mirror the deterministic rules engine that powers DropWatch's
in-app agent (`lib/dropwatch/analyze.ts` in the ZeroDrop repo). Running them as
Splunk saved searches means the platform is watched even when no operator has
the `/ops` console open, and the critical alerts can call back into ZeroDrop to
automate the response.

## Telemetry contract

| Field       | Meaning                                                              |
| ----------- | ------------------------------------------------------------------- |
| `event`     | `claim`, `hold_create`, `hold_expiry`, `oversell_reject`, `waitlist_add`, `checkout`, `sim_summary` |
| `dropId`    | the drop the event belongs to                                       |
| `dropName`  | denormalized drop name for easy grouping                            |
| `ip`        | source IP (used for /24 bot-cluster grouping)                       |
| `position`  | claim / waitlist position                                           |
| `buyer`     | masked buyer identity (never raw PII)                               |
| `latencyMs` | latency of the underlying DynamoDB write                            |

- **Index:** `zerodrop`
- **Sourcetype:** `zerodrop:telemetry`

## What is in the app

```
splunk-app/
├── README.md
├── default/
│   ├── app.conf                          # app id "dropwatch", label, version, visible
│   ├── savedsearches.conf                # 6 scheduled detector alerts
│   └── data/ui/views/dropwatch.xml       # the DropWatch dashboard
└── metadata/
    └── default.meta                      # exports views + savedsearches system-wide
```

## Scheduled detector alerts

All run over `index=zerodrop sourcetype=zerodrop:telemetry`.

| Alert | What it catches | Schedule | Fires when | Webhook |
| ----- | --------------- | -------- | ---------- | ------- |
| **Stampede onset** | Claim rate spikes far above its rolling baseline | every 2 min | peak claims/min >= 20 and peak/baseline >= 4 | yes |
| **Oversell-bot subnet cluster** | One /24 subnet dominates post-sellout reject attempts | every 2 min | >= 10 oversell rejects and top subnet >= 25% of them | yes |
| **Hold-expiry storm** | Holds bouncing back to stock after the rush | every 5 min | >= 10 expiries and expiry rate >= 0.3 | no |
| **Waitlist conversion collapse** | Demand captured but not converted | every 10 min | >= 10 waitlist adds, conversion < 0.3 | no |
| **Generic rate anomaly** | Any event type spikes vs its own baseline | every 5 min | latest-minute z-score >= 3 and >= 10 events | no |
| **Write latency degradation** | DynamoDB write latency rising under load | every 5 min | >= 20 writes and p95 latency >= 250 ms | no |

The two critical detectors (stampede onset and oversell-bot cluster) carry a
**webhook alert action** so they can automate response, not just notify. They
POST their result set to the ZeroDrop automation endpoint, which is the same
entry point the in-app agent uses to apply remediations (enable throttle, flag
an IP cluster, extend a hold). The other detectors use Splunk's built-in alert
tracking so they show up in **Activity > Triggered Alerts**.

Each alert sets `alert.suppress` per drop (and per subnet / event where
relevant) so a sustained incident produces one alert, not one per cron tick.

## Install

1. Copy the `splunk-app` directory into your Splunk apps folder, naming it
   `dropwatch`:

   ```bash
   cp -r splunk-app "$SPLUNK_HOME/etc/apps/dropwatch"
   ```

   On a Splunk Cloud / Victoria instance, package it as a tarball
   (`tar czf dropwatch.tgz dropwatch/`) and upload via **Apps > Manage Apps >
   Install app from file**.

2. Make sure the `zerodrop` index exists. If not, create it
   (**Settings > Indexes > New Index**, name `zerodrop`).

3. Set up HEC so ZeroDrop can ship telemetry (**Settings > Data inputs > HTTP
   Event Collector > New Token**). Point the token's default index to
   `zerodrop` and sourcetype to `zerodrop:telemetry`, then put the token into
   ZeroDrop's environment (`SPLUNK_HEC_TOKEN`, `SPLUNK_HEC_URL`).

4. **Wire the webhooks.** Edit
   `etc/apps/dropwatch/default/savedsearches.conf` (or override in
   `local/savedsearches.conf`) and set `action.webhook.param.url` on the two
   critical alerts to your ZeroDrop deployment, for example:

   ```
   action.webhook.param.url = https://your-zerodrop-host/api/ops/scan
   ```

   Leave it blank to disable the webhook and rely on Splunk's own alert
   tracking only.

5. Restart Splunk (or **Settings > Server controls > Restart**) so the app,
   scheduled searches, and dashboard load.

## How it maps to the in-app DropWatch agent

The in-app agent (`/ops` console) pulls a window of telemetry back out of
Splunk (via the Splunk MCP Server or the REST search API), extracts features in
`lib/dropwatch/analyze.ts`, and runs a deterministic rules engine to produce
findings with one-click remediation actions.

This app moves that same logic **server-side and on a schedule**:

| In-app agent rule (`analyze.ts`) | Splunk scheduled alert |
| -------------------------------- | ---------------------- |
| `stampede` (ratio >= 4, peak >= 20) | DropWatch - Stampede onset |
| `oversell-bot` (top subnet >= 25% of >= 10 rejects) | DropWatch - Oversell-bot subnet cluster |
| `hold-expiry-storm` (>= 10 expiries, rate >= 0.3) | DropWatch - Hold-expiry storm |
| `waitlist-collapse` (>= 10 adds, conversion < 0.3) | DropWatch - Waitlist conversion collapse |
| (statistical safety net) | DropWatch - Generic rate anomaly |
| (latency guard for tail pain) | DropWatch - Write latency degradation |

The thresholds are kept identical so the dashboard, the scheduled alerts, and
the agent all tell the same story. The agent gives an operator interactive,
explained findings on demand; these alerts give the platform always-on,
autonomous coverage that can trigger remediation through the webhook before a
human is even looking.
