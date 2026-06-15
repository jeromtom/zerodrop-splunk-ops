/**
 * Agent self-observability — DropWatch watching its OWN agent.
 *
 * Splunk's newest capability (AI Agent Monitoring, 2026) is about observing the
 * performance, quality, cost and reliability of AI-powered apps. DropWatch IS an
 * AI agent, so it instruments its own reasoning loop: every scan records which
 * LLM tier fired (Hosted Models / AIML / rules), the model, LLM latency, total
 * scan time, and whether the LLM fell back. Those metrics are kept in a small
 * rolling store for the /ops "Agent runtime" panel AND shipped to Splunk as
 * `dropwatch:agent` telemetry, so the agent is observable the same way the app is.
 *
 * No-op-safe: the Splunk emit goes through the HEC client, which no-ops without
 * env, so tests / local dev are unaffected.
 */

import { emitAgentEvent } from "../splunk";

export interface AgentScanObservation {
  at: string;
  /** Wall-clock for the whole pull -> summarize -> reason -> score cycle. */
  scanMs: number;
  /** "hosted-model" | "aiml" | "rules". */
  llmTier: string;
  /** Model name (or "rules-engine"). */
  llmModel: string;
  /** Time spent in the chosen reasoning tier. */
  llmLatencyMs: number;
  /** false => the chosen LLM tier failed and the agent fell back. */
  llmOk: boolean;
  telemetrySource: string;
  eventCount: number;
  findingCount: number;
  topSeverity: string;
  healthScore: number;
  /** Prompt / completion tokens for this scan's reasoning (0 for the rules tier). */
  tokensIn: number;
  tokensOut: number;
  /** Estimated USD cost of this scan's reasoning (0 for Splunk-hosted / rules). */
  costUsd: number;
  /** Self-reported reasoning confidence 0..1 (quality signal). */
  confidence: number;
  /** How much the verdict (health + finding count) moved vs the previous scan, 0..1. */
  drift: number;
  dropId?: string;
}

export interface AgentRuntime {
  scans: number;
  /** Scans whose reasoning actually reached an LLM tier (not the rules engine). */
  llmCalls: number;
  /** Scans where an LLM tier was attempted but failed and fell back. */
  llmErrors: number;
  avgScanMs: number;
  avgLlmLatencyMs: number;
  lastTier: string;
  lastModel: string;
  lastScanMs: number;
  lastLlmLatencyMs: number;
  /** AI agent monitoring: token + cost + quality + drift. */
  totalTokens: number;
  totalCostUsd: number;
  avgConfidence: number;
  lastConfidence: number;
  lastDrift: number;
  lastTokens: number;
  sinceIso: string;
  /** Most-recent observations, newest first (for a sparkline / feed). */
  recent: AgentScanObservation[];
}

const MAX = 50;
const g = globalThis as unknown as {
  __dropwatchAgentObs?: { obs: AgentScanObservation[]; since: string };
};
const store = (g.__dropwatchAgentObs ??= { obs: [], since: new Date().toISOString() });

const avg = (xs: number[]): number =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
const r2 = (x: number): number => Math.round(x * 100) / 100;
const rUsd = (x: number): number => Math.round(x * 1e6) / 1e6;

/** Record one scan's runtime metrics + ship them to Splunk (`dropwatch:agent`). */
export async function observeScan(o: Omit<AgentScanObservation, "drift">): Promise<void> {
  const prev = store.obs[store.obs.length - 1];
  // Drift = how much the agent's verdict moved scan-to-scan (health + finding count).
  const drift = prev
    ? r2(
        Math.min(
          1,
          (Math.abs(o.healthScore - prev.healthScore) / 100 +
            Math.abs(o.findingCount - prev.findingCount) / Math.max(1, prev.findingCount + 1)) /
            2
        )
      )
    : 0;
  const obs: AgentScanObservation = { ...o, drift };
  store.obs.push(obs);
  if (store.obs.length > MAX) store.obs.splice(0, store.obs.length - MAX);
  void emitAgentEvent({ event: "agent_scan", ...obs }).catch(() => {});
}

/** Snapshot of the agent's own health, for the /ops "Agent runtime" panel. */
export function agentRuntime(): AgentRuntime {
  const obs = store.obs;
  const llm = obs.filter((o) => o.llmTier !== "rules");
  const last = obs[obs.length - 1];
  return {
    scans: obs.length,
    llmCalls: llm.length,
    llmErrors: obs.filter((o) => !o.llmOk).length,
    avgScanMs: avg(obs.map((o) => o.scanMs)),
    avgLlmLatencyMs: avg(llm.map((o) => o.llmLatencyMs)),
    lastTier: last?.llmTier ?? "—",
    lastModel: last?.llmModel ?? "—",
    lastScanMs: last?.scanMs ?? 0,
    lastLlmLatencyMs: last?.llmLatencyMs ?? 0,
    totalTokens: obs.reduce((a, o) => a + (o.tokensIn || 0) + (o.tokensOut || 0), 0),
    totalCostUsd: rUsd(obs.reduce((a, o) => a + (o.costUsd || 0), 0)),
    avgConfidence: obs.length ? r2(obs.reduce((a, o) => a + (o.confidence || 0), 0) / obs.length) : 0,
    lastConfidence: last?.confidence ?? 0,
    lastDrift: last?.drift ?? 0,
    lastTokens: (last?.tokensIn ?? 0) + (last?.tokensOut ?? 0),
    sinceIso: store.since,
    recent: obs.slice(-8).reverse(),
  };
}
