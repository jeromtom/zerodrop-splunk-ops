/**
 * Splunk HTTP Event Collector (HEC) client.
 *
 * Zero heavy dependencies: this uses Node's built-in `fetch` only. When no
 * SPLUNK_HEC_URL / SPLUNK_HEC_TOKEN is configured (e.g. local dev, mock mode,
 * CI), every call becomes a cheap no-op that optionally console-logs — so the
 * app and the load simulator run identically with or without a Splunk account.
 *
 * Env:
 *   SPLUNK_HEC_URL    e.g. https://<host>:8088/services/collector
 *   SPLUNK_HEC_TOKEN  the HEC token (Bearer-style: "Authorization: Splunk <tok>")
 *   SPLUNK_INDEX      target index (default "zerodrop")
 *   SPLUNK_HEC_DEBUG  set to "1" to console.log events even when no HEC is set
 */

import {
  type DropEvent,
  INDEX,
  METRIC_SOURCETYPE,
  SOURCETYPE,
} from "./dropwatch/events";

const HEC_URL = process.env.SPLUNK_HEC_URL;
const HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN;
const DEBUG = process.env.SPLUNK_HEC_DEBUG === "1";
// Splunk Cloud trials often use self-signed certs; allow opt-out of TLS verify.
const INSECURE = process.env.SPLUNK_HEC_INSECURE === "1";

export function hecConfigured(): boolean {
  return Boolean(HEC_URL && HEC_TOKEN);
}

export interface HecResult {
  ok: boolean;
  /** "live" = posted to Splunk, "noop" = no HEC configured. */
  mode: "live" | "noop";
  status?: number;
  error?: string;
}

/**
 * Ship a single structured telemetry event to Splunk as an `event` payload.
 * Fire-and-forget friendly: never throws — telemetry must not break the hot path.
 */
export async function emitEvent(ev: DropEvent): Promise<HecResult> {
  return post({
    time: Date.parse(ev.time) / 1000,
    host: "zerodrop",
    source: "dropwatch",
    sourcetype: SOURCETYPE,
    index: INDEX,
    event: ev,
  });
}

/**
 * Ship a metric data point (Splunk metrics index style). Used for counters like
 * claim rate, oversell-reject rate, hold-expiry rate.
 */
export async function emitMetric(
  name: string,
  value: number,
  dimensions: Record<string, string | number> = {}
): Promise<HecResult> {
  return post({
    time: Date.now() / 1000,
    host: "zerodrop",
    source: "dropwatch",
    sourcetype: METRIC_SOURCETYPE,
    index: process.env.SPLUNK_METRICS_INDEX ?? "zerodrop_metrics",
    fields: { metric_name: `zerodrop.${name}`, _value: value, ...dimensions },
    event: "metric",
  });
}

/** Batch helper: events are newline-delimited JSON in one HEC POST. */
export async function emitBatch(events: DropEvent[]): Promise<HecResult> {
  if (!hecConfigured()) {
    if (DEBUG) for (const e of events) console.log("[splunk:noop]", JSON.stringify(e));
    return { ok: true, mode: "noop" };
  }
  const body = events
    .map((ev) =>
      JSON.stringify({
        time: Date.parse(ev.time) / 1000,
        host: "zerodrop",
        source: "dropwatch",
        sourcetype: SOURCETYPE,
        index: INDEX,
        event: ev,
      })
    )
    .join("\n");
  return rawPost(body);
}

async function post(payload: unknown): Promise<HecResult> {
  if (!hecConfigured()) {
    if (DEBUG) console.log("[splunk:noop]", JSON.stringify(payload));
    return { ok: true, mode: "noop" };
  }
  return rawPost(JSON.stringify(payload));
}

async function rawPost(body: string): Promise<HecResult> {
  try {
    // Self-signed trial certs: toggle Node's TLS check just for this call.
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (INSECURE) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch(HEC_URL!, {
      method: "POST",
      headers: {
        Authorization: `Splunk ${HEC_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (INSECURE) process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev ?? "";
    if (!res.ok) {
      return { ok: false, mode: "live", status: res.status, error: await res.text() };
    }
    return { ok: true, mode: "live", status: res.status };
  } catch (err) {
    return { ok: false, mode: "live", error: String(err) };
  }
}
