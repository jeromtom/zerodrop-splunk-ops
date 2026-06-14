/**
 * DropWatch offline demo — `npm run ops:demo`.
 *
 * Fully self-contained: no Splunk account, no LLM keys, no Next.js build.
 * Synthesizes a realistic flash-drop telemetry stream (with a planted stampede
 * + oversell-bot incident), seeds the local telemetry buffer (the same buffer
 * the /ops dashboard reads), runs the DropWatch agent end-to-end, and prints a
 * severity-ranked ops report.
 *
 * If SPLUNK_HEC_URL / AIMLAPI_API_KEY / SPLUNK_HOSTED_MODEL_URL are set, the
 * same code path will ship to Splunk and use a real LLM — see the printed
 * telemetrySource / llmTier.
 *
 * Run:  node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/ops-demo.mts
 */
import { synthesize } from "../lib/dropwatch/synth";
import { clearBuffer, seedBuffer } from "../lib/dropwatch/sink";
import { scan } from "../lib/dropwatch/agent";

const SEV_ICON: Record<string, string> = {
  critical: "[CRIT]",
  high: "[HIGH]",
  medium: "[MED ]",
  low: "[LOW ]",
  info: "[INFO]",
};

async function main() {
  console.log("\n=== DropWatch — agentic ops monitor (offline demo) ===\n");

  // 1. Synthesize a realistic drop with planted incidents.
  const stream = synthesize();
  console.log(`Drop: ${stream.dropName} (${stream.dropId}), stock ${stream.totalStock}`);
  console.log(`Synthesized ${stream.events.length} telemetry events.`);

  // 2. Seed the local buffer (== what HEC would have populated in Splunk).
  clearBuffer();
  seedBuffer(stream.events);

  // 3. Run the agent: pull -> summarise -> reason -> score.
  const report = await scan({ dropId: stream.dropId, windowMin: 15 });

  console.log(`\nTelemetry source : ${report.telemetrySource}`);
  console.log(`LLM tier         : ${report.llmTier} (llmUsed=${report.llmUsed})`);
  console.log(`SPL              : ${report.spl}`);
  console.log(`\n--- Features ---`);
  console.log(
    JSON.stringify(
      {
        claimsPerMin: report.features.claimsPerMin,
        peakClaimsPerMin: report.features.peakClaimsPerMin,
        stampedeRatio: report.features.stampedeRatio,
        oversellRejects: report.features.oversellRejects,
        oversellRejectRate: report.features.oversellRejectRate,
        topRejectIps: report.features.topRejectIps,
        holdExpiries: report.features.holdExpiries,
        holdExpiryRate: report.features.holdExpiryRate,
        waitlistAdds: report.features.waitlistAdds,
        waitlistConversion: report.features.waitlistConversion,
      },
      null,
      2
    )
  );

  console.log(`\n--- Drop health score: ${report.healthScore}/100 ---\n`);
  console.log(`DropWatch findings (${report.findings.length}):\n`);
  for (const f of report.findings) {
    console.log(`${SEV_ICON[f.severity] ?? "[----]"} ${f.title}`);
    console.log(`        why : ${f.reasoning}`);
    console.log(`        fix : ${f.recommendation}`);
    if (f.action && f.action.kind !== "none")
      console.log(`        action: ${f.action.kind} -> "${f.action.label}"`);
    console.log("");
  }
  console.log("=== end ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
