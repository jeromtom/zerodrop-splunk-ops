/**
 * Telemetry sink — the single choke point every hot path calls.
 *
 * Responsibilities:
 *  1. Ship the event to Splunk via HEC (lib/splunk.ts) — no-ops without env.
 *  2. Keep a bounded in-memory ring buffer so the /ops dashboard and the
 *     DropWatch agent can read "recent telemetry" with zero Splunk dependency
 *     (this is what powers MOCK MODE and local dev). In a real deployment the
 *     agent reads the same shape back out of Splunk via SPL (see search.ts).
 *
 * The ring buffer is process-local. That's fine: it's a demo/dev convenience and
 * a hot cache. Splunk remains the system of record.
 */

import { emitEvent, emitMetric, hecConfigured } from "../splunk";
import type { DropEvent, DropEventType } from "./events";

const MAX = Number(process.env.DROPWATCH_BUFFER ?? 5000);

const g = globalThis as unknown as { __dropwatchBuf?: DropEvent[] };
const buffer: DropEvent[] = (g.__dropwatchBuf ??= []);

/** Map each event type to a metric so dashboards get rate panels for free. */
const METRIC_FOR: Record<DropEventType, string> = {
  claim: "claims",
  hold_create: "holds_created",
  hold_expiry: "holds_expired",
  oversell_reject: "oversell_rejects",
  waitlist_add: "waitlist_adds",
  checkout: "checkouts",
  sim_summary: "sim_runs",
};

export async function record(ev: DropEvent): Promise<void> {
  buffer.push(ev);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
  // Fire-and-forget to Splunk; telemetry must never break the hot path.
  void emitEvent(ev).catch(() => {});
  void emitMetric(METRIC_FOR[ev.event], 1, { dropId: ev.dropId }).catch(() => {});
}

/** Synchronous convenience for the synthetic stream (already-built events). */
export function recordSync(ev: DropEvent): void {
  buffer.push(ev);
  if (buffer.length > MAX) buffer.splice(0, buffer.length - MAX);
}

export interface RecentQuery {
  dropId?: string;
  /** Only events at or after this epoch-ms. */
  sinceMs?: number;
  types?: DropEventType[];
  limit?: number;
}

/** Read recent telemetry from the local ring buffer (mock / dev fast path). */
export function recent(q: RecentQuery = {}): DropEvent[] {
  let out = buffer;
  if (q.dropId) out = out.filter((e) => e.dropId === q.dropId);
  if (q.sinceMs) out = out.filter((e) => Date.parse(e.time) >= q.sinceMs!);
  if (q.types) out = out.filter((e) => q.types!.includes(e.event));
  out = out.slice(-(q.limit ?? 500));
  return out;
}

export function bufferSize(): number {
  return buffer.length;
}

export function clearBuffer(): void {
  buffer.length = 0;
}

/** Seed the buffer directly (used by mock-mode synthesizer + tests). */
export function seedBuffer(events: DropEvent[]): void {
  for (const e of events) recordSync(e);
}

export function source(): "splunk" | "buffer" {
  return hecConfigured() ? "splunk" : "buffer";
}
