// Generate DropWatch Devpost gallery slides (3:2, 1800x1200) that reproduce the
// real /ops UI in the brand's HUD style. Rendered from SVG via sharp.
//   node scripts/make-gallery.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "D:/jeromtom/hackathoner/dropwatch-slides";
mkdirSync(OUT, { recursive: true });

const W = 1800, H = 1200;
const C = {
  bg: "#05090a", panel: "#0c1416", line: "#1c2b2a", accent: "#34d3a8", accent2: "#5cf2c4",
  text: "#e7f2ef", muted: "#7c948e", faint: "#4d635e", alert: "#f5b942", crit: "#fb7185", sky: "#7cc6ff",
};
const SANS = "'Segoe UI','Helvetica Neue',Arial,sans-serif";
const MONO = "'Consolas','DejaVu Sans Mono',monospace";

let grid = "";
for (let x = 0; x <= W; x += 60) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${C.accent}" stroke-opacity=".045"/>`;
for (let y = 0; y <= H; y += 60) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.accent}" stroke-opacity=".045"/>`;

const bl = 60, bw = 4, m = 30;
const bracket = (x, y, dx, dy) =>
  `<path d="M ${x + dx * bl} ${y} L ${x} ${y} L ${x} ${y + dy * bl}" stroke="${C.accent}" stroke-width="${bw}" fill="none"/>`;

// rounded panel with a HUD corner bracket (top-left)
function panel(x, y, w, h, fill = C.panel, stroke = C.line) {
  const b = 16;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <path d="M ${x + b} ${y} L ${x} ${y} L ${x} ${y + b}" stroke="${C.accent}" stroke-width="3" fill="none"/>`;
}
const chip = (x, y, w, txt, col = C.accent, fill = "none") =>
  `<rect x="${x}" y="${y}" width="${w}" height="46" rx="8" fill="${fill}" stroke="${col}" stroke-opacity=".5"/>
   <text x="${x + w / 2}" y="${y + 30}" text-anchor="middle" font-family="${MONO}" font-size="20" fill="${col}">${txt}</text>`;

function frame(inner, { label, caption }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}">
    <defs><radialGradient id="g" cx="50%" cy="-5%" r="80%">
      <stop offset="0%" stop-color="${C.accent}" stop-opacity=".16"/>
      <stop offset="55%" stop-color="${C.accent}" stop-opacity=".03"/>
      <stop offset="100%" stop-color="${C.bg}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <g>${grid}</g>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${bracket(m, m, 1, 1)} ${bracket(W - m, m, -1, 1)} ${bracket(m, H - m, 1, -1)} ${bracket(W - m, H - m, -1, -1)}
    <text x="90" y="118" font-size="40" font-weight="700" letter-spacing="-1" fill="${C.text}">Drop<tspan fill="${C.accent}">Watch</tspan></text>
    <circle cx="${W - 410}" cy="104" r="6" fill="${C.accent}"/>
    <text x="${W - 392}" y="111" font-family="${MONO}" font-size="20" letter-spacing="2" fill="${C.muted}">${label}</text>
    ${inner}
    <text x="90" y="${H - 78}" font-size="30" font-weight="600" fill="${C.text}">${caption}</text>
    <text x="${W - 90}" y="${H - 78}" text-anchor="end" font-family="${MONO}" font-size="22" fill="${C.accent}">dropwatch.jeromtom.com</text>
  </svg>`;
}

// ---- Slide 1: cover / overview ----------------------------------------------
const s1 = frame(`
  <text x="90" y="430" font-size="118" font-weight="700" letter-spacing="-3" fill="${C.text}">Provable correctness,</text>
  <text x="90" y="556" font-size="118" font-weight="700" letter-spacing="-3" fill="${C.accent}">clean signals.</text>
  <text x="92" y="640" font-size="38" fill="${C.muted}">An LLM agent reads Splunk telemetry back out, scores it, detects, and acts — on its own.</text>
  <g>${chip(92, 720, 240, "telemetry: mcp", C.accent2, "rgba(52,211,168,.10)")}
     ${chip(348, 720, 200, "oversold: 0", C.muted)}
     ${chip(564, 720, 250, "OWASP OAT-005", C.muted)}
     ${chip(830, 720, 270, "Foundation-Sec", C.muted)}</g>
  <text x="92" y="900" font-family="${MONO}" font-size="30" fill="${C.faint}">pull <tspan fill="${C.accent}">→</tspan> summarize <tspan fill="${C.accent}">→</tspan> reason <tspan fill="${C.accent}">→</tspan> score <tspan fill="${C.accent}">→</tspan> recommend <tspan fill="${C.accent}">→</tspan> apply <tspan fill="${C.accent}">→</tspan> page</text>
`, { label: "AGENTIC OBSERVABILITY · SPLUNK", caption: "DropWatch — agentic ops on Splunk, starting with oversell-proof flash drops" });

