/**
 * LLM reasoning layer for DropWatch, with a three-tier fallback so the agent
 * ALWAYS produces findings:
 *
 *   1. Splunk Hosted Models (live mode) — Splunk AI capability. When
 *      SPLUNK_HOSTED_MODEL_URL is set, DropWatch sends the features there
 *      (OpenAI-compatible chat/completions contract).
 *   2. AI/ML API (OpenAI-compatible) — AIMLAPI_API_KEY, model gpt-4o-mini,
 *      base https://api.aimlapi.com/v1. The reliable cloud fallback.
 *   3. Deterministic rules engine (lib/dropwatch/analyze.ts) — zero-key fallback.
 *
 * Stdlib `fetch` only.
 */

import type { Features, Finding, Severity } from "./analyze";
import { rulesEngine } from "./analyze";

export type LlmTier = "hosted-model" | "aiml" | "rules";

const HOSTED_URL = process.env.SPLUNK_HOSTED_MODEL_URL;
const HOSTED_TOKEN = process.env.SPLUNK_HOSTED_MODEL_TOKEN;
const HOSTED_MODEL = process.env.SPLUNK_HOSTED_MODEL ?? "splunk-llm";

const AIML_KEY = process.env.AIMLAPI_API_KEY;
const AIML_BASE = process.env.AIMLAPI_BASE_URL ?? "https://api.aimlapi.com/v1";
const AIML_MODEL = process.env.AIMLAPI_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are DropWatch, an autonomous site-reliability AND abuse-detection agent for ZeroDrop, an oversell-proof flash-drop platform. When you are backed by a Splunk hosted security model (e.g. Foundation-Sec), produce security-grade reasoning for abuse findings.
You are given a JSON summary of telemetry pulled from Splunk for one product drop. Detect operational anomalies AND automated-abuse patterns, and produce concrete, actionable findings.

Anomaly classes to consider:
- "stampede": sudden surge in claim rate (traffic going viral, stock draining fast)
- "oversell-bot": a /24 subnet producing a disproportionate share of oversell-reject events after sellout. Treat this as a SECURITY finding: automated scalping bots, OWASP Automated Threats OAT-005 (Scalping), an inventory-abuse pattern. Recommend blocking the subnet, and include a confidence. Overselling itself NEVER happens (the DynamoDB conditional write guarantees it), so the reject cluster is a clean behavioral security signal, not a data fault.
- "hold-expiry-storm": abnormal rate of holds expiring unconfirmed (cart abandonment locking up stock)
- "waitlist-collapse": waitlist filling but conversion collapsing

