/**
 * Feature extraction + deterministic rules engine for DropWatch.
 *
 * `summarize()` turns a window of raw telemetry into compact features. Those
 * features are (a) fed to the LLM as grounded context, and (b) run through the
 * deterministic `rulesEngine()` which is the always-available fallback — so
 * DropWatch produces findings even with zero LLM keys.
 */

import type { DropEvent } from "./events";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  /** Why DropWatch flagged this — grounded in the metrics. */
  reasoning: string;
  /** Concrete ops action. */
  recommendation: string;
  /** Machine-actionable action the /ops "Apply" button can execute. */
  action?: OpsAction;
  /** Evidence the finding is based on. */
  evidence?: Record<string, unknown>;
  source: "rules" | "hosted-model" | "aiml" | "llm";
}

export interface OpsAction {
  kind: "enable_throttle" | "extend_hold" | "flag_ip_cluster" | "notify" | "none";
  params?: Record<string, unknown>;
  label: string;
}

export interface Features {
  dropId: string;
  dropName?: string;
  windowMin: number;
  totalEvents: number;
  counts: Record<string, number>;
  claimsPerMin: number;
  peakClaimsPerMin: number;
  oversellRejects: number;
  oversellRejectRate: number; // rejects / (claims + rejects)
  holdExpiries: number;
  holdExpiryRate: number; // expiries / holds_created
  waitlistAdds: number;
  checkouts: number;
  waitlistConversion: number; // checkouts / (checkouts + waitlistAdds)
  /** IP -> oversell_reject count, sorted desc. */
  topRejectIps: Array<{ ip: string; count: number }>;
  /** /24 subnet -> oversell_reject count, sorted desc (bot-cluster signal). */
  topRejectSubnets: Array<{ subnet: string; count: number; ips: number }>;
  /** Stampede onset: ratio of peak to baseline claim rate. */
  stampedeRatio: number;
}

/** Coarse /24 grouping, e.g. 10.66.6.5 -> 10.66.6.0/24. */
function subnet24(ip: string): string {
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\./);
  return m ? `${m[1]}.${m[2]}.${m[3]}.0/24` : ip;
}

