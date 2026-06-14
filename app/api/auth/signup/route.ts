import { NextRequest, NextResponse } from "next/server";
import { createUser, sessionCookie } from "@/lib/auth";
import { EMAIL_RE, jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name || name.length > 64) return jsonError(400, "Brand name is required.");
  if (!EMAIL_RE.test(email)) return jsonError(400, "A valid email is required.");
  if (password.length < 8) return jsonError(400, "Password must be at least 8 characters.");

  try {
    const user = await createUser(email, name, password);
    const res = NextResponse.json({ ok: true, name: user.name, email: user.email });
    res.cookies.set(sessionCookie(user.email));
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      return jsonError(409, "An account with that email already exists.");
    }
    throw err;
  }
}
