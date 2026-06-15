"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface OpsAction {
  kind: string;
  label: string;
  params?: Record<string, unknown>;
}
interface Finding {
  id: string;
  title: string;
  severity: Severity;
  reasoning: string;
  recommendation: string;
  action?: OpsAction;
  source: string;
}
interface ScanReport {
  dropId?: string;
  dropName?: string;
  generatedAt: string;
  telemetrySource: string;
  llmTier: string;
  llmUsed: boolean;
  spl: string;
  healthScore: number;
  eventCount: number;
  agent?: {
    scans: number;
    llmCalls: number;
    llmErrors: number;
    avgScanMs: number;
    avgLlmLatencyMs: number;
    lastTier: string;
    lastModel: string;
    lastScanMs: number;
    lastLlmLatencyMs: number;
    sinceIso: string;
  };
  findings: Finding[];
  features: {
    peakClaimsPerMin: number;
    stampedeRatio: number;
    oversellRejects: number;
    holdExpiries: number;
    waitlistAdds: number;
    checkouts: number;
  };
}
interface FeedEvent {
  time: string;
  event: string;
  dropId: string;
  ip?: string;
  position?: number;
  buyer?: string;
}
interface AppliedAction {
  id: string;
  at: string;
  findingId: string;
  result: string;
}

const SEV: Record<Severity, { ring: string; chip: string; label: string }> = {
  critical: { ring: "border-rose-500/60", chip: "bg-rose-500/15 text-rose-300", label: "CRITICAL" },
  high: { ring: "border-orange-500/50", chip: "bg-orange-500/15 text-orange-300", label: "HIGH" },
  medium: { ring: "border-amber-500/40", chip: "bg-amber-500/15 text-amber-300", label: "MEDIUM" },
  low: { ring: "border-sky-500/40", chip: "bg-sky-500/15 text-sky-300", label: "LOW" },
  info: { ring: "border-emerald-500/40", chip: "bg-emerald-500/15 text-emerald-300", label: "INFO" },
};

const EVENT_COLOR: Record<string, string> = {
  claim: "text-emerald-400",
  hold_create: "text-sky-400",
  hold_expiry: "text-amber-400",
  oversell_reject: "text-rose-400",
  waitlist_add: "text-violet-400",
  checkout: "text-emerald-300",
  sim_summary: "text-zinc-400",
};

