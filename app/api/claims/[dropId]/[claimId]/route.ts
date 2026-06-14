import { NextRequest, NextResponse } from "next/server";
import { getClaim, getDrop } from "@/lib/drops";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/claims/[dropId]/[claimId]">
) {
  const { dropId, claimId } = await ctx.params;
  const [claim, drop] = await Promise.all([getClaim(dropId, claimId), getDrop(dropId)]);
  if (!claim || !drop) return jsonError(404, "Claim not found.");

  return NextResponse.json({
    claim: {
      claimId: claim.claimId,
      dropId: claim.dropId,
      email: claim.email,
      status: claim.status,
      position: claim.position,
      holdExpiresAt: claim.holdExpiresAt ?? null,
    },
    drop: {
      name: drop.name,
      emoji: drop.emoji,
      slug: drop.slug,
      price: drop.price,
      totalStock: drop.totalStock,
    },
  });
}
