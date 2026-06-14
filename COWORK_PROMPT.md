# DropWatch — Cowork / Claude-in-Chrome prompt

Paste the block below into Claude in Chrome (Cowork). It handles Splunk account +
HEC token + Devpost registration. Jerom supervises (captcha/OTP/submit stay manual).
See SETUP.md for the full detail behind each step.

```
You are helping Jerom set up Splunk for the DropWatch project (Splunk Agentic Ops
Hackathon submission). Identity: Jerom Tom · dev.jeromtom@gmail.com · GitHub jeromtom.

GROUND RULES:
- I (Jerom) handle every captcha, OTP, and email verification — pause and tell me when one appears.
- Pause before entering any payment details (none should be required; the trial is free).
- DO NOT submit the Devpost project entry. Registration only. I submit the final form myself.
- The local project is at D:\jeromtom\hackathoner\zerodrop-splunk-ops. You may edit .env.local and run terminal commands there, but never commit secrets or run `git push`.

STEPS:
1. Go to https://www.splunk.com/en_us/download.html and create a Splunk account with
   dev.jeromtom@gmail.com. Pause for my email verification.
2. Start the fastest free trial that gives a working HTTP Event Collector (HEC) endpoint —
   prefer the Splunk Cloud Platform 14-day trial; fall back to Splunk Enterprise 60-day trial.
3. In Splunk: Settings → Indexes → New Index → create an index named exactly `zerodrop`.
4. Settings → Data inputs → HTTP Event Collector → Global Settings → ensure "All Tokens" is
   Enabled (note the port, usually 8088). Then New Token → name `dropwatch`,
   sourcetype `zerodrop:telemetry`, allowed index `zerodrop`. Copy the token VALUE.
5. Note the collector URL exactly as the HEC page shows it. It's either
   https://<host>:8088/services/collector  or for Splunk Cloud
   https://http-inputs-<stack>.splunkcloud.com:443/services/collector
6. Write these into D:\jeromtom\hackathoner\zerodrop-splunk-ops\.env.local (create/append):
       SPLUNK_HEC_URL=<collector url from step 5>
       SPLUNK_HEC_TOKEN=<token from step 4>
       SPLUNK_INDEX=zerodrop
       SPLUNK_HEC_INSECURE=1
   (Leave the existing AIMLAPI_API_KEY line intact.)
7. Smoke-test HEC from a terminal in that folder and show me the output (expect {"text":"Success","code":0}):
       curl -k "$SPLUNK_HEC_URL" -H "Authorization: Splunk $SPLUNK_HEC_TOKEN" -d '{"event":{"event":"claim","dropId":"smoke"},"sourcetype":"zerodrop:telemetry","index":"zerodrop"}'
8. Go to https://splunk.devpost.com/ and register / join the hackathon with dev.jeromtom@gmail.com.
   STOP there — do not start or submit a project entry.
9. Report back to me: the SPLUNK_HEC_URL, confirmation the smoke test returned Success,
   and that Devpost registration is done.
```

## After Cowork finishes
1. `npm install` then `npm run db:local` (terminal 1) and `npm run db:seed` + `npm run dev` (terminal 2).
2. Log in `demo@zerodrop.app / drop-zero-2026`, open a drop, run the stress-test.
3. In Splunk: `index=zerodrop sourcetype=zerodrop:telemetry | stats count by event`.
4. Open `/ops`, hit Re-scan — agent should flag stampede + oversell-bot.
5. Import `dashboards/dropwatch.xml`. Record the <3-min video per DEMO_SCRIPT.md.
6. Make the repo public, then submit on Devpost yourself before Jun 15, 9:00 AM PDT.
