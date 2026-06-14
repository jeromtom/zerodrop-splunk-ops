import { NextRequest, NextResponse } from "next/server";
import { confirmClaim } from "@/lib/drops";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Mock checkout. A conditional HELD->CONFIRMED flip: succeeds only while the
 * hold is alive, so an expired hold can never be paid for.
 * (Real payments would wrap this same write in a Stripe webhook.)
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/claims/[dropId]/[claimId]/confirm">
) {
  const { dropId, claimId } = await ctx.params;
  const { ok, claim } = await confirmClaim(dropId, claimId);
  if (!claim) return jsonError(404, "Claim not found.");
  if (!ok) {
    return NextResponse.json(
      { ok: false, status: claim.status, error: "This hold has expired." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, status: claim.status });
}