// ---- Slide 2: /ops dashboard ------------------------------------------------
const stat = (x, y, label, val, col = C.text) =>
  `${panel(x, y, 250, 150)}<text x="${x + 26}" y="${y + 44}" font-family="${MONO}" font-size="18" letter-spacing="2" fill="${C.faint}">${label}</text>
   <text x="${x + 26}" y="${y + 110}" font-family="${MONO}" font-size="46" font-weight="700" fill="${col}">${val}</text>`;
const s2 = frame(`
  <text x="90" y="240" font-family="${MONO}" font-size="22" letter-spacing="2" fill="${C.accent}">// THE /ops DASHBOARD</text>
  <text x="${W - 90}" y="240" text-anchor="end" font-family="${MONO}" font-size="22" fill="${C.muted}">telemetry: <tspan fill="${C.accent2}">mcp</tspan>  ·  LLM: <tspan fill="${C.accent2}">aiml</tspan></text>
  ${panel(90, 280, 380, 360)}
  <text x="280" y="350" text-anchor="middle" font-family="${MONO}" font-size="20" letter-spacing="2" fill="${C.faint}">DROP-HEALTH</text>
  <text x="280" y="500" text-anchor="middle" font-family="${MONO}" font-size="150" font-weight="700" fill="${C.alert}">42</text>
  <text x="280" y="560" text-anchor="middle" font-family="${MONO}" font-size="26" fill="${C.muted}">/ 100 · 3 findings</text>
  ${stat(500, 280, "PEAK CLAIMS/MIN", "65", C.accent)}
  ${stat(770, 280, "STAMPEDE RATIO", "7.2x", C.alert)}
  ${stat(1040, 280, "OVERSELL REJECTS", "140", C.crit)}
  ${stat(500, 460, "WAITLIST ADDS", "58", C.text)}
  ${stat(770, 460, "HOLD EXPIRIES", "18", C.text)}
  ${stat(1040, 460, "CHECKOUTS", "61", C.accent)}
  ${panel(1320, 280, 390, 360)}
  <text x="1346" y="330" font-family="${MONO}" font-size="18" letter-spacing="2" fill="${C.faint}">LIVE TELEMETRY · mcp</text>
  ${["claim ✓|" + C.accent, "oversell_reject ⚠|" + C.crit, "claim ✓|" + C.accent, "waitlist_add|" + C.muted, "oversell_reject ⚠|" + C.crit, "checkout $|" + C.accent, "hold_expiry|" + C.alert].map((r, i) => { const [t, c] = r.split("|"); return `<text x="1346" y="${376 + i * 34}" font-family="${MONO}" font-size="20" fill="${c}">${t}</text>`; }).join("")}
  ${panel(90, 680, 1620, 360)}
  <rect x="90" y="680" width="8" height="360" rx="4" fill="${C.crit}"/>
  <text x="130" y="740" font-size="34" font-weight="700" fill="${C.text}">Oversell-attempt bot cluster</text>
  <rect x="1480" y="712" width="170" height="48" rx="10" fill="${C.crit}" fill-opacity=".15" stroke="${C.crit}" stroke-opacity=".5"/>
  <text x="1565" y="743" text-anchor="middle" font-family="${MONO}" font-size="22" font-weight="700" fill="${C.crit}">CRITICAL</text>
  <text x="130" y="800" font-size="26" fill="${C.muted}">140 oversell-reject events; subnet 10.66.6.0/24 (12 IPs) alone produced 75 (54%) after sellout.</text>
  <text x="130" y="852" font-size="26" fill="${C.accent}">→ Flag IP cluster 10.66.6.0/24 for soft-block / CAPTCHA, then auto-page on-call.</text>
  <rect x="130" y="908" width="320" height="64" rx="12" fill="${C.text}"/>
  <text x="290" y="949" text-anchor="middle" font-size="26" font-weight="700" fill="${C.bg}">Block subnet</text>
  <text x="478" y="949" font-family="${MONO}" font-size="20" fill="${C.faint}">source: mcp · run_splunk_search</text>
`, { label: "LIVE AGENT DASHBOARD", caption: "Reads Splunk back, scores drop-health 0–100, recommends one action you apply in a click" });

