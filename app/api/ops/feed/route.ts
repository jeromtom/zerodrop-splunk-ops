import { NextRequest, NextResponse } from "next/server";
import { recent, source } from "@/lib/dropwatch/sink";
import { recentActions } from "@/lib/dropwatch/actions";

export const dynamic = "force-dynamic";

/** Live telemetry feed for the /ops dashboard (newest first) + applied actions. */
export async function GET(req: NextRequest) {
  const dropId = req.nextUrl.searchParams.get("dropId") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 60);
  const events = recent({ dropId, limit }).reverse();
  return NextResponse.json({
    source: source(),
    events,
    actions: recentActions(),
  });
}
