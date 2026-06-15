/**
 * DropWatch end-to-end test — `npm run ops:test`.
 *
 * Asserts the agent flags BOTH planted incidents (stampede + oversell-bot)
 * end-to-end through the real pipeline (synth -> buffer -> scan -> findings),
 * with zero Splunk/LLM keys (deterministic rules tier). Exits non-zero on
 * failure so it can gate CI.
 */
import { synthesize } from "../lib/dropwatch/synth";
import { clearBuffer, seedBuffer, recent } from "../lib/dropwatch/sink";
import { scan } from "../lib/dropwatch/agent";
import { applyAction, clearActions } from "../lib/dropwatch/actions";
import type { DropEvent } from "../lib/dropwatch/events";

/**
 * Build a GRADUAL claim ramp (accelerating but below the hard stampede
 * threshold) to exercise the leading-indicator / early-warning detector.
 */
function rampStream(dropId: string, perMin: number[]): DropEvent[] {
  const events: DropEvent[] = [];
  const base = Date.now() - (perMin.length + 1) * 60_000;
  for (let m = 0; m < perMin.length; m++) {
    for (let k = 0; k < perMin[m]; k++) {
      const t = base + m * 60_000 + k * 1500;
      events.push({
        time: new Date(t).toISOString(),
        event: "claim",
        dropId,
        ip: `73.1.2.${k % 250}`,
        position: k,
      });
    }
  }
  return events;
}

/**
 * Build a CALM oversell-bot stream: a normal claim baseline (no stampede) plus a
 * cluster of post-sellout oversell-rejects dominated by one /24 subnet. Yields
 * the oversell-bot security finding WITHOUT saturating the health penalty, so the
 * recovery climb is observable (mirrors the live single-finding /ops scan).
 */