// ---- Slide 3: MCP pull path -------------------------------------------------
const ladder = (x, y, active) => {
  const items = [["Splunk MCP Server", "mcp"], ["Splunk REST", "rest"], ["local buffer", "buffer"]];
  let out = "", cx = x;
  items.forEach(([lbl, key], i) => {
    const on = key === active;
    const w = 40 + lbl.length * 17;
    out += `<rect x="${cx}" y="${y}" width="${w}" height="64" rx="12" fill="${on ? "rgba(52,211,168,.14)" : "none"}" stroke="${on ? C.accent : C.line}" stroke-width="${on ? 2.5 : 1.5}"/>
      <text x="${cx + w / 2}" y="${y + 41}" text-anchor="middle" font-family="${MONO}" font-size="24" font-weight="${on ? 700 : 400}" fill="${on ? C.accent2 : C.faint}">${lbl}</text>`;
    cx += w;
    if (i < 2) { out += `<text x="${cx + 24}" y="${y + 42}" font-size="30" fill="${C.faint}">→</text>`; cx += 64; }
  });
  return out;
};
const s3 = frame(`
  <text x="90" y="250" font-family="${MONO}" font-size="22" letter-spacing="2" fill="${C.accent}">// BEST USE OF THE SPLUNK MCP SERVER</text>
  <text x="90" y="350" font-size="64" font-weight="700" fill="${C.text}">Telemetry pulled over MCP — end to end</text>
  <text x="92" y="412" font-size="32" fill="${C.muted}">The agent's read step is a tool call: <tspan font-family="${MONO}" fill="${C.accent}">run_splunk_search</tspan> over MCP JSON-RPC.</text>
  ${panel(90, 480, 1620, 240)}
  <text x="130" y="548" font-family="${MONO}" font-size="20" letter-spacing="2" fill="${C.faint}">TELEMETRY PULL PATH</text>
  ${ladder(130, 588, "mcp")}
  <text x="130" y="700" font-family="${MONO}" font-size="20" fill="${C.faint}">active: <tspan fill="${C.accent2}">mcp</tspan> · falls back REST → buffer, so the agent never goes dark</text>
  ${panel(90, 760, 1620, 220)}
  <text x="130" y="826" font-family="${MONO}" font-size="20" letter-spacing="2" fill="${C.faint}">SPL ISSUED VIA MCP</text>
  <text x="130" y="884" font-family="${MONO}" font-size="27" fill="${C.accent2}">search index=zerodrop sourcetype=zerodrop:telemetry</text>
  <text x="130" y="924" font-family="${MONO}" font-size="27" fill="${C.accent2}">  dropId="aura-1-lunar" earliest=-15m | sort 0 -_time | head 1000</text>
  <text x="130" y="958" font-family="${MONO}" font-size="20" fill="${C.faint}">→ 439 events returned over the MCP tool contract</text>
`, { label: "MCP · run_splunk_search", caption: "Treats Splunk as a tool surface over MCP — portable to any MCP-aware host" });

