import { NextResponse } from "next/server";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** m***a@gmail.com — buyer privacy in the public live feed. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "anonymous";
  const visible = user.length <= 2 ? user[0] : `${user[0]}***${user[user.length - 1]}`;
  return `${visible}@${domain}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
