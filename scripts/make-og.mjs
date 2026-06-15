// Generate the social share image (public/og.png, 1200x630) for DropWatch.
// Futuristic HUD aesthetic matching the landing page. Rendered from SVG via sharp.
//   node scripts/make-og.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public/og.png");

const W = 1200, H = 630;
const accent = "#34d3a8", accent2 = "#5cf2c4", text = "#e7f2ef", muted = "#7c948e", faint = "#4d635e";

// grid lines
let grid = "";
for (let x = 0; x <= W; x += 48) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${accent}" stroke-opacity="0.05" stroke-width="1"/>`;
for (let y = 0; y <= H; y += 48) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${accent}" stroke-opacity="0.05" stroke-width="1"/>`;

const br = 26, bl = 56, bw = 4; // corner brackets
const bracket = (x, y, dx, dy) =>
  `<path d="M ${x + dx * bl} ${y} L ${x} ${y} L ${x} ${y + dy * bl}" stroke="${accent}" stroke-width="${bw}" fill="none"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="-5%" r="75%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.20"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#05090a" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="0.4"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#05090a"/>
  <g>${grid}</g>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${bracket(br, br, 1, 1)} ${bracket(W - br, br, -1, 1)}
  ${bracket(br, H - br, 1, -1)} ${bracket(W - br, H - br, -1, -1)}

  <g font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif">
    <!-- status chip -->
    <circle cx="92" cy="118" r="6" fill="${accent}"/>
    <text x="110" y="124" font-size="22" letter-spacing="3" fill="${muted}">AGENT ONLINE  ·  SPLUNK AGENTIC OPS</text>

    <!-- wordmark -->
    <text x="88" y="290" font-size="118" font-weight="700" letter-spacing="-2" fill="${text}">Drop<tspan fill="${accent}">Watch</tspan></text>

    <!-- tagline -->
    <text x="92" y="372" font-size="44" font-weight="600" fill="${text}">Provable correctness creates clean signals.</text>
    <text x="92" y="424" font-size="30" fill="${muted}">An LLM agent reads them back out of Splunk — scores, detects, acts.</text>

    <!-- chips row -->
    <g font-size="22" font-weight="600" letter-spacing="1">
      <rect x="90" y="486" rx="6" width="232" height="48" fill="${accent}" fill-opacity="0.10" stroke="${accent}" stroke-opacity="0.5"/>
      <text x="116" y="517" fill="${accent2}">telemetry: mcp</text>
      <rect x="338" y="486" rx="6" width="196" height="48" fill="none" stroke="${accent}" stroke-opacity="0.25"/>
      <text x="362" y="517" fill="${muted}">oversold: 0</text>
      <rect x="550" y="486" rx="6" width="250" height="48" fill="none" stroke="${accent}" stroke-opacity="0.25"/>
      <text x="574" y="517" fill="${muted}">OWASP OAT-005</text>
    </g>

    <!-- url -->
    <text x="${W - 92}" y="124" text-anchor="end" font-size="24" font-weight="600" fill="${accent}">dropwatch.jeromtom.com</text>
    <text x="92" y="588" font-size="22" fill="${faint}">pull → summarize → reason → score → recommend → apply → page</text>
  </g>
</svg>`;

const buf = Buffer.from(svg);
await sharp(buf, { density: 144 }).png().toFile(out);
console.log("wrote", out);
