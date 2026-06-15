/**
 * DropWatch alert webhook — "automate operational responses using AI".
 *
 * When an agentic scan produces a high/critical finding OR the drop-health
 * score falls below a threshold, DropWatch auto-notifies ops by POSTing a
 * concise incident message to a webhook (Slack-compatible by default, or a
 * generic JSON shape). This is the closed loop: the LLM reasons over Splunk
 * telemetry, scores drop-health, and — without a human in the loop — pages
 * the on-call channel with the finding and the one-click recommended action.
 *
 * Zero heavy dependencies: Node's built-in `fetch` only. Mirrors the no-op
 * style of lib/splunk.ts — when ALERT_WEBHOOK_URL is unset (local dev, mock
 * mode, CI/tests), every call is a cheap no-op that never throws into the
 * caller and never blocks the scan. Telemetry/alerting must not break the
 * hot path.
 *
 * Env:
 *   ALERT_WEBHOOK_URL     Slack Incoming Webhook (or any POST endpoint). Unset => no-op.
 *   ALERT_WEBHOOK_FORMAT  "slack" (default) | "generic"
 *   ALERT_HEALTH_THRESHOLD  fire when healthScore < this (default 80)
 *   ALERT_WEBHOOK_DEBUG   set to "1" to console.log the payload even when no URL is set
 */

import type { Finding, Severity } from "./analyze";

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const FORMAT = (process.env.ALERT_WEBHOOK_FORMAT ?? "slack").toLowerCase();
const DEBUG = process.env.ALERT_WEBHOOK_DEBUG === "1";

function healthThreshold(): number {
  const raw = Number(process.env.ALERT_HEALTH_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : 80;
}

/** Minimal slice of ScanReport this module needs — avoids a cyclic import on agent.ts. */
export interface AlertableReport {
  dropName?: string;
  dropId?: string;
  findings: Finding[];
  healthScore: number;
  llmTier?: string;
  llmUsed?: boolean;
}

export interface NotifyResult {
  ok: boolean;
  /** "sent" = POSTed, "noop" = no webhook configured, "skipped" = below alert criteria. */
  mode: "sent" | "noop" | "skipped";
  status?: number;
  /** Which finding ids triggered the alert (after de-dupe). */
  alerted?: string[];
  error?: string;
}

export function alertConfigured(): boolean {
  return Boolean(WEBHOOK_URL);
}

const SEV_EMOJI: Record<Severity, string> = {
  critical: ":rotating_light:",
  high: ":red_circle:",
  medium: ":large_orange_diamond:",
  low: ":large_blue_diamond:",
  info: ":white_check_mark:",
};

function isHighSeverity(sev: Severity): boolean {
  return sev === "critical" || sev === "high";
}

/**
 * Decide whether a scan warrants paging ops and, if so, which findings.
 * Fires for any finding with severity high/critical OR when health is below
 * the threshold. De-dupes trivially by finding id within the scan.
 */
export function selectAlertable(report: AlertableReport): {
  fire: boolean;
  findings: Finding[];
  reason: "severity" | "health" | "both" | null;
} {
  const threshold = healthThreshold();
  const healthBreached = report.healthScore < threshold;

  const seen = new Set<string>();
  const severe: Finding[] = [];
  for (const f of report.findings) {
    if (!isHighSeverity(f.severity)) continue;
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    severe.push(f);
  }

  if (!healthBreached && severe.length === 0) {
    return { fire: false, findings: [], reason: null };
  }

  // If only health is breached but no high-sev finding, alert on the worst
  // finding(s) we do have so the page is still actionable.
  let chosen = severe;
  if (chosen.length === 0) {
    const seenH = new Set<string>();
    chosen = report.findings.filter((f) => {
      if (f.severity === "info" || seenH.has(f.id)) return false;
      seenH.add(f.id);
      return true;
    });
  }

  const reason =
    healthBreached && severe.length > 0
      ? "both"
      : healthBreached
        ? "health"
        : "severity";

  return { fire: true, findings: chosen, reason };
}

function worstSeverity(findings: Finding[]): Severity {
  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  for (const sev of order) if (findings.some((f) => f.severity === sev)) return sev;
  return "info";
}

function buildSlackPayload(report: AlertableReport, findings: Finding[]): unknown {
  const drop = report.dropName ?? report.dropId ?? "(unknown drop)";
  const worst = worstSeverity(findings);
  const lead = findings[0];
  const title = `${SEV_EMOJI[worst]} DropWatch incident — ${drop}`;
  const text = `${title}  •  health ${report.healthScore}/100  •  ${findings.length} finding(s)`;

  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: `DropWatch incident — ${drop}`.slice(0, 150) } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Severity:*\n${worst}` },
        { type: "mrkdwn", text: `*Drop health:*\n${report.healthScore}/100` },
      ],
    },
  ];

  for (const f of findings.slice(0, 5)) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `${SEV_EMOJI[f.severity]} *${f.title}* _(${f.severity})_`,
          `*Why:* ${f.reasoning}`,
          `*Recommended action:* ${f.recommendation}`,
          f.action && f.action.kind !== "none" ? `*One-click:* ${f.action.label}` : null,
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2900),
      },
    });
  }

  const src = report.llmUsed ? `LLM (${report.llmTier ?? "?"})` : "deterministic rules";
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `DropWatch agentic scan • reasoning: ${src}` }],
  });

  // `text` is the notification/fallback; `attachments[].color` gives the
  // red side-bar Slack ops folks expect. `blocks` render the rich body.
  return {
    text,
    attachments: [
      {
        color: worst === "critical" ? "#d50000" : worst === "high" ? "#ff6d00" : "#ffab00",
        blocks,
      },
    ],
  };
}

function buildGenericPayload(report: AlertableReport, findings: Finding[]): unknown {
  const worst = worstSeverity(findings);
  const lead = findings[0];
  return {
    title: `DropWatch incident — ${report.dropName ?? report.dropId ?? "unknown"}`,
    severity: worst,
    healthScore: report.healthScore,
    dropName: report.dropName,
    dropId: report.dropId,
    reasoning: lead?.reasoning,
    recommendedAction: lead?.recommendation,
    action: lead?.action,
    reasoningSource: report.llmUsed ? report.llmTier ?? "llm" : "rules",
    findings: findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      reasoning: f.reasoning,
      recommendation: f.recommendation,
      action: f.action,
    })),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format + POST an incident alert for a scan report. Fire-and-forget friendly:
 * never throws — returns a NotifyResult describing what happened. No-ops cleanly
 * when ALERT_WEBHOOK_URL is unset (exactly like the HEC client).
 */
export async function notifyScan(report: AlertableReport): Promise<NotifyResult> {
  const { fire, findings } = selectAlertable(report);

  if (!fire) {
    return { ok: true, mode: "skipped" };
  }

  const payload =
    FORMAT === "generic"
      ? buildGenericPayload(report, findings)
      : buildSlackPayload(report, findings);

  const alerted = findings.map((f) => f.id);

  if (!WEBHOOK_URL) {
    if (DEBUG) console.log("[notify:noop]", JSON.stringify(payload));
    return { ok: true, mode: "noop", alerted };
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        ok: false,
        mode: "sent",
        status: res.status,
        alerted,
        error: await res.text().catch(() => `HTTP ${res.status}`),
      };
    }
    return { ok: true, mode: "sent", status: res.status, alerted };
  } catch (err) {
    return { ok: false, mode: "sent", alerted, error: String(err) };
  }
}
