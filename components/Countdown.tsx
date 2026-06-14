"use client";

import { useEffect, useState } from "react";
import { clockParts } from "@/lib/format";

export function Countdown({
  until,
  onDone,
  compact = false,
}: {
  /** Epoch ms. */
  until: number;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = until - now;
  const { d, h, m, s, total } = clockParts(remaining);

  useEffect(() => {
    if (total === 0 && onDone) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total === 0]);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (compact) {
    return (
      <span className="font-mono tabular-nums">
        {d > 0 ? `${d}d ` : ""}
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    );
  }

  const cells = [
    ...(d > 0 ? [[d, "days"] as const] : []),
    [h, "hrs"] as const,
    [m, "min"] as const,
    [s, "sec"] as const,
  ];

  return (
    <div className="flex items-center gap-2">
      {cells.map(([value, label]) => (
        <div
          key={label}
          className="min-w-14 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-center"
        >
          <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {pad(value)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
        </div>
      ))}
    </div>
  );
}