// ---- Slide 4: security / OAT-005 --------------------------------------------
const s4 = frame(`
  <text x="90" y="250" font-family="${MONO}" font-size="22" letter-spacing="2" fill="${C.accent}">// SECURITY · ZERO FALSE POSITIVES BY CONSTRUCTION</text>
  <text x="90" y="350" font-size="64" font-weight="700" fill="${C.text}">Observability that bridges to the SOC</text>
  <text x="92" y="412" font-size="31" fill="${C.muted}">Overselling is impossible by construction, so an oversell-reject can only be a bot — not a bug.</text>
  ${panel(90, 470, 1620, 470)}
  <rect x="90" y="470" width="8" height="470" rx="4" fill="${C.crit}"/>
  <text x="130" y="540" font-size="38" font-weight="700" fill="${C.text}">Scalping-bot cluster (OWASP OAT-005)</text>
  <rect x="1430" y="508" width="220" height="50" rx="10" fill="${C.crit}" fill-opacity=".15" stroke="${C.crit}" stroke-opacity=".5"/>
  <text x="1540" y="542" text-anchor="middle" font-family="${MONO}" font-size="22" font-weight="700" fill="${C.crit}">CRITICAL</text>
  <g font-family="${MONO}">
    ${chip(130, 580, 250, "OAT-005 · Scalping", C.crit, "rgba(251,113,133,.10)")}
    ${chip(396, 580, 230, "confidence 0.94", C.alert)}
    ${chip(642, 580, 250, "Foundation-Sec", C.accent)}
  </g>
  <text x="130" y="700" font-size="28" fill="${C.muted}">Subnet 10.66.6.0/24 produced 54% of all oversell-rejects in the 90s after sellout —</text>
  <text x="130" y="742" font-size="28" fill="${C.muted}">a tight cluster no real buyer pattern explains. Reasoned by Splunk's Foundation-Sec model.</text>
  <text x="130" y="812" font-size="28" fill="${C.accent}">→ Block 10.66.6.0/24 (soft-block / CAPTCHA) and auto-page on-call via webhook.</text>
  <rect x="130" y="858" width="300" height="60" rx="12" fill="${C.text}"/>
  <text x="280" y="897" text-anchor="middle" font-size="25" font-weight="700" fill="${C.bg}">Block subnet</text>
  <text x="458" y="897" font-family="${MONO}" font-size="20" fill="${C.faint}">detect → block → page → document in Splunk</text>
`, { label: "BEST OF SECURITY", caption: "Provable correctness makes the reject stream a zero-false-positive bot signal" });

// ---- Slide 5: AI Agent Monitoring -------------------------------------------
const metric = (x, y, label, val, col = C.text) =>
  `${panel(x, y, 360, 150)}<text x="${x + 28}" y="${y + 48}" font-family="${MONO}" font-size="19" letter-spacing="2" fill="${C.faint}">${label}</text>
   <text x="${x + 28}" y="${y + 112}" font-family="${MONO}" font-size="42" font-weight="700" fill="${col}">${val}</text>`;
const s5 = frame(`
  <text x="90" y="250" font-family="${MONO}" font-size="22" letter-spacing="2" fill="${C.accent}">// AI AGENT MONITORING PARITY</text>
  <text x="90" y="350" font-size="64" font-weight="700" fill="${C.text}">The agent watches its own reasoning</text>
  <text x="92" y="412" font-size="32" fill="${C.muted}">Every scan ships its runtime to Splunk as <tspan font-family="${MONO}" fill="${C.accent}">dropwatch:agent</tspan> — observable like the app it watches.</text>
  ${metric(90, 480, "LLM TIER", "aiml", C.accent2)}
  ${metric(480, 480, "LLM LATENCY", "4032 ms")}
  ${metric(870, 480, "TOKENS (in/out)", "812 / 410")}
  ${metric(1260, 480, "EST. COST", "$0.0003", C.accent)}
  ${metric(90, 660, "CONFIDENCE", "0.86", C.accent)}
  ${metric(480, 660, "DRIFT", "low", C.accent)}
  ${metric(870, 660, "SCAN TIME", "5043 ms")}
  ${metric(1260, 660, "FALLBACKS", "0 / 7", C.accent)}
  ${panel(90, 860, 1620, 130)}
  <text x="130" y="918" font-family="${MONO}" font-size="22" fill="${C.faint}">sourcetype=<tspan fill="${C.accent2}">dropwatch:agent</tspan>  ·  LLM tier · latency · tokens · cost · confidence · drift → Splunk</text>
  <text x="130" y="956" font-family="${MONO}" font-size="20" fill="${C.faint}">same dimensions Splunk's AI Agent Monitoring tracks — surfaced in the /ops "Agent runtime" panel</text>
`, { label: "dropwatch:agent", caption: "Self-observability: token cost, confidence and drift, shipped to Splunk" });

const slides = [
  ["DropWatch-slide-1-overview.png", s1],
  ["DropWatch-slide-2-ops-dashboard.png", s2],
  ["DropWatch-slide-3-mcp.png", s3],
  ["DropWatch-slide-4-security.png", s4],
  ["DropWatch-slide-5-agent-monitoring.png", s5],
];

for (const [name, svg] of slides) {
  await sharp(Buffer.from(svg), { density: 96 }).resize(W, H).png().toFile(`${OUT}/${name}`);
  console.log("wrote", name);
}
console.log("\nAll slides in:", OUT);
