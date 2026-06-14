import { NextRequest, NextResponse } from "next/server";
import { synthesize } from "@/lib/dropwatch/synth";
import { clearBuffer, seedBuffer } from "@/lib/dropwatch/sink";

export const dynamic = "force-dynamic";

/**
 * MOCK MODE entry point for the dashboard: synthesize a realistic flash-drop
 * telemetry stream (with planted stampede + oversell-bot incidents) and load it
 * into the local buffer. Lets judges demo the full /ops experience with zero
 * Splunk account. Also fired by the "Run mock drop" button on /ops.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const withIncident = body?.withIncident ?? true;
  const stream = synthesize({ withIncident });
  if (body?.reset !== false) clearBuffer();
  seedBuffer(stream.events);
  return NextResponse.json({
    seeded: stream.events.length,
    dropId: stream.dropId,
    dropName: stream.dropName,
  });
}