export function OpsDashboard() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [actions, setActions] = useState<AppliedAction[]>([]);
  const [source, setSource] = useState("buffer");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Record<string, string>>({});

  const loadFeed = useCallback(async () => {
    const res = await fetch("/api/ops/feed?limit=40", { cache: "no-store" });
    const j = await res.json();
    setFeed(j.events ?? []);
    setActions(j.actions ?? []);
    setSource(j.source ?? "buffer");
  }, []);

  const runScan = useCallback(async () => {
    const res = await fetch("/api/ops/scan", { cache: "no-store" });
    setReport(await res.json());
  }, []);

  const seedAndScan = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/ops/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withIncident: true }),
      });
      await loadFeed();
      await runScan();
    } finally {
      setBusy(false);
    }
  }, [loadFeed, runScan]);

  const apply = useCallback(
    async (f: Finding) => {
      if (!f.action) return;
      const res = await fetch("/api/ops/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingId: f.id, action: f.action }),
      });
      const j = await res.json();
      setApplied((p) => ({ ...p, [f.id]: j.applied?.result ?? "Applied." }));
      loadFeed();
    },
    [loadFeed]
  );

  useEffect(() => {
    loadFeed();
    runScan();
    const t = setInterval(loadFeed, 3000);
    return () => clearInterval(t);
  }, [loadFeed, runScan]);

  const score = report?.healthScore ?? 100;
  const scoreColor = score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="flex flex-1 flex-col">
      {/* nav */}
      <header className="border-b border-zinc-800 bg-zinc-950/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight">DropWatch</span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              agentic ops · Splunk
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <span className="font-mono text-xs">
              telemetry: <b className="text-zinc-200">{report?.telemetrySource ?? source}</b> · LLM:{" "}
              <b className="text-zinc-200">{report?.llmTier ?? "—"}</b>
            </span>
            <Link href="/dashboard" className="hover:text-zinc-100">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Drop health</h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              If it lands in Splunk, the agent reads it: DropWatch scores drop health, finds the
              anomaly, and recommends the ops action you apply in one click.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={seedAndScan}
              disabled={busy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Running…" : "Run mock drop"}
            </button>
            <button
              onClick={runScan}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200"
            >
              Re-scan
            </button>
          </div>
        </div>

        {/* score + feature strip */}
        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 lg:row-span-2">
            <div className="text-xs uppercase tracking-widest text-zinc-500">Drop-health score</div>
            <div className={`mt-2 font-mono text-6xl font-bold tabular-nums ${scoreColor}`}>{score}</div>
            <div className="mt-1 text-xs text-zinc-500">/ 100</div>
            <div className="mt-4 text-xs text-zinc-400">
              {report?.dropName ?? "—"}
              <br />
              {report?.eventCount ?? 0} events · {report?.findings.length ?? 0} findings
            </div>
          </div>
          {report &&
            [
              ["Peak claims/min", report.features.peakClaimsPerMin],
              ["Stampede ratio", `${report.features.stampedeRatio}x`],
              ["Oversell rejects", report.features.oversellRejects],
              ["Hold expiries", report.features.holdExpiries],
              ["Waitlist adds", report.features.waitlistAdds],
              ["Checkouts", report.features.checkouts],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs uppercase tracking-widest text-zinc-500">{label}</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">{String(val)}</div>
              </div>
            ))}
        </div>

        {/* AI agent self-observability: DropWatch watching its own agent */}
        {report?.agent && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                Agent runtime{" "}
                <span className="font-mono text-[10px] normal-case text-zinc-600">
                  self-observability → Splunk (sourcetype dropwatch:agent)
                </span>
              </h2>
              <span className="font-mono text-xs text-zinc-500">
                {report.agent.scans} scans this session
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["LLM tier", report.agent.lastTier],
                ["model", report.agent.lastModel],
                ["LLM latency", `${report.agent.lastLlmLatencyMs} ms`],
                ["scan time", `${report.agent.lastScanMs} ms`],
                ["avg scan", `${report.agent.avgScanMs} ms`],
                ["LLM fallbacks", `${report.agent.llmErrors}/${report.agent.scans}`],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
                  <div
                    className="mt-1 truncate font-mono text-sm font-semibold text-zinc-200"
                    title={String(val)}
                  >
                    {String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* findings */}
          <section className="lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Agent findings
            </h2>
            <div className="mt-3 space-y-3">
              {(report?.findings ?? []).map((f) => {
                const s = SEV[f.severity];
                return (
                  <div key={f.id} className={`rounded-2xl border bg-zinc-900/40 p-5 ${s.ring}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{f.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.chip}`}>
                        {s.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{f.reasoning}</p>
                    <p className="mt-2 text-sm text-accent">→ {f.recommendation}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-xs text-zinc-500">source: {f.source}</span>
                      {f.action && f.action.kind !== "none" && !applied[f.id] && (
                        <button
                          onClick={() => apply(f)}
                          className="shrink-0 whitespace-nowrap rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-black"
                        >
                          {f.action.label}
                        </button>
                      )}
                      {applied[f.id] && (
                        <span className="text-xs font-medium text-emerald-400">
                          ✓ {applied[f.id]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!report && <p className="text-sm text-zinc-500">Loading…</p>}
              {report && report.findings.length === 0 && (
                <p className="text-sm text-zinc-500">No telemetry yet. Click “Run mock drop”.</p>
              )}
            </div>

            {report?.spl && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-3">
                <div className="text-xs uppercase tracking-widest text-zinc-600">SPL run by agent</div>
                <code className="mt-1 block break-all font-mono text-xs text-zinc-400">{report.spl}</code>
              </div>
            )}

            {actions.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Applied actions
                </h2>
                <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                  {actions.map((a) => (
                    <li key={a.id} className="font-mono text-xs">
                      <span className="text-emerald-400">✓</span> {a.result}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* live feed */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Live telemetry{" "}
              <span className="font-mono text-[10px] text-zinc-600">via {source}</span>
            </h2>
            <div className="mt-3 h-[520px] overflow-y-auto rounded-2xl border border-zinc-800 bg-black/40 p-3 font-mono text-xs">
              {feed.length === 0 && <p className="text-zinc-600">No events yet.</p>}
              {feed.map((e, i) => (
                <div key={i} className="flex gap-2 border-b border-zinc-900/80 py-1">
                  <span className="text-zinc-600">{e.time.slice(11, 19)}</span>
                  <span className={`${EVENT_COLOR[e.event] ?? "text-zinc-300"} w-32 shrink-0`}>
                    {e.event}
                  </span>
                  <span className="truncate text-zinc-500">
                    {e.ip ?? ""} {e.position ? `#${e.position}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