export function summarize(
  events: DropEvent[],
  dropId: string,
  windowMin = 15
): Features {
  const counts: Record<string, number> = {};
  const perMin = new Map<number, number>();
  const rejectIps = new Map<string, number>();
  const rejectSubnets = new Map<string, { count: number; ips: Set<string> }>();
  let oversellRejects = 0;
  let holdExpiries = 0;
  let holdsCreated = 0;
  let waitlistAdds = 0;
  let checkouts = 0;
  let dropName: string | undefined;

  for (const e of events) {
    counts[e.event] = (counts[e.event] ?? 0) + 1;
    if (e.dropName) dropName = e.dropName;
    if (e.event === "claim") {
      const m = Math.floor(Date.parse(e.time) / 60_000);
      perMin.set(m, (perMin.get(m) ?? 0) + 1);
    }
    if (e.event === "oversell_reject") {
      oversellRejects++;
      if (e.ip) {
        rejectIps.set(e.ip, (rejectIps.get(e.ip) ?? 0) + 1);
        const sn = subnet24(e.ip);
        const cur = rejectSubnets.get(sn) ?? { count: 0, ips: new Set<string>() };
        cur.count++;
        cur.ips.add(e.ip);
        rejectSubnets.set(sn, cur);
      }
    }
    if (e.event === "hold_expiry") holdExpiries++;
    if (e.event === "hold_create") holdsCreated++;
    if (e.event === "waitlist_add") waitlistAdds++;
    if (e.event === "checkout") checkouts++;
  }

  const rates = [...perMin.values()];
  const claims = counts.claim ?? 0;
  const peakClaimsPerMin = rates.length ? Math.max(...rates) : 0;
  const claimsPerMin = claims / Math.max(1, windowMin);
  // Baseline = median of non-peak minutes.
  const sorted = [...rates].sort((a, b) => a - b);
  const baseline = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const stampedeRatio = baseline > 0 ? peakClaimsPerMin / baseline : peakClaimsPerMin;

  const topRejectIps = [...rejectIps.entries()]
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topRejectSubnets = [...rejectSubnets.entries()]
    .map(([subnet, v]) => ({ subnet, count: v.count, ips: v.ips.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    dropId,
    dropName,
    windowMin,
    totalEvents: events.length,
    counts,
    claimsPerMin: round(claimsPerMin),
    peakClaimsPerMin,
    oversellRejects,
    oversellRejectRate: round(oversellRejects / Math.max(1, claims + oversellRejects)),
    holdExpiries,
    holdExpiryRate: round(holdExpiries / Math.max(1, holdsCreated)),
    waitlistAdds,
    checkouts,
    waitlistConversion: round(checkouts / Math.max(1, checkouts + waitlistAdds)),
    topRejectIps,
    topRejectSubnets,
    stampedeRatio: round(stampedeRatio),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Deterministic rules engine — the always-on fallback. Mirrors the kinds of
 * findings the LLM produces, grounded in the same features.
 */
export function rulesEngine(f: Features): Finding[] {
  const out: Finding[] = [];

  // 1. Stampede onset.
  if (f.stampedeRatio >= 4 && f.peakClaimsPerMin >= 20) {
    out.push({
      id: "stampede",
      title: "Stampede onset detected",
      severity: f.stampedeRatio >= 8 ? "critical" : "high",
      reasoning: `Claim rate spiked to ${f.peakClaimsPerMin}/min, ${f.stampedeRatio}x the baseline. The drop is going viral and stock is draining fast.`,
      recommendation: `Enable the queue throttle on drop ${f.dropId} to smooth the surge and protect tail latency.`,
      action: { kind: "enable_throttle", params: { dropId: f.dropId, rps: 50 }, label: "Enable queue throttle" },
      evidence: { peakClaimsPerMin: f.peakClaimsPerMin, stampedeRatio: f.stampedeRatio },
      source: "rules",
    });
  }

  // 2. Oversell-bot pattern: one IP subnet cluster dominating rejects.
  const top = f.topRejectSubnets[0];
  if (top && f.oversellRejects >= 10 && top.count / f.oversellRejects >= 0.25) {
    const pct = Math.round((top.count / f.oversellRejects) * 100);
    out.push({
      id: "oversell-bot",
      title: "Oversell-attempt bot cluster",
      severity: "high",
      reasoning: `${f.oversellRejects} oversell-reject events; subnet ${top.subnet} (${top.ips} IPs) alone produced ${top.count} (${pct}%). Repeated post-sellout claim attempts concentrated in one subnet is the signature of automated checkout bots. (No oversell occurred — the DynamoDB conditional guard held.)`,
      recommendation: `Flag IP cluster ${top.subnet} and add it to the soft block / CAPTCHA list for this drop.`,
      action: { kind: "flag_ip_cluster", params: { subnet: top.subnet, count: top.count }, label: `Flag ${top.subnet}` },
      evidence: { topRejectSubnets: f.topRejectSubnets, oversellRejects: f.oversellRejects },
      source: "rules",
    });
  }

  // 3. Hold-expiry storm.
  if (f.holdExpiries >= 10 && f.holdExpiryRate >= 0.3) {
    out.push({
      id: "hold-expiry-storm",
      title: "Abnormal hold-expiry storm",
      severity: "medium",
      reasoning: `${f.holdExpiries} holds expired (${Math.round(f.holdExpiryRate * 100)}% of holds created). Stock is bouncing back to inventory unconfirmed — buyers are abandoning carts after the rush.`,
      recommendation: `Extend the hold window for drop ${f.dropId} from 10 to 15 minutes to give buyers time to check out.`,
      action: { kind: "extend_hold", params: { dropId: f.dropId, seconds: 900 }, label: "Extend hold to 15m" },
      evidence: { holdExpiries: f.holdExpiries, holdExpiryRate: f.holdExpiryRate },
      source: "rules",
    });
  }

  // 4. Waitlist conversion collapse.
  if (f.waitlistAdds >= 10 && f.waitlistConversion < 0.3 && f.checkouts > 0) {
    out.push({
      id: "waitlist-collapse",
      title: "Waitlist conversion collapse",
      severity: "low",
      reasoning: `${f.waitlistAdds} buyers waitlisted but conversion is only ${Math.round(f.waitlistConversion * 100)}%. Demand is being captured but not converted.`,
      recommendation: `Trigger a restock-notify campaign to the waitlist for drop ${f.dropId}.`,
      action: { kind: "notify", params: { dropId: f.dropId, audience: "waitlist" }, label: "Notify waitlist" },
      evidence: { waitlistAdds: f.waitlistAdds, waitlistConversion: f.waitlistConversion },
      source: "rules",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "healthy",
      title: "Drop healthy",
      severity: "info",
      reasoning: `No anomalies. Claim rate ${f.claimsPerMin}/min, ${f.oversellRejects} oversell rejects, ${f.holdExpiries} hold expiries. The DynamoDB conditional guard reports 0 oversells.`,
      recommendation: "No action required. Continue monitoring.",
      action: { kind: "none", label: "Acknowledge" },
      source: "rules",
    });
  }

  return out;
}

const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** 0-100 health score from findings (100 = perfectly healthy). */
export function healthScore(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) {
    if (f.severity === "critical") penalty += 40;
    else if (f.severity === "high") penalty += 25;
    else if (f.severity === "medium") penalty += 12;
    else if (f.severity === "low") penalty += 5;
  }
  return Math.max(0, 100 - penalty);
}

export function sortBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}
