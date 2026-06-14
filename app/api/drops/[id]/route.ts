import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import {
  countClaimsByStatus,
  getDrop,
  listRecentClaims,
  reconcileHold,
} from "@/lib/drops";
import { toPublicDrop } from "@/lib/types";
import { jsonError, maskEmail } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Live stats poll target.
 * Public callers get the drop counters; the owner also gets the claim
 * breakdown and a (masked) recent-claims feed.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/drops/[id]">
) {
  const { id } = await ctx.params;
  const drop = await getDrop(id);
  if (!drop) return jsonError(404, "Drop not found.");

  const email = await getSessionEmail();
  const isOwner = email === drop.ownerEmail;

  if (!isOwner) {
    return NextResponse.json({ drop: toPublicDrop(drop) });
  }

  const [recentRaw, breakdown] = await Promise.all([
    listRecentClaims(id, 15),
    countClaimsByStatus(id),
  ]);
  // Self-healing: expired holds encountered here are flipped + released.
  const recent = await Promise.all(recentRaw.map((c) => reconcileHold(c)));

  return NextResponse.json({
    drop: toPublicDrop(drop),
    breakdown,
    recent: recent.map((c) => ({
      claimId: c.claimId,
      email: maskEmail(c.email),
      status: c.status,
      position: c.position,
      createdAt: c.createdAt,
    })),
    isOwner: true,
  });
}
