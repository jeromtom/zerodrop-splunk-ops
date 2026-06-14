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
    "guarantee intact: zero oversell in telemetry",
    !stream.events.some((e) => Number((e.meta as { oversold?: number })?.oversold) > 0)
  );

  // --- Scenario B: healthy drop is NOT flagged ------------------------------
  clearBuffer();
  const calm = synthesize({ withIncident: false, seed: 7, dropId: "calm-drop" });
  seedBuffer(calm.events);
  const calmReport = await scan({ dropId: "calm-drop" });
  const calmIds = new Set(calmReport.findings.map((f) => f.id));
  check("healthy drop not flagged for stampede", !calmIds.has("stampede"));
  check("healthy drop scores high", calmReport.healthScore >= 90, String(calmReport.healthScore));

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