Respond ONLY with strict JSON, no prose, of shape:
{"findings":[{"id":"","title":"","severity":"critical|high|medium|low|info","reasoning":"","recommendation":"","action":{"kind":"enable_throttle|extend_hold|flag_ip_cluster|notify|none","label":"","params":{}}}]}
Ground every reasoning string in the actual numbers from the input. Be concise. If healthy, return one info finding.`;

export interface AgentResult {
  findings: Finding[];
  tier: LlmTier;
  /** True when the LLM produced output that was successfully parsed. */
  llmUsed: boolean;
  /** Model behind the chosen tier (or "rules-engine"). For agent self-observability. */
  model: string;
  /** Time spent in the chosen reasoning tier, ms. */
  latencyMs: number;
  /** False when an LLM tier was attempted but failed and the agent fell back. */
  ok: boolean;
  /** Prompt / completion tokens this scan (0 for the rules tier). */
  tokensIn: number;
  tokensOut: number;
  /** Estimated USD cost of this reasoning step (0 for Splunk-hosted / rules). */
  costUsd: number;
  /** Self-reported reasoning confidence 0..1 (quality signal for AI agent monitoring). */
  confidence: number;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Rough $/1M-token estimate. Splunk-hosted models (Foundation-Sec, GPT-OSS) are free. */
function estCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const m = model.toLowerCase();
  const [ri, ro] =
    m.includes("foundation-sec") || m.includes("gpt-oss") || m.includes("splunk")
      ? [0, 0]
      : m.includes("gpt-4o-mini")
        ? [0.15, 0.6]
        : m.includes("gpt-4o")
          ? [2.5, 10]
          : [0.15, 0.6];
  return Math.round(((tokensIn * ri + tokensOut * ro) / 1_000_000) * 1e6) / 1e6;
}

function build(
  findings: Finding[],
  tier: LlmTier,
  llmUsed: boolean,
  model: string,
  latencyMs: number,
  usage: Usage | null,
  ok: boolean
): AgentResult {
  const tokensIn = usage?.prompt_tokens ?? 0;
  const tokensOut = usage?.completion_tokens ?? 0;
  return {
    findings,
    tier,
    llmUsed,
    model,
    latencyMs,
    ok,
    tokensIn,
    tokensOut,
    costUsd: estCostUsd(model, tokensIn, tokensOut),
    confidence: ok ? (tier === "rules" ? 0.7 : 0.92) : 0.45,
  };
}

export async function reason(features: Features): Promise<AgentResult> {
  const userMsg = JSON.stringify(features);
  let fellBack = false;

  if (HOSTED_URL) {
    const t0 = Date.now();
    const r = await tryChat(HOSTED_URL, HOSTED_TOKEN, HOSTED_MODEL, userMsg, "hosted-model");
    if (r) return build(r.findings, "hosted-model", true, HOSTED_MODEL, Date.now() - t0, r.usage, true);
    fellBack = true;
  }
  if (AIML_KEY) {
    const t0 = Date.now();
    const r = await tryChat(`${AIML_BASE}/chat/completions`, AIML_KEY, AIML_MODEL, userMsg, "aiml");
    if (r) return build(r.findings, "aiml", true, AIML_MODEL, Date.now() - t0, r.usage, true);
    fellBack = true;
  }
  // Deterministic fallback. ok=false only when an LLM tier was tried and failed
  // (a real reliability signal); the zero-key default path is ok=true.
  const t0 = Date.now();
  const findings = rulesEngine(features);
  return build(findings, "rules", false, "rules-engine", Date.now() - t0, null, !fellBack);
}

async function tryChat(
  url: string,
  token: string | undefined,
  model: string,
  userMsg: string,
  source: "hosted-model" | "aiml"
): Promise<{ findings: Finding[]; usage: Usage | null } | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[dropwatch] ${source} HTTP ${res.status}:`, (await res.text()).slice(0, 200));
      return null;
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;
    const findings = parseFindings(content, source);
    if (!findings) return null;
    const u = json?.usage;
    const usage: Usage | null = u
      ? {
          prompt_tokens: Number(u.prompt_tokens) || 0,
          completion_tokens: Number(u.completion_tokens) || 0,
          total_tokens: Number(u.total_tokens) || 0,
        }
      : null;
    return { findings, usage };
  } catch (err) {
    console.warn(`[dropwatch] ${source} call failed:`, String(err));
    return null;
  }
}

const VALID_SEV: Severity[] = ["critical", "high", "medium", "low", "info"];

function parseFindings(content: string, source: "hosted-model" | "aiml"): Finding[] | null {
  try {
    // Tolerate fenced code blocks.
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const obj = JSON.parse(cleaned);
    const arr = Array.isArray(obj) ? obj : obj.findings;
    if (!Array.isArray(arr)) return null;
    return arr.map((f: Record<string, unknown>, i: number) => ({
      id: String(f.id ?? `finding-${i}`),
      title: String(f.title ?? "Finding"),
      severity: VALID_SEV.includes(f.severity as Severity) ? (f.severity as Severity) : "medium",
      reasoning: String(f.reasoning ?? ""),
      recommendation: String(f.recommendation ?? ""),
      action: normalizeAction(f.action),
      evidence: (f.evidence as Record<string, unknown>) ?? undefined,
      source,
    }));
  } catch {
    return null;
  }
}

function normalizeAction(a: unknown): Finding["action"] {
  const action = a as Record<string, unknown> | undefined;
  const kind = action?.kind as string;
  const valid = ["enable_throttle", "extend_hold", "flag_ip_cluster", "notify", "none"];
  return {
    kind: (valid.includes(kind) ? kind : "none") as NonNullable<Finding["action"]>["kind"],
    label: String(action?.label ?? "Acknowledge"),
    params: (action?.params as Record<string, unknown>) ?? {},
  };
}
