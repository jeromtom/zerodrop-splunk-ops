import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { createDrop, listDropsByOwner } from "@/lib/drops";
import { jsonError } from "@/lib/api";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return jsonError(401, "Not signed in.");
  const drops = await listDropsByOwner(email);
  return NextResponse.json({ drops });
}

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return jsonError(401, "Not signed in.");

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const emoji = String(body?.emoji ?? "🔥").slice(0, 8);
  const price = Math.round(Number(body?.price ?? 0)); // cents
  const totalStock = Math.round(Number(body?.totalStock ?? 0));
  const startsInMinutes = Number(body?.startsInMinutes ?? 0);

  if (!name || name.length > 80) return jsonError(400, "Drop name is required (max 80 chars).");
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000)
    return jsonError(400, "Price must be between $0 and $100,000.");
  if (!Number.isFinite(totalStock) || totalStock < 1 || totalStock > 1_000_000)
    return jsonError(400, "Stock must be between 1 and 1,000,000 units.");
  if (!Number.isFinite(startsInMinutes) || startsInMinutes < 0 || startsInMinutes > 60 * 24 * 30)
    return jsonError(400, "Start time must be within the next 30 days.");

  const drop = await createDrop({
    name,
    description: description.slice(0, 500),
    emoji,
    price,
    totalStock,
    startsAt: Date.now() + startsInMinutes * 60_000,
    ownerEmail: email,
  });
  return NextResponse.json({ drop }, { status: 201 });
}
