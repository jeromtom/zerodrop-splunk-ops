import { NextRequest, NextResponse } from "next/server";
import { scan } from "@/lib/dropwatch/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run one DropWatch agent cycle: pull recent telemetry from Splunk (MCP/REST)
 * or the local buffer, summarise, reason with the LLM (Hosted Models -> AIML ->
 * rules), score health, and return severity-ranked findings.
 */
export async function GET(req: NextRequest) {
  const dropId = req.nextUrl.searchParams.get("dropId") ?? undefined;
  const windowMin = Number(req.nextUrl.searchParams.get("windowMin") ?? 15);
  // Remediations the operator has applied this session (recovery-loop hint, so
  // it works even when apply + scan land on different serverless isolates).
  const appliedKinds = (req.nextUrl.searchParams.get("applied") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const report = await scan({ dropId, windowMin, origin: req.nextUrl.origin, appliedKinds });
  return NextResponse.json(report);
}
