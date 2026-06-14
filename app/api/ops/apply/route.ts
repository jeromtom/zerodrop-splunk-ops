import { NextRequest, NextResponse } from "next/server";
import { applyAction } from "@/lib/dropwatch/actions";
import { jsonError } from "@/lib/api";
import type { OpsAction } from "@/lib/dropwatch/analyze";

export const dynamic = "force-dynamic";

/** Apply a remediation recommended by the DropWatch agent. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const findingId = String(body?.findingId ?? "");
  const action = body?.action as OpsAction | undefined;
  if (!findingId || !action?.kind) return jsonError(400, "findingId and action are required.");
  const applied = applyAction(findingId, action);
  return NextResponse.json({ applied });
}
