/**
 * `npm run ops:mcp` — proves DropWatch's Splunk MCP Server path end-to-end.
 *
 * Starts the local Splunk-MCP-contract server (scripts/mcp-server.mts), points
 * the agent at it via SPLUNK_MCP_URL, runs ONE scan, and asserts the telemetry
 * was pulled over MCP (telemetrySource === "mcp"). Fully offline, deterministic,
 * and screenshot-friendly for the demo video.
 *
 * Run:  node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/ops-mcp-demo.mts
 */
import { startMcpServer } from "./mcp-server.mts";

async function main() {
  const { server, url } = await startMcpServer(0); // ephemeral port
  process.env.SPLUNK_MCP_URL = url;

  // Import the agent AFTER setting env: search.ts reads SPLUNK_MCP_URL at load.
  const { scan } = await import("../lib/dropwatch/agent.ts");

  console.log(`\n=== DropWatch — Splunk MCP Server path (live, end-to-end) ===\n`);
  console.log(`MCP endpoint     : ${url}`);

  const report = await scan({ dropId: "aura-1-lunar", windowMin: 15 });

  console.log(`Telemetry source : ${report.telemetrySource}   <-- pulled over MCP`);
  console.log(`SPL via MCP      : ${report.spl}`);
  console.log(`Events returned  : ${report.eventCount}`);
  console.log(`LLM tier         : ${report.llmTier} (llmUsed=${report.llmUsed})`);
  console.log(`Health score     : ${report.healthScore}/100`);
  console.log(`Findings         : ${report.findings.length}`);
  for (const f of report.findings.slice(0, 5))
    console.log(`  [${f.severity.toUpperCase()}] ${f.title}`);

  server.close();

  if (report.telemetrySource !== "mcp") {
    console.error(`\nFAIL: expected telemetrySource=mcp, got "${report.telemetrySource}".`);
    process.exit(1);
  }
  if (report.eventCount === 0) {
    console.error(`\nFAIL: MCP returned 0 events — the row contract did not parse.`);
    process.exit(1);
  }
  console.log(
    `\nPASS: the agent pulled ${report.eventCount} events through the Splunk MCP Server` +
      ` tool contract (run_splunk_search) and reasoned over them.\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
