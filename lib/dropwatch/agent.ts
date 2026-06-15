/**
 * DropWatch agent — the orchestrator.
 *
 * One agentic monitoring cycle:
 *   1. PULL recent telemetry FROM Splunk (MCP server -> REST -> local buffer).
 *   2. SUMMARISE it into grounded features.
 *   3. REASON over it with an LLM (Splunk Hosted Models -> AIML -> rules).
 *   4. SCORE drop health + rank findings by severity.
 *
 * This is what /api/ops/scan and `npm run ops:demo` invoke.
 */

import {
  type Features,
  type Finding,
  healthScore,
  sortBySeverity,
  summarize,
} from "./analyze";
import { type LlmTier, reason } from "./llm";
import { recentlyAppliedKinds } from "./actions";
import { notifyScan } from "./notify";
import { agentRuntime, observeScan, type AgentRuntime } from "./agentObs";
import { fetchTelemetry, type TelemetrySource } from "./search";
import type { DropEvent } from "./events";

export interface ScanReport {
  dropId?: string;
  dropName?: string;
  generatedAt: string;
  windowMin: number;
  telemetrySource: TelemetrySource;
  llmTier: LlmTier;
  llmUsed: boolean;
  spl: string;
  features: Features;
  findings: Finding[];
  healthScore: number;
  eventCount: number;
  /** The agent's own runtime metrics (AI agent self-observability). */
  agent: AgentRuntime;
}

export interface ScanOptions {
  dropId?: string;
  windowMin?: number;
  /** Provide events directly (mock mode / tests) and skip the Splunk fetch. */
  events?: DropEvent[];
  /** Public request origin, used to resolve a relative SPLUNK_MCP_URL (self-host). */
  origin?: string;
  /**
   * Remediation kinds the operator has already applied this session. Lets the
   * recovery loop work in stateless/serverless runtimes (Cloudflare Workers,
   * where the apply and the scan can land on different isolates) without relying
   * on the in-memory applied-action log. Unioned with that log.
   */
  appliedKinds?: string[];
}

export async function scan(opts: ScanOptions = {}): Promise<ScanReport> {
  const windowMin = opts.windowMin ?? 15;
  const startedAt = Date.now();

  let events: DropEvent[];
  let telemetrySource: TelemetrySource;
  let spl: string;

  if (opts.events) {
    events = opts.events;
    telemetrySource = "buffer";
    spl = "(events provided directly — mock mode)";
  } else {
    const fetched = await fetchTelemetry(opts.dropId, windowMin, opts.origin);
    events = fetched.events;
    telemetrySource = fetched.source;
    spl = fetched.spl;
  }

  const dropId = opts.dropId ?? events.find((e) => e.dropId)?.dropId;
  const features = summarize(events, dropId ?? "(all)", windowMin);
  const { findings, tier, llmUsed, model, latencyMs, ok, tokensIn, tokensOut, costUsd, confidence } =
    await reason(features);
  // Recovery loop: detect -> act -> RECOVER. If a finding's recommended action
  // was already applied (operator clicked Block/Throttle, or the agent auto-
  // remediated), downgrade it to a mitigated INFO note so drop-health climbs on
  // the next scan instead of re-alarming on a threat that is already handled.
  const ranked = sortBySeverity(recover(findings, opts.appliedKinds));
  const score = healthScore(ranked);
  const at = new Date().toISOString();

  // AI agent self-observability: record this scan's own runtime metrics and ship
  // them to Splunk (sourcetype dropwatch:agent), then surface them on the report.
  await observeScan({
    at,
    scanMs: Date.now() - startedAt,
    llmTier: tier,
    llmModel: model,
    llmLatencyMs: latencyMs,
    llmOk: ok,
    telemetrySource,
    eventCount: events.length,
    findingCount: ranked.length,
    topSeverity: ranked[0]?.severity ?? "info",
    healthScore: score,
    tokensIn,
    tokensOut,
    costUsd,
    confidence,
    dropId,
  }).catch(() => {});

  const report: ScanReport = {
    dropId,
    dropName: features.dropName,
    generatedAt: at,
    windowMin,
    telemetrySource,
    llmTier: tier,
    llmUsed,
    spl,
    features,
    findings: ranked,
    healthScore: score,
    eventCount: events.length,
    agent: agentRuntime(),
  };

  // Automate the operational response: if this scan surfaced a high/critical
  // finding or drop-health fell below threshold, page ops via the alert
  // webhook. Awaited-but-caught + internally no-throw, so it can never break a
  // scan and no-ops cleanly when ALERT_WEBHOOK_URL is unset (e.g. tests/CI).
  await notifyScan(report).catch(() => {});

  return report;
}

/**
 * Recovery pass: downgrade any finding whose recommended remediation has already
 * been applied (within the mitigation window). The threat was real, but it is
 * now handled, so it reads as a resolved INFO note with no health penalty rather
 * than re-alarming on every scan. This closes the agent loop: detect -> act ->
 * RECOVER, and the recovery is itself grounded in telemetry (the apply wrote a
 * breadcrumb back to Splunk).
 */
function recover(findings: Finding[], hintKinds: string[] = []): Finding[] {
  const applied = recentlyAppliedKinds();
  for (const k of hintKinds) if (k) applied.add(k);
  if (applied.size === 0) return findings;
  return findings.map((f) => {
    if (!f.action || f.action.kind === "none" || !applied.has(f.action.kind)) return f;
    return {
      ...f,
      severity: "info",
      title: `${f.title} (mitigated)`,
      reasoning: `Remediation already applied, so this is downgraded to resolved. Original signal: ${f.reasoning}`,
      recommendation: "Resolved by the applied remediation. DropWatch keeps watching for recurrence.",
      action: { kind: "none", label: "Mitigated", params: f.action.params },
      evidence: { ...f.evidence, mitigated: true, mitigatedBy: f.action.kind },
    };
  });
}
