"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import { StockBar } from "./StockBar";
import { money } from "@/lib/format";
import type { DropStats } from "@/lib/types";

type PublicDrop = DropStats & { description: string };

export function DropPublic({
  initial,
  serverNow,
}: {
  initial: PublicDrop;
  serverNow: number;
}) {
  const router = useRouter();
  const [drop, setDrop] = useState(initial);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState<number | null>(null);
  const [now, setNow] = useState(0); // 0 until mounted; ticks every second after

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/drops/${initial.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDrop(data.drop);
      }
    } catch {
      /* retry next tick */
    }
  }, [initial.id]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(refresh, 2000);
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      clearTimeout(t0);
    };
  }, [refresh]);

  // Before the first client tick, use the server clock (avoids hydration
  // mismatch right at the go-live boundary).
  const scheduled = drop.startsAt > (now || serverNow);
  const left = Math.max(0, drop.totalStock - drop.claimed);
  const soldOut = !scheduled && left === 0;

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drops/${drop.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.outcome === "held") {
        router.push(`/claim/${drop.id}/${data.claimId}`);
        return;
      }
      setWaitlisted(data.position);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="zd-rise">
      {/* product header */}
      <div className="mt-6 text-center">
        <div className="text-7xl">{drop.emoji}</div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">{drop.name}</h1>
        {drop.description && (
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-zinc-400">{drop.description}</p>
        )}
        <div className="mt-5 font-mono text-2xl font-bold text-accent">{money(drop.price)}</div>
      </div>

      {/* state panel */}
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-7">
        {scheduled ? (
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-zinc-500">Drops in</div>
            <div className="mt-4 flex justify-center">
              <Countdown until={drop.startsAt} onDone={refresh} />
            </div>
            <p className="mt-5 text-sm text-zinc-500">
              {drop.totalStock.toLocaleString()} units. When they&apos;re gone, they&apos;re gone.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                <span className="zd-live-dot size-1.5 rounded-full bg-accent" />
                {soldOut ? "SOLD OUT" : "LIVE NOW"}
              </span>
              <span className="font-mono text-zinc-400">
                {soldOut ? `${drop.waitlistCount} on the waitlist` : `${left} of ${drop.totalStock} left`}
              </span>
            </div>
            <div className="mt-4">
              <StockBar claimed={drop.claimed} total={drop.totalStock} live={!soldOut} size="lg" />
            </div>

            {waitlisted !== null ? (
              <div className="mt-6 rounded-xl border border-sky-900/60 bg-sky-950/40 p-5 text-center">
                <div className="text-2xl">🎫</div>
                <div className="mt-2 font-semibold text-sky-200">
                  You&apos;re #{waitlisted} on the waitlist
                </div>
                <p className="mt-1 text-sm text-sky-300/70">
                  If a hold expires, the next spot is yours. We&apos;ll email {email}.
                </p>
              </div>
            ) : (
              <form onSubmit={claim} className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className={`rounded-xl px-6 py-3 font-semibold transition disabled:opacity-50 ${
                      soldOut
                        ? "border border-sky-700 text-sky-300 hover:border-sky-500"
                        : "bg-accent text-zinc-950 hover:brightness-110"
                    }`}
                  >
                    {busy ? "Claiming…" : soldOut ? "Join waitlist" : "Claim yours"}
                  </button>
                </div>
                {error && (
                  <p className="mt-3 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                    {error}
                  </p>
                )}
                <p className="mt-3 text-center text-xs text-zinc-600">
                  {soldOut
                    ? "Waitlist positions are atomic — first come, first served, no duplicates."
                    : "Winning a claim holds your unit for 10 minutes while you check out."}
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
