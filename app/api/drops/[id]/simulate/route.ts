import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { getDrop, simulateBuyers } from "@/lib/drops";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Demo stress test: fires N concurrent claim attempts at the drop, server-side.
 * Proves on camera that DynamoDB conditional writes never oversell.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/drops/[id]/simulate">
) {
  const email = await getSessionEmail();
  if (!email) return jsonError(401, "Not signed in.");

  const { id } = await ctx.params;
  const drop = await getDrop(id);
  if (!drop) return jsonError(404, "Drop not found.");
  if (drop.ownerEmail !== email) return jsonError(403, "Not your drop.");

  const body = await req.json().catch(() => null);
  const count = Math.round(Number(body?.count ?? 200));
  if (!Number.isFinite(count) || count < 1 || count > 1000)
    return jsonError(400, "Buyer count must be between 1 and 1000.");

  const result = await simulateBuyers(id, count);
  return NextResponse.json({ result });
}
