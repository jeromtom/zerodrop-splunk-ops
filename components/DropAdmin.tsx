"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StockBar } from "./StockBar";
import { money, timeAgo } from "@/lib/format";

interface Stats {
  drop: {
    id: string;
    slug: string;
    name: string;
    emoji: string;
    description: string;
    price: number;
    totalStock: number;
    claimed: number;
    waitlistCount: number;
    status: string;
    startsAt: number;
  };
  breakdown: { confirmed: number; held: number; expired: number; waitlist: number };
  recent: {
    claimId: string;
    email: string;
    status: string;
    position: number;
    createdAt: number;
  }[];
}

interface SimResult {
  requested: number;
  claimed: number;
  waitlisted: number;
  errors: number;
  durationMs: number;
  oversold: number;
  finalClaimed: number;
  totalStock: number;
}

const STATUS_STYLES: Record<string, string> = {
  HELD: "bg-amber-400/10 text-amber-300",
  CONFIRMED: "bg-accent/10 text-accent",
  EXPIRED: "bg-zinc-700/30 text-zinc-500",
  WAITLIST: "bg-sky-400/10 text-sky-300",
};

export function DropAdmin({ dropId }: { dropId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [simCount, setSimCount] = useState(250);
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const pollFast = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/drops/${dropId}`, { cache: "no-store" });
      if (res.ok) {
        setStats(await res.json());
        setNow(Date.now());
      }
    } catch {
      /* transient poll error — next tick will retry */
    }
  }, [dropId]);

  useEffect(() => {
    const t0 = setTimeout(refresh, 0);
    const t = setInterval(() => refresh(), pollFast.current ? 700 : 1500);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [refresh, simRunning]);

  async function runSimulation() {
    setSimRunning(true);
    setSimResult(null);
    pollFast.current = true;
    try {
      const res = await fetch(`/api/drops/${dropId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: simCount }),
      });
      const data = await res.json();
      if (res.ok) setSimResult(data.result);
    } finally {
      pollFast.current = false;
      setSimRunning(false);
      refresh();
    }
  }

  async function resetDemo() {
    setResetting(true);
    setSimResult(null);
    try {
      await fetch(`/api/drops/${dropId}/reset`, { method: "POST" });
      await refresh();
    } finally {
      setResetting(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/d/${stats?.drop.slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading live stats…
      </div>
    );
  }

  const { drop, breakdown, recent } = stats;
  const claimedCapped = Math.min(drop.claimed, drop.totalStock);
  const left = Math.max(0, drop.totalStock - drop.claimed);
  const soldOut = left === 0;
  const scheduled = drop.startsAt > now;

  return (
    <div className="zd-rise">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{drop.emoji}</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{drop.name}</h1>
            <div className="mt-0.5 flex items-center gap-3 text-sm text-zinc-500">
              <span>{money(drop.price)}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  scheduled
                    ? "bg-sky-400/10 text-sky-300"
                    : soldOut
                      ? "bg-rose-400/10 text-rose-300"
                      : "bg-accent/10 text-accent"
                }`}
              >
                {scheduled ? "SCHEDULED" : soldOut ? "SOLD OUT" : "LIVE"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/d/${drop.slug}`}
            target="_blank"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            View public page ↗
          </Link>
          <button
            onClick={copyLink}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      </div>

      {/* live counters */}
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Claimed", `${claimedCapped} / ${drop.totalStock}`],
          ["Left", left.toLocaleString()],
          ["Waitlist", drop.waitlistCount.toLocaleString()],
          ["Confirmed", breakdown.confirmed.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-xs uppercase tracking-widest text-zinc-500">{label}</div>
            <div className="mt-1.5 font-mono text-3xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <StockBar claimed={claimedCapped} total={drop.totalStock} live={!soldOut && !scheduled} size="lg" />
        <div className="mt-2.5 flex justify-between font-mono text-xs text-zinc-500">
          <span>
            {claimedCapped} claimed · {breakdown.held} on hold · {breakdown.expired} expired
          </span>
          <span>oversells: 0 — guaranteed by DynamoDB</span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* stress test */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">⚡ Stress test this drop</h2>
            <button
              onClick={resetDemo}
              disabled={resetting || simRunning}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 disabled:opacity-40"
            >
              {resetting ? "Resetting…" : "Reset demo"}
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            Fire concurrent buyers at this drop, server-side, against the live database. Every
            attempt races on the same conditional write — watch the bar above. The oversell count
            will be zero. It is always zero.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <select
              value={simCount}
              onChange={(e) => setSimCount(Number(e.target.value))}
              disabled={simRunning}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              {[100, 250, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n} concurrent buyers
                </option>
              ))}
            </select>
            <button
              onClick={runSimulation}
              disabled={simRunning || scheduled}
              className="flex-1 rounded-xl bg-accent py-2.5 font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-50"
            >
              {simRunning ? "Stampede in progress…" : "Unleash the stampede"}
            </button>
          </div>

          {simResult && (
            <div className="zd-rise mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Attempted", simResult.requested.toLocaleString(), ""],
                ["Won stock", simResult.claimed.toLocaleString(), "text-accent"],
                ["Waitlisted", simResult.waitlisted.toLocaleString(), "text-sky-300"],
                [
                  "Oversold",
                  String(simResult.oversold),
                  simResult.oversold === 0 ? "text-accent" : "text-rose-400",
                ],
              ].map(([label, value, cls]) => (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center"
                >
                  <div className={`font-mono text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                    {label}
                  </div>
                </div>
              ))}
              <div className="col-span-2 text-center font-mono text-xs text-zinc-500 sm:col-span-4">
                {simResult.requested} claims settled in {(simResult.durationMs / 1000).toFixed(1)}s
                · final stock {Math.min(simResult.finalClaimed, simResult.totalStock)}/
                {simResult.totalStock}
                {simResult.oversold === 0 && " · zero oversells ✓"}
              </div>
            </div>
          )}
        </div>

        {/* claim feed */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:col-span-2">
          <h2 className="font-semibold">Live claim feed</h2>
          <ul className="mt-4 space-y-2.5">
            {recent.map((c) => (
              <li
                key={c.claimId}
                className="zd-feed-in flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate font-mono text-xs text-zinc-400">{c.email}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600">#{c.position}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      STATUS_STYLES[c.status] ?? "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="w-14 text-right font-mono text-[10px] text-zinc-600">
                    {timeAgo(c.createdAt)}
                  </span>
                </span>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="py-8 text-center text-sm text-zinc-600">
                No claims yet — share the link or run a stress test.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
