# DropWatch + Splunk Hosted Models

This documents how DropWatch uses **Splunk Hosted Models** as its primary
reasoning tier. This is the integration we are submitting for the **Best Use of
Splunk Hosted Models** prize.

## Status (honest)

The Splunk Hosted Models path is **wired and code-complete** in
`lib/dropwatch/llm.ts`. It is the first reasoning tier the agent tries on every
scan: when `SPLUNK_HOSTED_MODEL_URL` is set, DropWatch sends the telemetry
features to that endpoint before it ever falls back to the AIML API or the
deterministic rules engine.

The recorded live demo ran on the **Splunk Cloud trial**. Because the trial does
not expose the Splunk-native model serving used here, the live demo reasoned via
the **AIML API fallback** (`aiml`) — and the rules engine as the zero-key floor.
We **do not claim** the hosted-model tier was live on the trial. The "Going LIVE"
runbook below makes it the primary tier on a real Splunk instance with no code
change — only environment variables.

## Why Splunk Hosted Models

DropWatch's reasoning step turns a JSON summary of drop telemetry into concrete,
grounded findings (stampede, oversell-bot, hold-expiry-storm, waitlist-collapse)
with recommended actions. Running that inference on **Splunk Hosted Models**
keeps the agent's reasoning inside the Splunk platform: telemetry is pulled from
Splunk (via the MCP Server, see `docs/SPLUNK_MCP.md`) and reasoned over by a
Splunk-served model. Both halves of the agent loop are Splunk-native.

## Where it lives in the code

- `lib/dropwatch/llm.ts` -> `reason()` — the three-tier ladder:
  **Splunk Hosted Models -> AIML API -> rules engine**.
- `lib/dropwatch/llm.ts` -> `tryChat()` — the OpenAI-compatible
  `chat/completions` call, shared by the hosted-model and AIML tiers (only the
  URL, token, and model differ).
- `lib/dropwatch/agent.ts` -> `scan()` — records `llmTier` and `llmUsed` in the
  `ScanReport`.
- `components/OpsDashboard.tsx` — renders `LLM: <tier>` in the `/ops` header
  from `report.llmTier`.

The three tiers (`LlmTier`):

| Tier           | Trigger                       | Endpoint                                   |
| -------------- | ----------------------------- | ------------------------------------------ |
| `hosted-model` | `SPLUNK_HOSTED_MODEL_URL` set | Splunk Hosted Models (OpenAI-compatible)   |
| `aiml`         | `AIMLAPI_API_KEY` set         | `https://api.aimlapi.com/v1` (gpt-4o-mini) |
| `rules`        | always available              | `lib/dropwatch/analyze.ts` (no key)        |

The first tier whose call succeeds wins; any failure (unset URL, non-2xx, parse
error) falls through to the next. The rules engine guarantees the agent always
produces findings.

## Environment variables

| Variable                   | Required | Default      | Meaning                                                           |
| -------------------------- | -------- | ------------ | ----------------------------------------------------------------- |
| `SPLUNK_HOSTED_MODEL_URL`  | yes      | *(unset)*    | Full chat/completions URL. When set, hosted models are primary.   |
| `SPLUNK_HOSTED_MODEL_TOKEN`| if auth  | *(unset)*    | Bearer token; sent as `Authorization: Bearer <token>`.            |
| `SPLUNK_HOSTED_MODEL`      | no       | `splunk-llm` | Model id to request (set to the hackathon model you were issued). |

For the AIML fallback: `AIMLAPI_API_KEY` (required to enable it),
`AIMLAPI_BASE_URL` (default `https://api.aimlapi.com/v1`), `AIMLAPI_MODEL`
(default `gpt-4o-mini`).

## Which models the hackathon offers

Splunk Hosted Models / the **Splunk AI Toolkit** make these models available for
this hackathon. Set `SPLUNK_HOSTED_MODEL` to whichever one you were issued:

- **`gpt-oss-120b`** — the large open-weight general model; best reasoning
  quality, the default choice for DropWatch's anomaly analysis.
- **`gpt-oss-20b`** — the smaller, faster open-weight model; lower latency for
  high-frequency scans.
- **`Foundation-Sec-8B`** — Cisco/Splunk's security-tuned foundation model,
  served through the Splunk AI Toolkit; a strong fit when the reasoning leans
  toward abuse/bot detection (e.g. the oversell-bot anomaly class).

All three are exposed over an **OpenAI-compatible `chat/completions`** surface,
which is exactly the contract `tryChat()` already speaks — so selecting one is
just a `SPLUNK_HOSTED_MODEL` value plus the endpoint URL.

## The exact chat contract

DropWatch posts one OpenAI-style `chat/completions` request to
`SPLUNK_HOSTED_MODEL_URL`.

### Request DropWatch sends

Headers:

