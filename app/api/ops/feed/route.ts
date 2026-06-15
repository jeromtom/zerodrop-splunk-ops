import { NextRequest, NextResponse } from "next/server";
import { fetchTelemetry } from "@/lib/dropwatch/search";
import { recentActions } from "@/lib/dropwatch/actions";

export const dynamic = "force-dynamic";

/**
 * Live telemetry feed for the /ops dashboard (newest first) + applied actions.
 *
 * Reads through the SAME pull path the agent uses (MCP -> REST -> local buffer)
 * so the feed, its `source` label, and the agent's findings stay coherent: when
 * SPLUNK_MCP_URL is set the feed shows the events that actually arrived over the
 * Splunk MCP Server, not a separate local copy.
 */
export async function GET(req: NextRequest) {
  const dropId = req.nextUrl.searchParams.get("dropId") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  const windowMin = Number(req.nextUrl.searchParams.get("windowMin") ?? 60);
  const { events, source } = await fetchTelemetry(dropId, windowMin, req.nextUrl.origin);
  const newestFirst = events
    .slice()
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, limit);
  return NextResponse.json({
    source,
    events: newestFirst,
    actions: recentActions(),
  });
}
