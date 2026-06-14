import { NextRequest, NextResponse } from "next/server";
import { claimDrop } from "@/lib/drops";
import { EMAIL_RE, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * The hot path. Every request resolves to ONE conditional UpdateItem against
 * DynamoDB — no reads, no locks — so this endpoint is safe at any concurrency.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/drops/[id]/claim">
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return jsonError(400, "A valid email is required.");

  const result = await claimDrop(id, email);

  switch (result.outcome) {
    case "held":
    case "waitlisted":
      return NextResponse.json({
        outcome: result.outcome,
        claimId: result.claim!.claimId,
        position: result.claim!.position,
        holdExpiresAt: result.claim!.holdExpiresAt ?? null,
      });
    case "not_started":
      return jsonError(409, "This drop hasn't started yet.");
    case "ended":
      return jsonError(410, "This drop has ended.");
    default:
      return jsonError(404, "Drop not found.");
  }
}
