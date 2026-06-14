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
}

export interface ScanOptions {
  dropId?: string;
  windowMin?: number;
  /** Provide events directly (mock mode / tests) and skip the Splunk fetch. */
  events?: DropEvent[];
}

export async function scan(opts: ScanOptions = {}): Promise<ScanReport> {
  const windowMin = opts.windowMin ?? 15;

  let events: DropEvent[];
  let telemetrySource: TelemetrySource;
  let spl: string;

  if (opts.events) {
    events = opts.events;
    telemetrySource = "buffer";
    spl = "(events provided directly — mock mode)";
  } else {
    const fetched = await fetchTelemetry(opts.dropId, windowMin);
    events = fetched.events;
    telemetrySource = fetched.source;
    spl = fetched.spl;
  }

  const dropId = opts.dropId ?? events.find((e) => e.dropId)?.dropId;
  const features = summarize(events, dropId ?? "(all)", windowMin);
  const { findings, tier, llmUsed } = await reason(features);
  const ranked = sortBySeverity(findings);

  return {
    dropId,
    dropName: features.dropName,
    generatedAt: new Date().toISOString(),
    windowMin,
    telemetrySource,
    llmTier: tier,
    llmUsed,
    spl,
    features,
    findings: ranked,
    healthScore: healthScore(ranked),
    eventCount: events.length,
  };
}