```
Content-Type: application/json
Authorization: Bearer <SPLUNK_HOSTED_MODEL_TOKEN>   # only when the token is set
```

Body (the literal shape produced by `tryChat()`):

```json
{
  "model": "gpt-oss-120b",
  "temperature": 0.2,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "<DropWatch SRE system prompt>" },
    { "role": "user",   "content": "<JSON summary of drop telemetry features>" }
  ]
}
```

- `model` is `SPLUNK_HOSTED_MODEL`.
- `temperature` is `0.2` (deterministic-leaning, since this is ops reasoning).
- `response_format: { type: "json_object" }` asks for strict JSON. The system
  prompt also pins the exact JSON schema and the parser tolerates fenced code
  blocks, so a model that ignores `response_format` still parses.
- The `user` message is `JSON.stringify(features)` — the grounded telemetry
  summary from `summarize()`.

### Response DropWatch expects

Standard OpenAI chat shape; DropWatch reads
`choices[0].message.content` and parses it into `Finding[]`:

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "{\"findings\":[{\"id\":\"oversell-bot-1\",\"title\":\"IP cluster driving oversell rejects\",\"severity\":\"high\",\"reasoning\":\"...\",\"recommendation\":\"...\",\"action\":{\"kind\":\"flag_ip_cluster\",\"label\":\"Flag cluster\",\"params\":{}}}]}"
      }
    }
  ]
}
```

`parseFindings()` then validates severity against
`critical|high|medium|low|info`, normalises the `action.kind` against the
allowed set (`enable_throttle|extend_hold|flag_ip_cluster|notify|none`), and
tags each finding with `source: "hosted-model"`.

## Going LIVE: make Splunk Hosted Models the primary tier

These steps move `/ops` from `LLM: aiml` (or `rules`) to `LLM: hosted-model`,
keeping AIML as the automatic fallback.

### 1. Enable the model serving

On your Splunk instance, enable **Splunk Hosted Models** / install the **Splunk
AI Toolkit** and provision the model you want (`gpt-oss-120b`, `gpt-oss-20b`, or
`Foundation-Sec-8B`). Note the **OpenAI-compatible chat/completions URL** and a
token that can call it.

### 2. Point DropWatch at it

Set these in the DropWatch app environment (`.env.local`, Vercel project env, or
your shell) and restart the app:

```bash
SPLUNK_HOSTED_MODEL_URL=https://<splunk-host>/<path>/chat/completions
SPLUNK_HOSTED_MODEL_TOKEN=<token>
SPLUNK_HOSTED_MODEL=gpt-oss-120b        # or gpt-oss-20b / Foundation-Sec-8B
```

`SPLUNK_HOSTED_MODEL_URL` must be the **full** chat/completions URL — unlike the
AIML tier, DropWatch does not append `/chat/completions` to it. Because
`reason()` checks `SPLUNK_HOSTED_MODEL_URL` first, setting it makes hosted models
the primary tier with no code change.

### 3. Keep AIML as the fallback

Leave `AIMLAPI_API_KEY` set. If a hosted-model call fails (endpoint down, non-2xx,
unparseable output), `reason()` automatically tries AIML next, then the rules
engine. The agent never fails to produce findings.

### 4. Verify the flip

1. Open `/ops` and click **Re-scan**.
2. The header now reads:

   ```
   telemetry: <source> · LLM: hosted-model
   ```

   `LLM: hosted-model` is the proof: the findings were reasoned by a Splunk
   Hosted Model. `report.llmUsed` is `true`, and each finding carries
   `source: "hosted-model"`.

### Quick endpoint smoke test

```bash
curl -sS "$SPLUNK_HOSTED_MODEL_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SPLUNK_HOSTED_MODEL_TOKEN" \
  -d '{
    "model": "gpt-oss-120b",
    "temperature": 0.2,
    "response_format": {"type": "json_object"},
    "messages": [
      {"role": "system", "content": "Reply with strict JSON only."},
      {"role": "user",   "content": "{\"ping\":true}"}
    ]
  }'
```

A 2xx with a `choices[0].message.content` JSON string confirms the endpoint,
token, and model id are correct before you wire them into DropWatch.

### Troubleshooting

- **Header still says `aiml` or `rules`** — `SPLUNK_HOSTED_MODEL_URL` is unset or
  the app did not restart. Confirm the variable is present in the running process.
- **`hosted-model` but findings look generic** — the model ignored
  `response_format`. The parser still recovers JSON from fenced blocks; if it
  cannot, the tier returns `null` and DropWatch falls through to AIML. Try a
  larger model (`gpt-oss-120b`).
- **401 / 403** — `SPLUNK_HOSTED_MODEL_TOKEN` is wrong/expired or lacks access to
  the chosen model. Reissue and re-test with the smoke-test curl above.
- **Watch the logs** — a failed hosted-model call logs
  `"[dropwatch] hosted-model HTTP <status>:"` before falling back.
