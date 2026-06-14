import { NextRequest, NextResponse } from "next/server";
import { getUser, sessionCookie, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return jsonError(400, "Email and password are required.");

  const user = await getUser(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonError(401, "Invalid email or password.");
  }

  const res = NextResponse.json({ ok: true, name: user.name, email: user.email });
  res.cookies.set(sessionCookie(user.email));
  return res;
}
