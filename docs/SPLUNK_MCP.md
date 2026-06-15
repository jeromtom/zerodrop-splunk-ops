# DropWatch + the Splunk MCP Server

This documents how DropWatch uses the **Splunk MCP Server** as its primary
channel for reading telemetry back out of Splunk. This is the integration we are
submitting for the **Best Use of Splunk MCP Server ($1,000)** prize.

## Status (honest)

The MCP read path is **wired and code-complete** in `lib/dropwatch/search.ts`.
It is the first tier the agent tries on every scan: when `SPLUNK_MCP_URL` is set,
DropWatch issues its SPL through the MCP server's `run_splunk_search` tool over
JSON-RPC before it ever considers the REST API or the local buffer.

The recorded live demo ran on the **Splunk Cloud trial**, which does **not**
expose the management/search port that the MCP Server needs. On that trial the
agent therefore reported `telemetry: buffer` (local ring buffer) with the AIML
reasoning fallback. The MCP path is **not claimed to be live on the trial**. The
"Going LIVE" runbook below flips it to `telemetry: mcp` on any non-trial Splunk
Enterprise in a few minutes, with no code change — only environment variables.

## Run the MCP path locally, end-to-end (no Splunk account)

So the MCP client path is not just "wired" but **demonstrably executes**, the repo
ships a local server that implements the **same MCP JSON-RPC contract** as the
Splunkbase Splunk MCP Server's search tool (`run_splunk_search`). It serves
synthetic, Splunk-shaped telemetry (the planted stampede + oversell-bot stream)
over the real MCP wire protocol, so DropWatch's `searchViaMcp()` runs for real.

**One command (self-contained proof):**

```bash
npm run ops:mcp
# starts the local MCP server, points the agent at it, runs one scan, and asserts
# telemetrySource === "mcp". Prints: "PASS: pulled N events through the Splunk MCP
# Server tool contract (run_splunk_search)".
```

**Or drive the /ops UI over MCP:**

```bash
npm run mcp:server                                   # terminal 1 (prints the URL)
# terminal 2:
SPLUNK_MCP_URL=http://127.0.0.1:7878/mcp npm run dev # then open /ops, click Re-scan
```

The `/ops` header now reads `telemetry: mcp`, and the **Telemetry pull path** panel
highlights *Splunk MCP Server* with the exact SPL that travelled over MCP.

> Honest scope: the local server is a stand-in so the integration is provable
> without a non-trial Splunk Enterprise. It speaks the real protocol; only the
> backing store is synthetic. Swap `SPLUNK_MCP_URL` for a real Splunk MCP Server
> (see "Going LIVE" below) and the identical code path goes live.

## Why MCP

DropWatch is an *agent*. Its monitoring cycle is:

```
pull recent telemetry  ->  summarise  ->  LLM reasons  ->  recommend / act
```

The "pull recent telemetry" step is a tool call. Rather than hard-wiring the
Splunk REST API, DropWatch issues its SPL through the **Splunk MCP Server's
search tool** (`run_splunk_search`). This is the idiomatic agentic pattern: the
agent treats Splunk as a tool surface exposed over the Model Context Protocol,
so the same agent could be dropped into any MCP-aware host (Claude Desktop, an
IDE, an orchestration runtime) and immediately query Splunk.

## Where it lives in the code

- `lib/dropwatch/search.ts` -> `searchViaMcp()` — issues a JSON-RPC
  `tools/call` to the MCP server's search tool and unwraps the result rows into
  `DropEvent`s.
- `lib/dropwatch/search.ts` -> `fetchTelemetry()` — the priority ladder:
  **MCP server -> Splunk REST search -> local buffer (offline)**.
- `lib/dropwatch/agent.ts` -> `scan()` — the agent loop that calls it and
  records `telemetrySource` in the `ScanReport`.
- `components/OpsDashboard.tsx` — renders `telemetry: <source>` in the `/ops`
  header from `report.telemetrySource`.

## Environment variables

| Variable           | Required | Default              | Meaning                                                              |
| ------------------ | -------- | -------------------- | ------------------------------------------------------------------- |
| `SPLUNK_MCP_URL`   | yes      | *(unset)*            | The MCP server's streamable-HTTP endpoint. When set, MCP is primary. |
| `SPLUNK_MCP_TOKEN` | if auth  | *(unset)*            | Bearer token; sent as `Authorization: Bearer <token>`.               |
| `SPLUNK_MCP_TOOL`  | no       | `run_splunk_search`  | Name of the search tool to call (override to match `tools/list`).    |
| `SPLUNK_INDEX`     | no       | `zerodrop`           | Index the agent searches (from `lib/dropwatch/events.ts`).           |

DropWatch automatically prefers MCP whenever `SPLUNK_MCP_URL` is set, and falls
back gracefully otherwise (`searchMode()` and `fetchTelemetry()` enforce this).

## The exact tool contract

DropWatch speaks the standard MCP JSON-RPC `tools/call` method over a single
HTTP POST to `SPLUNK_MCP_URL`.

### Request DropWatch sends

Headers:

```
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <SPLUNK_MCP_TOKEN>     # only when SPLUNK_MCP_TOKEN is set
```

Body (this is the literal shape produced by `searchViaMcp()`):

```json
{
  "jsonrpc": "2.0",
  "id": 1718409600000,
  "method": "tools/call",
  "params": {
    "name": "run_splunk_search",
    "arguments": {
      "query": "search index=zerodrop sourcetype=zerodrop:telemetry dropId=\"<id>\" earliest=-15m | sort 0 -_time | head 1000",
      "earliest_time": "-15m",
      "latest_time": "now"
    }
  }
}
```

