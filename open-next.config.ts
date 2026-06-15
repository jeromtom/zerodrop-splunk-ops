import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal OpenNext config: deploy the Next app to Cloudflare Workers with the
// Node.js runtime (nodejs_compat). No incremental cache override needed for the
// demo. See https://opennext.js.org/cloudflare for cache/queue options.
export default defineCloudflareConfig();
