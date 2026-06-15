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

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