Notes on the fields:

- `id` is `Date.now()` (a fresh integer per call).
- `params.name` is `SPLUNK_MCP_TOOL` (default `run_splunk_search`).
- `params.arguments.query` is the SPL built by `buildSpl()`. The `dropId=...`
  clause is omitted when scanning all drops.
- `earliest_time` / `latest_time` are passed alongside the SPL so servers that
  take a time range as separate arguments honour the window.

The SPL itself (also shown on `/ops` in the "SPL run by agent" panel and in
`dashboards/dropwatch.xml`):

```spl
search index=zerodrop sourcetype=zerodrop:telemetry dropId="<id>" earliest=-15m
| sort 0 -_time | head 1000
```

### Response DropWatch expects

DropWatch reads the MCP result content blocks. It accepts either a `text` block
whose body is a JSON string of rows, **or** a `structuredContent` payload:

```json
{
  "jsonrpc": "2.0",
  "id": 1718409600000,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"_raw\":\"{\\\"event\\\":\\\"oversell_reject\\\",\\\"dropId\\\":\\\"drop-42\\\",\\\"ip\\\":\\\"10.0.0.7\\\",\\\"time\\\":\\\"2026-06-15T10:00:00Z\\\"}\"}]"
      }
    ]
  }
}
```

Unwrapping logic (`searchViaMcp()` -> `rowsToEvents()`):

1. Find the first `content[]` block with `type === "text"`; if absent, use
   `result.structuredContent`; if neither, treat as `[]`.
2. `JSON.parse` the text into an array of result rows.
3. For each row, take `_raw` (or `event`, or the row itself), `JSON.parse` it if
   it is a string, and unwrap an inner `.event` if present.
4. Keep only objects that have both `event` and `dropId` (a valid `DropEvent`).

This matches how the events were written: each HEC payload ships the structured
event, so the search returns it back in `_raw` (see `lib/dropwatch/events.ts`
for the `DropEvent` shape and `lib/splunk.ts` for the HEC writer).

## Going LIVE: runbook for a non-trial Splunk Enterprise

These steps move `/ops` from `telemetry: buffer` to `telemetry: mcp`. They
require a Splunk Enterprise instance (self-managed or a non-trial Cloud stack)
where the search/management surface is reachable — the missing piece on the
Cloud **trial**.

### 1. Install the Splunk MCP Server app

Install the **Splunk MCP Server** app from **Splunkbase** onto the Splunk
instance (or run it as a sidecar that points at that instance), then restart
Splunk so the app's MCP endpoint comes up. The app exposes Splunk search and
admin operations as MCP tools, including the `run_splunk_search` search tool.

Confirm the search tool is advertised:

```bash
curl -sS "$SPLUNK_MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $SPLUNK_MCP_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Look for a tool named `run_splunk_search` (some builds expose it as
`run_oneshot_search` or `search`). Whatever it is called, set `SPLUNK_MCP_TOOL`
to that exact name.

### 2. Create a token (token auth works today)

The Splunk MCP Server resources page confirms that **token-based auth is
supported and working today**; OAuth is in controlled availability. So use a
token now:

- In Splunk: **Settings -> Tokens** (or **Users -> Tokens**), create an
  authentication token for an account that can run searches over the `zerodrop`
  index.
- That token is what you pass as `SPLUNK_MCP_TOKEN`. DropWatch sends it as
  `Authorization: Bearer <token>` on every `tools/call`.

### 3. Point DropWatch at the MCP server

Set these in the DropWatch app environment (`.env.local`, Vercel project env,
or your shell) and restart the app:

```bash
SPLUNK_MCP_URL=https://<splunk-host>:<mcp-port>/mcp   # MCP streamable-HTTP endpoint
SPLUNK_MCP_TOKEN=<token from step 2>
SPLUNK_MCP_TOOL=run_splunk_search                     # or the name from tools/list
SPLUNK_INDEX=zerodrop                                 # only if you changed the index
```

Because `fetchTelemetry()` checks `SPLUNK_MCP_URL` first, simply setting that
variable makes MCP the primary read path. No code change is needed.

### 4. Verify the flip

1. Make sure recent telemetry exists in Splunk (run a mock drop, or let HEC
   ingest real events — see `lib/splunk.ts`).
2. Open `/ops` and click **Re-scan**.
3. The header now reads:

   ```
   telemetry: mcp · LLM: <tier>
   ```

   `telemetry: mcp` is the proof: the agent pulled its data through the MCP
   server's `run_splunk_search` tool. The "SPL run by agent" panel shows the
   exact query that travelled over MCP.

### Troubleshooting

- **Header still says `buffer`** — `SPLUNK_MCP_URL` is unset or the app did not
  restart. Confirm the variable is present in the running process.
- **Header says `rest`** — the MCP call threw and DropWatch fell back to REST.
  Check the server logs for `"[dropwatch] MCP search failed, falling back:"` and
  re-run the `tools/list` curl from step 1 to confirm the endpoint and token.
- **`mcp` but zero events** — the SPL window found nothing, or the tool name is
  wrong so the result envelope did not match. Verify `SPLUNK_MCP_TOOL` against
  `tools/list`, and widen the window or generate fresh telemetry.
- **401 / 403** — the token lacks search capability on the `zerodrop` index, or
  it expired. Reissue per step 2.
