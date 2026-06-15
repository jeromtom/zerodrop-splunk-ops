import { NextRequest, NextResponse } from "next/server";
import { synthesize } from "@/lib/dropwatch/synth";

export const dynamic = "force-dynamic";

/**
 * Self-hosted Splunk-MCP-contract endpoint.
 *
 * Implements the same Model Context Protocol JSON-RPC contract as the Splunkbase
 * Splunk MCP Server's search tool (`run_splunk_search`), serving Splunk-shaped
 * synthetic telemetry. Set `SPLUNK_MCP_URL` to this route's public URL and the
 * agent's pull path (lib/dropwatch/search.ts -> searchViaMcp) runs over real MCP
 * JSON-RPC against a public endpoint — so a deployed `/ops` shows `telemetry: mcp`
 * without depending on a local process or a non-trial Splunk Enterprise.
 *
 * Honest scope: a self-hosted stand-in speaking the real protocol over synthetic
 * data. Point SPLUNK_MCP_URL at a real Splunk MCP Server to go fully live, no
 * code change (docs/SPLUNK_MCP.md).
 */

const TOOL = process.env.SPLUNK_MCP_TOOL ?? "run_splunk_search";

function dropIdFromSpl(spl: string): string | undefined {
  return /dropId="([^"]+)"/.exec(spl)?.[1];
}

function searchRows(spl: string) {
  const dropId = dropIdFromSpl(spl);
  const { events } = synthesize(dropId ? { dropId } : {});
  return events
    .slice()
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .map((ev) => ({
      _time: (Date.parse(ev.time) / 1000).toString(),
      _raw: JSON.stringify(ev),
      sourcetype: "zerodrop:telemetry",
      index: "zerodrop",
    }));
}

const ok = (id: unknown, result: unknown) =>
  NextResponse.json({ jsonrpc: "2.0", id, result });
const err = (id: unknown, code: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });

export async function POST(req: NextRequest) {
  const msg = (await req.json().catch(() => ({}))) as {
    id?: unknown;
    method?: string;
    params?: { name?: string; arguments?: { query?: string } };
  };
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "dropwatch-mcp", version: "0.1.0" },
        capabilities: { tools: {} },
      });
    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
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
      if (params?.name !== TOOL) return err(id, -32601, `Unknown tool: ${params?.name}`);
      const spl = String(params?.arguments?.query ?? "");
      const rows = searchRows(spl);
      return ok(id, {
        content: [{ type: "text", text: JSON.stringify(rows) }],
        structuredContent: { rows },
        isError: false,
      });
    }
    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

/** Health/identity probe (handy for "is the MCP endpoint up" checks). */
export async function GET() {
  return NextResponse.json({ ok: true, server: "dropwatch-mcp", tool: TOOL });
}
