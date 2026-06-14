"use client";

export function StockBar({
  claimed,
  total,
  live = false,
  size = "md",
}: {
  claimed: number;
  total: number;
  /** Animated stripes while a drop is actively selling. */
  live?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const pct = total > 0 ? Math.min(100, (claimed / total) * 100) : 0;
  const soldOut = claimed >= total;
  const height = size === "lg" ? "h-4" : size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-zinc-800/80 ${height}`}
      role="progressbar"
      aria-valuenow={claimed}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className={`${height} rounded-full transition-[width] duration-500 ease-out ${
          soldOut ? "bg-rose-400" : "bg-accent"
        } ${live && !soldOut ? "zd-stripes" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
