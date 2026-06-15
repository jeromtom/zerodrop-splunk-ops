/**
 * Local Splunk-MCP-contract server for DropWatch demos.
 *
 * Implements the SAME Model Context Protocol JSON-RPC contract that the
 * Splunkbase "Splunk MCP Server" exposes for its search tool
 * (`run_splunk_search`), so DropWatch's MCP *client* path
 * (lib/dropwatch/search.ts -> searchViaMcp) executes end-to-end and /ops shows
 * `telemetry: mcp`.
 *
 * HONEST SCOPE: this is a local stand-in that serves synthetic, Splunk-shaped
 * telemetry (the same planted stampede + oversell-bot stream as mock mode) over
 * the real MCP wire protocol. It exists to exercise + demonstrate the MCP
 * integration without a non-trial Splunk Enterprise. To run against a REAL
 * Splunk + the real Splunk MCP Server, point SPLUNK_MCP_URL there instead — no
 * DropWatch code changes (see docs/SPLUNK_MCP.md "Going LIVE").
 *
 * Run:  npm run mcp:server   (then set SPLUNK_MCP_URL=http://127.0.0.1:7878/mcp)
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";
import { synthesize } from "../lib/dropwatch/synth";
import type { DropEvent } from "../lib/dropwatch/events";

type Json = Record<string, unknown>;

const TOOL = process.env.SPLUNK_MCP_TOOL ?? "run_splunk_search";

function dropIdFromSpl(spl: string): string | undefined {
  const m = /dropId="([^"]+)"/.exec(spl);
  return m?.[1];
}

/**
 * Build Splunk-shaped result rows for a search. Each row mirrors a real Splunk
 * JSON search result: the indexed event lives in `_raw` as a JSON string, which
 * is exactly what `rowsToEvents()` in lib/dropwatch/search.ts parses back.
 */
function searchRows(spl: string): Json[] {
  const dropId = dropIdFromSpl(spl);
  const { events } = synthesize(dropId ? { dropId } : {}); // planted incident, deterministic
  return events
    .slice()
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .map((ev: DropEvent) => ({
      _time: (Date.parse(ev.time) / 1000).toString(),
      _raw: JSON.stringify(ev),
      sourcetype: "zerodrop:telemetry",
      index: "zerodrop",
    }));
}

function rpcResult(id: unknown, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

/** Handle one JSON-RPC message. Returns the response body, or null for notifications. */
function handle(msg: Json): string | null {
  const id = msg.id;
  const method = msg.method as string | undefined;
  const params = (msg.params ?? {}) as Json;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "dropwatch-local-splunk-mcp", version: "0.1.0" },
        capabilities: { tools: {} },
      });
    case "notifications/initialized":
      return null; // notification — no response
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: [
          {
            name: TOOL,
            description:
              "Run a Splunk SPL search and return result rows (Splunk MCP Server search-tool contract).",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "SPL query" },
                earliest_time: { type: "string" },
                latest_time: { type: "string" },
              },
              required: ["query"],
            },
          },
        ],
      });
    case "tools/call": {
      const name = params.name as string | undefined;
      if (name !== TOOL) return rpcError(id, -32601, `Unknown tool: ${name}`);
      const args = (params.arguments ?? {}) as Json;
      const spl = String(args.query ?? "");
      const rows = searchRows(spl);
      console.log(`[mcp] tools/call ${name}  rows=${rows.length}  spl=${spl.slice(0, 90)}…`);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(rows) }],
        structuredContent: { rows },
        isError: false,
      });
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export function startMcpServer(
  port = Number(process.env.MCP_PORT ?? 7878)
): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405).end("POST only");
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let out: string | null;
      try {
        out = handle(JSON.parse(body || "{}") as Json);
      } catch (err) {
        out = rpcError(null, -32700, `Parse error: ${String(err)}`);
      }
      res.writeHead(out ? 200 : 202, { "Content-Type": "application/json" });
      res.end(out ?? "");
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo | null;
      const actual = addr && typeof addr === "object" ? addr.port : port;
      resolve({ server, url: `http://127.0.0.1:${actual}/mcp` });
    });
  });
}

// Run directly (`npm run mcp:server`): start and stay up.
const invokedDirectly = Boolean(argv[1]) && fileURLToPath(import.meta.url) === argv[1];
if (invokedDirectly) {
  startMcpServer().then(({ url }) => {
    console.log(`\n  Local Splunk-MCP-contract server listening:\n    ${url}\n`);
    console.log(`  Point DropWatch at it (then restart the app / re-scan):`);
    console.log(`    SPLUNK_MCP_URL=${url}`);
    console.log(`    SPLUNK_MCP_TOOL=${TOOL}\n`);
    console.log(`  Inspect the advertised tools:`);
    console.log(
      `    curl -sS ${url} -H 'Content-Type: application/json' ` +
        `-d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'\n`
    );
  });
}
