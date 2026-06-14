"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import { money } from "@/lib/format";

interface ClaimData {
  claim: {
    claimId: string;
    dropId: string;
    email: string;
    status: "HELD" | "CONFIRMED" | "EXPIRED" | "WAITLIST";
    position: number;
    holdExpiresAt: number | null;
  };
  drop: { name: string; emoji: string; slug: string; price: number; totalStock: number };
}

export function ClaimStatus({ dropId, claimId }: { dropId: string; claimId: string }) {
  const [data, setData] = useState<ClaimData | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/claims/${dropId}/${claimId}`, { cache: "no-store" });
    if (res.status === 404) {
      setMissing(true);
      return;
    }
    if (res.ok) setData(await res.json());
  }, [dropId, claimId]);

  useEffect(() => {
    const t0 = setTimeout(refresh, 0);
    return () => clearTimeout(t0);
  }, [refresh]);

  async function confirm() {
    setBusy(true);
    try {
      await fetch(`/api/claims/${dropId}/${claimId}/confirm`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="text-center text-zinc-400">
        <div className="text-4xl">🫥</div>
        <p className="mt-3">This claim doesn&apos;t exist (or its hold expired and was cleaned up).</p>
        <Link href="/" className="mt-4 inline-block text-accent hover:underline">
          ← Back to ZeroDrop
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="text-zinc-500">Loading your claim…</div>;
  }

  const { claim, drop } = data;

  return (
    <div className="zd-rise w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
      <div className="text-5xl">{drop.emoji}</div>
      <h1 className="mt-4 text-xl font-bold tracking-tight">{drop.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">{money(drop.price)}</p>

      {claim.status === "HELD" && claim.holdExpiresAt && (
        <>
          <div className="mt-6 rounded-xl border border-amber-900/50 bg-amber-950/30 p-5">
            <div className="font-semibold text-amber-200">
              You got it — claim #{claim.position} of {drop.totalStock}
            </div>
            <p className="mt-1 text-sm text-amber-300/70">
              Your unit is held. Complete checkout before the timer hits zero or it goes back on
              sale automatically.
            </p>
            <div className="mt-4 font-mono text-3xl font-bold tabular-nums text-amber-200">
              <Countdown until={claim.holdExpiresAt * 1000} compact onDone={refresh} />
            </div>
          </div>
          <button
            onClick={confirm}
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Processing…" : `Pay ${money(drop.price)} (demo checkout)`}
          </button>
          <p className="mt-3 text-xs text-zinc-600">
            Demo checkout — no card needed. In production this is a Stripe session.
          </p>
        </>
      )}

      {claim.status === "CONFIRMED" && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6">
          <div className="text-4xl">✅</div>
          <div className="mt-3 text-lg font-semibold text-accent">
            Order confirmed — #{claim.position} of {drop.totalStock}
          </div>
          <p className="mt-1.5 text-sm text-zinc-400">
            A receipt is on its way to <span className="font-mono">{claim.email}</span>. Wear it
            well.
          </p>
        </div>
      )}

      {claim.status === "EXPIRED" && (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-950 p-6">
          <div className="text-4xl">⏳</div>
          <div className="mt-3 text-lg font-semibold text-zinc-300">This hold expired</div>
          <p className="mt-1.5 text-sm text-zinc-500">
            Your unit went back on sale. If stock is still live you can claim again.
          </p>
          <Link
            href={`/d/${drop.slug}`}
            className="mt-4 inline-block rounded-xl border border-zinc-700 px-5 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Back to the drop
          </Link>
        </div>
      )}

      {claim.status === "WAITLIST" && (
        <div className="mt-6 rounded-xl border border-sky-900/60 bg-sky-950/40 p-6">
          <div className="text-4xl">🎫</div>
          <div className="mt-3 text-lg font-semibold text-sky-200">
            Waitlist position #{claim.position}
          </div>
          <p className="mt-1.5 text-sm text-sky-300/70">
            If a hold expires, the next spot is yours. We&apos;ll email{" "}
            <span className="font-mono">{claim.email}</span>.
          </p>
        </div>
      )}
    </div>
  );
}
