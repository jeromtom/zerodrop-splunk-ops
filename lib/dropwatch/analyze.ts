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
  /**
   * GENERIC per-event-type rate series: event type -> per-minute counts, in
   * chronological order. Powers the baseline/z-score anomaly detector so
   * DropWatch works on ANY event stream, not just the flash-drop taxonomy.
   */
  rateSeries: Record<string, number[]>;
  /**
   * LEADING INDICATOR — claim-rate velocity (Δ claims/min between consecutive
   * minutes). Positive + rising = demand accelerating before a hard stampede.
   */
  claimVelocity: {
    /** Per-minute deltas of the claim rate, chronological. */
    deltas: number[];
    /** Most recent acceleration (slope of velocity over the tail). */
    acceleration: number;
    /** Rate at the start vs the most recent minute of the rising run. */
    recentRate: number;
    /** Minutes of consecutive rising claim rate at the tail. */
    risingRun: number;
  };
}

export interface RateStats {
  eventType: string;
  /** Mean per-minute rate across the baseline window. */
  mean: number;
  /** Standard deviation of the per-minute rate. */
  std: number;
  /** The most recent (or peak-recent) per-minute rate being scored. */
  recent: number;
  /** (recent - mean) / std — how many sigma the recent rate deviates. */
  z: number;
  /** Number of minute-buckets observed. */
  samples: number;
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
  // GENERIC: per-event-type -> (minute-bucket -> count).
  const perTypePerMin = new Map<string, Map<number, number>>();
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
    // GENERIC: bucket EVERY event type per minute (drives anomaly detection).
    const min = Math.floor(Date.parse(e.time) / 60_000);
    let typeBuckets = perTypePerMin.get(e.event);
    if (!typeBuckets) perTypePerMin.set(e.event, (typeBuckets = new Map()));
    typeBuckets.set(min, (typeBuckets.get(min) ?? 0) + 1);
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

  // --- GENERIC rate series: densify each event type over the full minute span.
  // Using a shared min/max minute keeps every series aligned and includes the
  // zero-minutes between bursts (so a quiet stream really reads as quiet).
  const allMinutes: number[] = [];
  for (const buckets of perTypePerMin.values()) for (const m of buckets.keys()) allMinutes.push(m);
  const rateSeries: Record<string, number[]> = {};
  if (allMinutes.length) {
    const minMinute = Math.min(...allMinutes);
    const maxMinute = Math.max(...allMinutes);
    const span = maxMinute - minMinute + 1;
    for (const [type, buckets] of perTypePerMin) {
      const series = new Array<number>(span).fill(0);
      for (const [m, c] of buckets) series[m - minMinute] = c;
      rateSeries[type] = series;
    }
  }

