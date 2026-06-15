import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output so the OpenNext Cloudflare adapter can bundle a manual
  // (webpack) build via `--skipNextBuild` (Turbopack server chunks don't load
  // under OpenNext on Workers — see ChunkLoadError).
  output: "standalone",
  // Default the agent's telemetry pull path to the app's own self-hosted
  // Splunk-MCP-contract route (app/api/mcp). A relative value is resolved
  // against the request origin at runtime (lib/dropwatch/search.ts ->
  // resolveMcpUrl), so a deployed /ops self-calls its own domain and shows
  // `telemetry: mcp` on any host — no platform env needed. Override with a real
  // SPLUNK_MCP_URL (absolute https) to point at a live Splunk MCP Server.
  env: {
    SPLUNK_MCP_URL: process.env.SPLUNK_MCP_URL ?? "/api/mcp",
    SPLUNK_MCP_TOOL: process.env.SPLUNK_MCP_TOOL ?? "run_splunk_search",
  },
};

export default nextConfig;
