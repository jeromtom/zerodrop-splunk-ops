import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { getDrop, resetDrop } from "@/lib/drops";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Demo utility: wipe claims + reset counters so a drop can be re-run. */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/drops/[id]/reset">
) {
  const email = await getSessionEmail();
  if (!email) return jsonError(401, "Not signed in.");

  const { id } = await ctx.params;
  const drop = await getDrop(id);
  if (!drop) return jsonError(404, "Drop not found.");
  if (drop.ownerEmail !== email) return jsonError(403, "Not your drop.");

  const deleted = await resetDrop(id);
  return NextResponse.json({ ok: true, deleted });
}
