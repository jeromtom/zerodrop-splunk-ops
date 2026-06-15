/**
 * DropWatch telemetry taxonomy.
 *
 * Every hot path in ZeroDrop emits one of these structured events. They are
 * shipped to Splunk via HEC (see lib/splunk.ts) and later pulled back out by
 * the DropWatch agent (see lib/dropwatch/agent.ts) to reason about drop health.
 *
 * Keep this list in sync with dashboards/dropwatch.xml.
 */

export type DropEventType =
  | "claim" // a buyer won a unit (HELD)
  | "hold_create" // hold opened (same moment as claim, emitted as a metric too)
  | "hold_expiry" // a HELD claim auto-released back to stock
  | "oversell_reject" // a claim attempt hit the conditional guard and was refused
  | "waitlist_add" // sold out -> buyer got an atomic waitlist position
  | "checkout" // a HELD claim was confirmed (revenue)
  | "sim_summary"; // a load-simulation run completed

export interface DropEvent {
  /** ISO-8601; Splunk uses this as _time. */
  time: string;
  event: DropEventType;
  dropId: string;
  /** Denormalised for easy SPL grouping; optional in synthetic streams. */
  dropName?: string;
  /** Hashed/masked buyer identity — never raw PII in telemetry. */
  buyer?: string;
  /** Source IP (or synthetic IP cluster id in mock mode). */
  ip?: string;
  /** Claim/waitlist position when relevant. */
  position?: number;
  /** Latency of the underlying DynamoDB write in ms. */
  latencyMs?: number;
  /** Free-form, event-specific extras. */
  meta?: Record<string, unknown>;
}

/** Splunk sourcetype + index used across HEC payloads and SPL searches. */
export const SOURCETYPE = "zerodrop:telemetry";
export const METRIC_SOURCETYPE = "zerodrop:metrics";
/** The agent's OWN telemetry (AI agent self-observability). Distinct sourcetype
 *  so you can watch DropWatch's reasoning loop the same way it watches the app. */
export const AGENT_SOURCETYPE = "dropwatch:agent";
export const INDEX = process.env.SPLUNK_INDEX ?? "zerodrop";

let _seq = 0;
/** Stable-ish buyer mask for telemetry (no raw email leaves the app). */
export function maskBuyer(email: string): string {
  const [user] = email.split("@");
  if (!user) return "anon";
  return `${user.slice(0, 1)}***${user.slice(-1)}`;
}

export function newEvent(
  event: DropEventType,
  dropId: string,
  extra: Partial<DropEvent> = {}
): DropEvent {
  _seq++;
  return {
    time: new Date().toISOString(),
    event,
    dropId,
    ...extra,
  };
}
