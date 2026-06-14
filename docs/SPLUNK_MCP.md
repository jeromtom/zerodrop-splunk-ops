# DropWatch + the Splunk MCP Server

This documents how DropWatch uses the **Splunk MCP Server** as its primary
channel for reading telemetry back out of Splunk — the integration we are
submitting for the **Best Use of Splunk MCP Server ($1,000)** prize.

## Why MCP

DropWatch is an *agent*. Its monitoring cycle is:

```
pull recent telemetry  ->  summarise  ->  LLM reasons  ->  recommend / act
```

The "pull recent telemetry" step is a tool call. Rather than hard-wiring the
Splunk REST API, DropWatch issues its SPL through the **Splunk MCP Server's
search tool** (`run_splunk_search`). This is the idiomatic agentic pattern: the
agent treats Splunk as a tool surface exposed over the Model Context Protocol,
so the same agent could be dropped into any MCP-aware host (Claude Desktop,
an IDE, an orchestration runtime) and immediately query Splunk.

## Where it lives in the code

- `lib/dropwatch/search.ts` -> `searchViaMcp()` — issues a JSON-RPC
  `tools/call` to the MCP server's search tool and unwraps the result rows into
  `DropEvent`s.
- `lib/dropwatch/agent.ts` -> `scan()` — the agent loop that calls it.
- Priority order: **MCP server → Splunk REST search → local buffer (offline)**.

```ts
// lib/dropwatch/search.ts (excerpt)
fetch(SPLUNK_MCP_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${MCP_TOKEN}` },
  body: JSON.stringify({
    jsonrpc: "2.0", id: Date.now(), method: "tools/call",
    params: {
      name: "run_splunk_search",
      arguments: { query: spl, earliest_time: "-15m", latest_time: "now" },
    },
  }),
});
```

The SPL the agent runs (also visible on the `/ops` dashboard and in
`dashboards/dropwatch.xml`):

```spl
search index=zerodrop sourcetype=zerodrop:telemetry dropId="<id>" earliest=-15m
| sort 0 -_time | head 1000
```

## Running a Splunk MCP Server

The official Splunk MCP Server exposes Splunk search/admin as MCP tools. Once
it is running and pointed at your Splunk instance, set:

```bash
SPLUNK_MCP_URL=http://localhost:8050/mcp     # the MCP HTTP endpoint
SPLUNK_MCP_TOKEN=<token>                       # if the server requires auth
SPLUNK_MCP_TOOL=run_splunk_search              # search tool name (override if different)
```

DropWatch will automatically prefer MCP whenever `SPLUNK_MCP_URL` is set, and
fall back gracefully otherwise. The tool name is configurable because different
MCP server builds expose the search tool under slightly different names
(`run_splunk_search`, `run_oneshot_search`, `search`); set `SPLUNK_MCP_TOOL`
to match the one your server advertises in `tools/list`.

## Verifying

With the MCP server running, open `/ops` and click **Re-scan** — the dashboard
header shows `telemetry: mcp`, confirming the agent pulled its data through the
MCP server. The exact SPL is printed in the "SPL run by agent" panel.
