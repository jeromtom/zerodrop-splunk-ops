"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) {
        setMsg({ text: "You're on the list. We'll be in touch.", ok: true });
        form.reset();
      } else {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setMsg({ text: j.error || "Something went wrong. Try again.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error. Try again.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <span className="pr">&gt;</span>
        <input type="email" name="email" required placeholder="you@brand.com" autoComplete="email" />
        <button className="wlbtn" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Notify me"}
        </button>
      </form>
      <div className={`msg ${msg ? (msg.ok ? "ok" : "err") : ""}`}>{msg?.text ?? ""}</div>
    </>
  );
}
