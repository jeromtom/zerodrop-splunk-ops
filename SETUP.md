# SETUP — Jerom's runbook (Splunk Agentic Ops Hackathon)

Local mock mode needs none of this — `npm run ops:demo` and the `/ops` dashboard
work offline with zero accounts. This runbook covers going **live with Splunk**
and the **Devpost submission**.

> **Deadline:** submissions close **Jun 15, 2026, 9:00 AM PDT** (≈ 9:30 PM IST).
> This is tight — do the registration + HEC token first; everything else already
> works in mock mode.
>
> **Track(s):** Observability ($3,000) + Best Use of Splunk MCP Server ($1,000).
> **Do NOT** enter the Security track.

---

## 0. Claude-in-Chrome runbook (registration — Jerom drives)

These are browser steps for the **Claude in Chrome** extension to perform with
Jerom supervising. **Jerom handles all captchas, OTPs, email verifications, and
the final submit. Never auto-submit the Devpost entry.**

Identity to use: **Jerom Tom · dev.jeromtom@gmail.com · GitHub `jeromtom`**.

### 0a. Splunk account + trial + developer license
1. Go to https://www.splunk.com/en_us/download.html and **Create a Splunk
   account** (email dev.jeromtom@gmail.com). Jerom completes email verification.
2. Start the **Splunk Cloud Platform 14-day trial** *or* download **Splunk
   Enterprise** and start the **60-day Enterprise trial** (whichever is faster to
   get a working HEC endpoint — Splunk Cloud trial is usually quickest).
3. Apply for the **Splunk Developer Program** 6-month developer license:
   https://dev.splunk.com/enterprise/dev_license — submit with Jerom's details.
   (Not required for the demo if the trial is active; do it for longevity.)

### 0b. Enable HEC + copy the token
1. In Splunk: **Settings → Data inputs → HTTP Event Collector**.
2. **Global Settings →** ensure "All Tokens" is **Enabled**, note the HEC port
   (usually 8088).
3. First create the index: **Settings → Indexes → New Index → `zerodrop`**
   (and optionally a metrics index `zerodrop_metrics`, type Metrics).
4. **New Token →** name `dropwatch`, source type `zerodrop:telemetry`, allowed
   index `zerodrop`.
5. **Copy the token value** — this is `SPLUNK_HEC_TOKEN`.
6. The collector URL is `SPLUNK_HEC_URL` =
   `https://<your-host>:8088/services/collector` (Splunk Cloud uses a
   `https://http-inputs-<stack>.splunkcloud.com:443/services/collector` form —
   copy exactly what the HEC page shows).

### 0c. (Optional) API token for REST search fallback
- **Settings → Tokens → New Token** (enable token auth if prompted). Copy as
  `SPLUNK_API_TOKEN`; `SPLUNK_API_URL` = `https://<host>:8089`.

### 0d. Devpost registration
1. Go to https://splunk.devpost.com/ → **Register / Join hackathon** with
   dev.jeromtom@gmail.com.
2. Do **not** submit the project automatically — Jerom fills and submits the
   final form himself near the deadline.

---

## 1. Point DropWatch at Splunk

Create `.env.local` (copy from `.env.example`) and set at minimum:

```bash
SPLUNK_HEC_URL=https://<host>:8088/services/collector
SPLUNK_HEC_TOKEN=<token from 0b>
SPLUNK_INDEX=zerodrop
# self-signed trial cert? (dev only)
SPLUNK_HEC_INSECURE=1
```

Smoke-test HEC without the app:

```bash
curl -k "$SPLUNK_HEC_URL" \
  -H "Authorization: Splunk $SPLUNK_HEC_TOKEN" \
  -d '{"event":{"event":"claim","dropId":"smoke","time":"'"$(date -Iseconds)"'"},"sourcetype":"zerodrop:telemetry","index":"zerodrop"}'
# expect: {"text":"Success","code":0}
```

Then run the app and generate telemetry:

```bash
npm install
npm run db:local        # terminal 1
npm run db:seed         # terminal 2
npm run dev             # terminal 2 -> http://localhost:3000
```

Log in (demo@zerodrop.app / drop-zero-2026), open a drop, hit the stress-test,
then in Splunk run:

```spl
index=zerodrop sourcetype=zerodrop:telemetry | stats count by event
```

## 2. Import the dashboard

Splunk → **Dashboards → Create New Dashboard → Classic → Source** → paste
[`dashboards/dropwatch.xml`](./dashboards/dropwatch.xml) → Save.

## 3. (For the MCP prize) run a Splunk MCP Server

Follow [docs/SPLUNK_MCP.md](./docs/SPLUNK_MCP.md), then set `SPLUNK_MCP_URL`
(+ token/tool name). On `/ops`, **Re-scan** should show `telemetry: mcp`.

## 4. (Optional) live LLM reasoning

- **Splunk Hosted Models:** set `SPLUNK_HOSTED_MODEL_URL` (+ token + model) to an
  OpenAI-compatible chat/completions endpoint.
- **AI/ML API fallback:** set `AIMLAPI_API_KEY` (model `gpt-4o-mini`).
- With neither, the deterministic rules engine runs — `/ops` still works.

---

## Submission checklist (Splunk rules)

- [ ] Public GitHub repo (Jerom flips `jeromtom/zerodrop-splunk-ops` to public at submit)
- [ ] README with setup/run instructions ✅
- [ ] `architecture_diagram.md` (mermaid: app → Splunk → agent) ✅
- [ ] Demo video **< 3 min** (script in DEMO_SCRIPT.md) — record + upload
- [ ] Text description of features (use README "What's AI/agentic about it")
- [ ] Uses a Splunk AI capability: **MCP Server + Hosted Models** ✅ (documented)
- [ ] `UPDATES.md` showing the significant update after the submission period start ✅
- [ ] Submit on https://splunk.devpost.com/ before **Jun 15, 9:00 AM PDT** (Jerom)
