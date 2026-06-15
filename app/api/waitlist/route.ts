import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Waitlist capture. Stores the email in a Cloudflare KV namespace (binding
 * WAITLIST) when running on Workers; no-ops gracefully anywhere the binding is
 * absent (local dev, CI) so it never errors.
 */
export async function POST(req: NextRequest) {
  let email = "";
  try {
    email = String(((await req.json()) as { email?: unknown })?.email ?? "").trim();
  } catch {
    /* empty/invalid body */
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as {
      WAITLIST?: { put: (key: string, value: string) => Promise<void> };
    };
    if (env?.WAITLIST) {
      await env.WAITLIST.put(
        `email:${Date.now()}:${email.toLowerCase()}`,
        JSON.stringify({
          email: email.toLowerCase(),
          at: new Date().toISOString(),
          ua: req.headers.get("user-agent") || "",
          ref: req.headers.get("referer") || "",
        })
      );
    }
  } catch {
    /* no Cloudflare binding in this environment — accept the signup anyway */
  }

  return NextResponse.json({ ok: true });
}