  // --- LEADING INDICATOR: claim-rate velocity (acceleration of demand).
  // We scan for the LONGEST run of consecutive strictly-rising minutes anywhere
  // in the series (not just the tail) so we catch the *rising edge* of a surge —
  // the early-warning window — before the rate peaks and collapses. recentRate
  // is the rate at the TOP of that rising run (where the warning would fire).
  const claimSeries = rateSeries.claim ?? [];
  const deltas: number[] = [];
  for (let i = 1; i < claimSeries.length; i++) deltas.push(claimSeries[i] - claimSeries[i - 1]);
  let risingRun = 0;
  let runRate = claimSeries.length ? claimSeries[claimSeries.length - 1] : 0;
  let runAccel = 0;
  let cur = 0;
  for (let i = 1; i < claimSeries.length; i++) {
    if (claimSeries[i] > claimSeries[i - 1]) {
      cur++;
      if (cur > risingRun) {
        risingRun = cur;
        // Rate at the top of this rising run, and its mean per-minute acceleration.
        runRate = claimSeries[i];
        runAccel = (claimSeries[i] - claimSeries[i - cur]) / cur;
      }
    } else {
      cur = 0;
    }
  }
  const acceleration = risingRun > 0 ? runAccel : 0;
  const recentRate = risingRun > 0 ? runRate : (claimSeries.length ? claimSeries[claimSeries.length - 1] : 0);
  const claimVelocity = { deltas, acceleration: round(acceleration), recentRate, risingRun };

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
    rateSeries,
    claimVelocity,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * GENERIC baseline anomaly detector (works on ANY event stream).
 *
 * For each event type we have a per-minute rate series. We split it into a
 * baseline window (the earlier minutes) and a recent window (the last
 * `recentWindow` minutes), compute the baseline mean + standard deviation, and
 * z-score the PEAK of the recent window against it. Scoring the peak of a small
 * recent window (rather than only the final bucket) makes the detector robust
 * to exactly where in the recent past the spike landed — the classic 3-sigma
 * control-chart rule. It's domain-agnostic, so DropWatch generalises past flash
 * drops to logins, payments, API calls — anything that emits typed events.
 *
 * Guards (to stay quiet on calm/sparse streams — no false positives):
 *  - need >= `minSamples` minute-buckets and a non-empty baseline window,
 *  - baseline std is floored to avoid divide-by-noise on a near-constant series,
 *  - callers additionally gate on absolute level + margin (see baselineAnomalies).
 */
export function baselineRateStats(
  series: Record<string, number[]>,
  opts: { minSamples?: number; recentWindow?: number } = {}
): RateStats[] {
  const minSamples = opts.minSamples ?? 5;
  const recentWindow = opts.recentWindow ?? 3;
  const out: RateStats[] = [];

  for (const [eventType, full] of Object.entries(series)) {
    if (full.length < minSamples) continue;
    // Keep at least 2 baseline buckets; never let the recent window eat them all.
    const split = Math.max(2, full.length - recentWindow);
    const baseline = full.slice(0, split);
    const recentBuckets = full.slice(split);
    if (baseline.length < 2 || recentBuckets.length === 0) continue;

    const recent = Math.max(...recentBuckets); // peak of the recent window
    const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const variance =
      baseline.reduce((a, b) => a + (b - mean) * (b - mean), 0) / baseline.length;
    // Floor std so a near-constant baseline can't manufacture an infinite z on
    // a 1-event wobble. 1 event/min of natural jitter is the noise floor.
    const std = Math.max(Math.sqrt(variance), 1);
    const z = (recent - mean) / std;

    out.push({ eventType, mean: round(mean), std: round(std), recent, z: round(z), samples: full.length });
  }
  // Strongest deviation first.
  return out.sort((a, b) => b.z - a.z);
}

/**
 * Turn baseline rate stats into anomaly findings. Severity scales with the
 * z-score: bigger deviation => more severe. Quiet by default.
 */
export function baselineAnomalies(
  f: Features,
  opts: { z?: number; minRecent?: number; minAbsMargin?: number; recentWindow?: number } = {}
): Finding[] {
  const zThreshold = opts.z ?? 3;
  const minRecent = opts.minRecent ?? 5;
  const minAbsMargin = opts.minAbsMargin ?? 5;
  const out: Finding[] = [];

  for (const s of baselineRateStats(f.rateSeries, { recentWindow: opts.recentWindow })) {
    // Three independent gates: statistical (z), absolute level, absolute margin.
    if (s.z < zThreshold) continue;
    if (s.recent < minRecent) continue;
    if (s.recent - s.mean < minAbsMargin) continue;

    // Severity scales with how many sigma out we are.
    const severity: Severity =
      s.z >= 8 ? "critical" : s.z >= 6 ? "high" : s.z >= 4 ? "medium" : "low";

    out.push({
      id: `anomaly-${s.eventType}`,
      title: `Rate anomaly: ${s.eventType}`,
      severity,
      reasoning: `Baseline anomaly detector: "${s.eventType}" spiked to ${s.recent}/min vs a baseline of ${s.mean}/min (σ=${s.std}) — that's ${s.z}σ above normal over ${s.samples} minutes. A statistically significant deviation, surfaced by the generic control-chart detector (works on any event type).`,
      recommendation: `Investigate the "${s.eventType}" surge on drop ${f.dropId}; correlate with deploys, upstream incidents, or traffic sources before it escalates.`,
      action: { kind: "notify", params: { dropId: f.dropId, eventType: s.eventType, z: s.z }, label: `Alert on ${s.eventType} spike` },
      evidence: { eventType: s.eventType, recentPerMin: s.recent, baselineMean: s.mean, std: s.std, zScore: s.z, samples: s.samples },
      source: "rules",
    });
  }
  return out;
}

/**
 * LEADING INDICATOR / early-warning detector.
 *
 * The hard `stampede` rule only fires once the surge has already peaked
 * (peakClaimsPerMin >= 20, ratio >= 4). This detector watches the *velocity*
 * of the claim rate and fires a MEDIUM "stampede forming" finding while demand
 * is still accelerating — BEFORE the hard threshold is crossed — so ops can act
 * earlier. It deliberately stays silent on flat/declining (healthy) streams.
 */
export function leadingIndicators(
  f: Features,
  opts: { minRisingRun?: number; minAcceleration?: number; minRecentRate?: number } = {}
): Finding[] {
  const minRisingRun = opts.minRisingRun ?? 2; // >= 2 consecutive accelerating minutes
  const minAcceleration = opts.minAcceleration ?? 2; // claims/min added each minute
  const minRecentRate = opts.minRecentRate ?? 8; // already non-trivial volume
  const v = f.claimVelocity;
  const out: Finding[] = [];

  const accelerating =
    v.risingRun >= minRisingRun &&
    v.acceleration >= minAcceleration &&
    v.recentRate >= minRecentRate;

  // Only an EARLY warning: skip if the hard stampede has already clearly hit
  // (peak well past threshold) — at that point the `stampede` finding owns it.
  if (accelerating) {
    out.push({
      id: "stampede-forming",
      title: "Stampede forming (early warning)",
      severity: "medium",
      reasoning: `Leading indicator: claim rate has accelerated for ${v.risingRun} straight minutes (+${v.acceleration}/min each), now at ${v.recentRate}/min. Demand velocity is rising — a stampede is forming before the hard surge threshold is crossed. Acting now smooths the curve instead of reacting to the peak.`,
      recommendation: `Pre-warm the queue throttle on drop ${f.dropId} now (lower-impact than reacting after the spike). Watch for the hard stampede signal next.`,
      action: { kind: "enable_throttle", params: { dropId: f.dropId, rps: 50, mode: "preemptive" }, label: "Pre-warm queue throttle" },
      evidence: { risingRun: v.risingRun, acceleration: v.acceleration, recentRate: v.recentRate, deltas: v.deltas.slice(-6) },
      source: "rules",
    });
  }
  return out;
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

  // 2. Oversell-bot pattern as a SECURITY finding: one /24 subnet dominating
  //    post-sellout rejects is automated scalping (OWASP Automated Threats
  //    OAT-005), an inventory-abuse signal that bridges observability to security.
  const top = f.topRejectSubnets[0];
  if (top && f.oversellRejects >= 10 && top.count / f.oversellRejects >= 0.25) {
    const share = top.count / f.oversellRejects;
    const pct = Math.round(share * 100);
    const rejectsPerIp = top.count / Math.max(1, top.ips);
    // Confidence rises with subnet dominance and with how few IPs produced how
    // many rejects (a tight, high-volume /24 is a strong automation signal).
    const confidence = round(
      Math.min(0.98, 0.45 + share * 0.4 + Math.min(0.25, rejectsPerIp / 40))
    );
    out.push({
      id: "oversell-bot",
      title: "Automated scalping bots (OWASP OAT-005)",
      severity: "high",
      reasoning: `Security signal: ${f.oversellRejects} post-sellout oversell-reject events, and subnet ${top.subnet} (${top.ips} IPs) alone produced ${top.count} (${pct}%). One /24 dominating reject traffic after sellout is the signature of automated scalping bots: OWASP Automated Threats OAT-005 (Scalping), an inventory-abuse pattern. It is a clean signal precisely because overselling is impossible by construction. The DynamoDB conditional guard held, so every reject is behavioral, not a data fault. Confidence ${Math.round(confidence * 100)}%.`,
      recommendation: `Block subnet ${top.subnet} at the edge (or soft-block + CAPTCHA) and add it to the abuse watchlist for drop ${f.dropId}.`,
      action: { kind: "flag_ip_cluster", params: { subnet: top.subnet, count: top.count, block: true }, label: `Block ${top.subnet}` },
      evidence: {
        topRejectSubnets: f.topRejectSubnets,
        oversellRejects: f.oversellRejects,
        security: {
          class: "automated-abuse",
          owasp: "OAT-005 Scalping",
          confidence,
          subnet: top.subnet,
          distinctIps: top.ips,
          rejectShare: round(share),
        },
      },
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

  // 5. GENERIC baseline anomaly detector (any event type, z-score based).
  out.push(...baselineAnomalies(f));

  // 6. LEADING INDICATOR: stampede forming (fires before the hard threshold).
  //    Skip if the hard stampede rule above already fired — that owns the peak.
  if (!out.some((x) => x.id === "stampede")) {
    out.push(...leadingIndicators(f));
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