function botStream(dropId: string): DropEvent[] {
  const events: DropEvent[] = [];
  const base = Date.now() - 6 * 60_000;
  // Baseline claims: ~3/min for 5 min (well below the stampede threshold).
  for (let m = 0; m < 5; m++) {
    for (let k = 0; k < 3; k++) {
      events.push({
        time: new Date(base + m * 60_000 + k * 1000).toISOString(),
        event: "claim",
        dropId,
        ip: `73.10.${m}.${k}`,
        position: m * 3 + k,
      });
    }
  }
  // 20 oversell-rejects spread evenly; ~half from the bot subnet 10.66.6.0/24.
  for (let i = 0; i < 20; i++) {
    const fromBot = i % 9 < 4;
    const ip = fromBot ? `10.66.6.${(i % 12) + 1}` : `73.${i}.${(i * 3) % 255}.${(i * 7) % 255}`;
    events.push({
      time: new Date(base + (i % 5) * 60_000 + 30_000 + i * 200).toISOString(),
      event: "oversell_reject",
      dropId,
      ip,
      position: i,
    });
  }
  return events;
}

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? "  -- " + detail : ""}`);
  }
}

async function main() {
  console.log("\nDropWatch e2e test\n");

  // --- Scenario A: planted incident is detected -----------------------------
  clearBuffer();
  const stream = synthesize({ withIncident: true, seed: 7 });
  seedBuffer(stream.events);
  check("telemetry buffered", recent({ dropId: stream.dropId }).length > 100);

  const report = await scan({ dropId: stream.dropId });
  const ids = new Set(report.findings.map((f) => f.id));

  check("stampede detected", ids.has("stampede"), [...ids].join(","));
  check("oversell-bot detected", ids.has("oversell-bot"), [...ids].join(","));

  const bot = report.findings.find((f) => f.id === "oversell-bot");
  check(
    "oversell-bot action is flag_ip_cluster",
    bot?.action?.kind === "flag_ip_cluster",
    bot?.action?.kind
  );
  const botSec = (bot?.evidence as Record<string, any> | undefined)?.security;
  check(
    "oversell-bot framed as OWASP OAT-005 security finding",
    botSec?.owasp === "OAT-005 Scalping" && typeof botSec?.confidence === "number",
    `owasp=${botSec?.owasp} confidence=${botSec?.confidence}`
  );
  const stampede = report.findings.find((f) => f.id === "stampede");
  check(
    "stampede action is enable_throttle",
    stampede?.action?.kind === "enable_throttle",
    stampede?.action?.kind
  );
  check("health score degraded", report.healthScore < 80, String(report.healthScore));
  check("findings severity-ranked", report.findings[0].severity === "critical" || report.findings[0].severity === "high");
  check(
    "agent self-observability recorded",
    report.agent != null && report.agent.scans >= 1 && typeof report.agent.lastTier === "string",
    report.agent ? `tier=${report.agent.lastTier} scanMs=${report.agent.lastScanMs}ms` : "missing"
  );
  check(
    "agent monitoring tracks cost + confidence + drift",
    typeof report.agent?.totalCostUsd === "number" &&
      typeof report.agent?.avgConfidence === "number" &&
      typeof report.agent?.lastDrift === "number",
    `cost=${report.agent?.totalCostUsd} conf=${report.agent?.avgConfidence} drift=${report.agent?.lastDrift}`
  );
  check(
    "guarantee intact: zero oversell in telemetry",
    !stream.events.some((e) => Number((e.meta as { oversold?: number })?.oversold) > 0)
  );
  // Generic baseline anomaly detector flags the injected rate spike (any type).
  check(
    "generic anomaly detector flags rate spike",
    [...ids].some((id) => id.startsWith("anomaly-")),
    [...ids].join(",")
  );

  // --- Scenario B: healthy drop is NOT flagged ------------------------------
  clearBuffer();
  const calm = synthesize({ withIncident: false, seed: 7, dropId: "calm-drop" });
  seedBuffer(calm.events);
  const calmReport = await scan({ dropId: "calm-drop" });
  const calmIds = new Set(calmReport.findings.map((f) => f.id));
  check("healthy drop not flagged for stampede", !calmIds.has("stampede"));
  check("healthy drop scores high", calmReport.healthScore >= 90, String(calmReport.healthScore));
  // Generic anomaly detector must NOT false-positive on the calm baseline.
  check(
    "generic anomaly detector quiet on healthy drop",
    ![...calmIds].some((id) => id.startsWith("anomaly-")),
    [...calmIds].join(",")
  );

  // --- Scenario C: leading indicator fires BEFORE the hard stampede ---------
  clearBuffer();
  const dropId = "ramp-drop";
  // Accelerating ramp, peak 14/min — below the hard stampede threshold (>=20).
  seedBuffer(rampStream(dropId, [2, 4, 7, 11, 14]));
  const rampReport = await scan({ dropId });
  const rampIds = new Set(rampReport.findings.map((f) => f.id));
  check("leading indicator: stampede-forming detected", rampIds.has("stampede-forming"), [...rampIds].join(","));
  check("leading indicator fires before hard stampede", rampIds.has("stampede-forming") && !rampIds.has("stampede"));

  // --- Scenario D: recovery loop — apply remediation, drop-health recovers ---
  // detect -> act -> RECOVER. After the operator blocks the bot subnet, the next
  // scan must downgrade that finding to a mitigated INFO and health must climb.
  clearActions();
  clearBuffer();
  seedBuffer(botStream("recover-drop"));
  const before = await scan({ dropId: "recover-drop" });
  const botBefore = before.findings.find((f) => f.id === "oversell-bot");
  check(
    "recovery: bot finding active before remediation",
    botBefore != null && botBefore.severity !== "info",
    `severity=${botBefore?.severity}`
  );
  // Operator clicks "Block" on the recommended subnet.
  if (botBefore?.action) applyAction(botBefore.id, botBefore.action);
  const after = await scan({ dropId: "recover-drop" });
  const botAfter = after.findings.find((f) => f.id === "oversell-bot");
  check(
    "recovery: bot finding downgraded to mitigated INFO after Block",
    botAfter?.severity === "info" && /mitigated/i.test(botAfter?.title ?? ""),
    `severity=${botAfter?.severity} title=${botAfter?.title}`
  );
  check(
    "recovery: drop-health climbs after remediation applied",
    after.healthScore > before.healthScore,
    `before=${before.healthScore} after=${after.healthScore}`
  );

  // Stateless hint path: on serverless runtimes the apply and the scan can land
  // on different isolates, so the in-memory log is empty. The scan's appliedKinds
  // param carries the operator's session remediations and still drives recovery.
  clearActions();
  clearBuffer();
  seedBuffer(botStream("hint-drop"));
  const hinted = await scan({ dropId: "hint-drop", appliedKinds: ["flag_ip_cluster"] });
  const botHint = hinted.findings.find((f) => f.id === "oversell-bot");
  check(
    "recovery: stateless hint mitigates the bot finding",
    botHint?.severity === "info" && /mitigated/i.test(botHint?.title ?? ""),
    `severity=${botHint?.severity} title=${botHint?.title}`
  );
  clearActions();

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
