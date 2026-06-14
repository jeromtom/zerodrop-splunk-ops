/**
 * Pull recent drop telemetry back OUT of Splunk.
 *
 * Two paths, in priority order:
 *
 *  1. Splunk MCP Server (preferred, qualifies for "Best Use of Splunk MCP
 *     Server"). When SPLUNK_MCP_URL is set, DropWatch issues its SPL through the
 *     MCP `run_splunk_search` tool over the standard MCP JSON-RPC endpoint. See
 *     docs/SPLUNK_MCP.md for the exact tool contract and how to point DropWatch
 *     at a running MCP server.
 *
 *  2. Splunk REST search API (search/jobs/export) — a direct fallback that needs
 *     only SPLUNK_API_URL + token, no MCP server.
 *
 *  3. If neither is configured, callers fall back to the local ring buffer
 *     (lib/dropwatch/sink.ts) so mock mode and local dev work offline.
 *
 * Stdlib `fetch` only — no Splunk SDK.
 */

import type { DropEvent } from "./events";
import { INDEX, SOURCETYPE } from "./events";
import { recent } from "./sink";

const MCP_URL = process.env.SPLUNK_MCP_URL;
const MCP_TOKEN = process.env.SPLUNK_MCP_TOKEN;
const API_URL = process.env.SPLUNK_API_URL; // e.g. https://host:8089
const API_TOKEN = process.env.SPLUNK_API_TOKEN;

export type TelemetrySource = "mcp" | "rest" | "buffer";

/** Build the SPL the agent runs to fetch a window of drop telemetry. */
export function buildSpl(dropId: string | undefined, windowMin: number): string {
  const where = dropId ? ` dropId="${dropId}"` : "";
  return (
    `search index=${INDEX} sourcetype=${SOURCETYPE}${where} ` +
    `earliest=-${windowMin}m | sort 0 -_time | head 1000`
  );
}

export interface FetchResult {
  events: DropEvent[];
  source: TelemetrySource;
  spl: string;
}

export async function fetchTelemetry(
  dropId: string | undefined,
  windowMin = 15
): Promise<FetchResult> {
  const spl = buildSpl(dropId, windowMin);

  if (MCP_URL) {
    try {
      const events = await searchViaMcp(spl);
      return { events, source: "mcp", spl };
    } catch (err) {
      console.warn("[dropwatch] MCP search failed, falling back:", String(err));
    }
  }
  if (API_URL && API_TOKEN) {
    try {
      const events = await searchViaRest(spl);
      return { events, source: "rest", spl };
    } catch (err) {
      console.warn("[dropwatch] REST search failed, falling back:", String(err));
    }
  }
  // Offline / mock / dev: read the local ring buffer.
  const sinceMs = Date.now() - windowMin * 60_000;
  return { events: recent({ dropId, sinceMs, limit: 1000 }), source: "buffer", spl };
}

/**
 * Issue SPL through the Splunk MCP Server via JSON-RPC `tools/call`.
 * The MCP server exposes a `run_splunk_search` (a.k.a. run_oneshot_search) tool
 * that takes a `query` and returns result rows. We unwrap rows -> DropEvents.
 */
async function searchViaMcp(spl: string): Promise<DropEvent[]> {
  const res = await fetch(MCP_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(MCP_TOKEN ? { Authorization: `Bearer ${MCP_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: process.env.SPLUNK_MCP_TOOL ?? "run_splunk_search",
        arguments: { query: spl, earliest_time: "-15m", latest_time: "now" },
      },
    }),
  });
  const json = await res.json();
  // MCP returns content blocks; the search tool packs rows as JSON text.
  const text =
    json?.result?.content?.find((c: { type: string }) => c.type === "text")?.text ??
    json?.result?.structuredContent ??
    "[]";
  const rows = typeof text === "string" ? JSON.parse(text) : text;
  return rowsToEvents(rows);
}

/** Splunk REST one-shot search via the export endpoint (output_mode=json). */
async function searchViaRest(spl: string): Promise<DropEvent[]> {
  const url = `${API_URL!.replace(/\/$/, "")}/services/search/jobs/export`;
  const form = new URLSearchParams({ search: spl, output_mode: "json", earliest_time: "-15m" });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const text = await res.text();
  // export streams newline-delimited JSON objects with a `result` envelope.
  const rows = text
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l).result;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return rowsToEvents(rows);
}

/** Each Splunk row carries our event as a JSON string in `_raw`. */
function rowsToEvents(rows: unknown[]): DropEvent[] {
  const out: DropEvent[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    const raw = row?._raw ?? row?.event ?? row;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const ev = (parsed?.event ?? parsed) as DropEvent;
      if (ev && ev.event && ev.dropId) out.push(ev);
    } catch {
      /* skip unparseable rows */
    }
  }
  return out;
}

export function searchMode(): TelemetrySource {
  if (MCP_URL) return "mcp";
  if (API_URL && API_TOKEN) return "rest";
  return "buffer";
}
