import { WaitlistForm } from "@/components/WaitlistForm";

const CSS = `
.dw{--accent:#34d3a8;--accent2:#5cf2c4;--alert:#f5b942;--crit:#fb7185;--text:#e7f2ef;--muted:#7c948e;--faint:#4d635e;--line:rgba(52,211,168,.16);--line2:rgba(52,211,168,.3);--panel:rgba(14,22,24,.72);--display:'Chakra Petch',system-ui,sans-serif;--body:'IBM Plex Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace;
  position:relative;min-height:100vh;width:100%;overflow:hidden;background:#05090a;color:var(--text);font-family:var(--body);line-height:1.55;-webkit-font-smoothing:antialiased}
.dw::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:
  radial-gradient(900px 520px at 50% -8%, rgba(52,211,168,.16), transparent 60%),
  radial-gradient(700px 700px at 88% 18%, rgba(52,211,168,.06), transparent 60%),
  radial-gradient(600px 600px at 8% 60%, rgba(245,185,66,.05), transparent 60%)}
.dw::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background-image:linear-gradient(rgba(52,211,168,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(52,211,168,.05) 1px,transparent 1px);
  background-size:46px 46px;-webkit-mask-image:radial-gradient(circle at 50% 22%,#000 0,transparent 80%);mask-image:radial-gradient(circle at 50% 22%,#000 0,transparent 80%)}
.dw .scan{position:absolute;left:0;right:0;top:0;height:160px;z-index:0;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(52,211,168,.05),transparent);animation:dwsweep 7s linear infinite}
@keyframes dwsweep{0%{transform:translateY(-180px)}100%{transform:translateY(100vh)}}
.dw a{color:var(--accent);text-decoration:none;transition:color .15s}
.dw a:hover{color:var(--accent2)}
.dw .wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:0 24px}
.dw header{display:flex;align-items:center;justify-content:space-between;padding:26px 0}
.dw .brand{font-family:var(--display);font-weight:700;font-size:25px;letter-spacing:.5px}
.dw .brand b{color:var(--accent);text-shadow:0 0 16px rgba(52,211,168,.5)}
.dw .status{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;letter-spacing:1.5px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:7px 13px;text-transform:uppercase;background:var(--panel)}
.dw .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);animation:dwpulse 1.7s ease-in-out infinite}
@keyframes dwpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.dw .hud{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:6px;backdrop-filter:blur(8px)}
.dw .hud::before,.dw .hud::after{content:"";position:absolute;width:11px;height:11px;pointer-events:none}
.dw .hud::before{top:-1px;left:-1px;border-top:2px solid var(--accent);border-left:2px solid var(--accent)}
.dw .hud::after{bottom:-1px;right:-1px;border-bottom:2px solid var(--accent);border-right:2px solid var(--accent)}
.dw .hero{padding:46px 0 8px;text-align:center}
.dw .eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:5px;color:var(--accent);text-transform:uppercase;text-shadow:0 0 14px rgba(52,211,168,.35)}
.dw h1{font-family:var(--display);font-weight:700;font-size:clamp(38px,7vw,74px);line-height:1.02;letter-spacing:-1px;margin:18px 0 14px}
.dw h1 .glow{color:var(--accent);text-shadow:0 0 28px rgba(52,211,168,.45)}
.dw .sub{font-size:clamp(16px,2.3vw,20px);color:var(--muted);max-width:660px;margin:0 auto}
.dw .hero-cta{margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.dw .btn{font-family:var(--mono);font-size:13px;letter-spacing:1px;text-transform:uppercase;padding:13px 22px;border-radius:5px;border:1px solid var(--line2);color:var(--text);cursor:pointer;transition:.18s;background:transparent;display:inline-block}
.dw .btn:hover{border-color:var(--accent);box-shadow:0 0 22px rgba(52,211,168,.18)}
.dw .btn.primary{background:var(--accent);color:#03130d;border-color:var(--accent);font-weight:600}
.dw .btn.primary:hover{background:var(--accent2);box-shadow:0 0 30px rgba(52,211,168,.4)}
.dw .ticker{margin:34px 0 6px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.dw .ticker-track{display:inline-block;padding:11px 0;font-family:var(--mono);font-size:12.5px;letter-spacing:.4px;color:var(--faint);animation:dwslide 34s linear infinite}
.dw .ticker-track span{margin:0 8px}
.dw .tk-c{color:var(--accent)}.dw .tk-r{color:var(--alert)}.dw .tk-x{color:var(--crit)}.dw .tk-a{color:var(--accent2)}.dw .tk-d{color:var(--faint)}
@keyframes dwslide{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.dw .viewport{margin:30px auto 0;max-width:920px;border-radius:8px;overflow:hidden;border:1px solid var(--line2);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 40px 120px rgba(0,0,0,.6),0 0 70px rgba(52,211,168,.07)}
.dw .chrome{display:flex;align-items:center;gap:14px;padding:10px 16px;background:#0a1214;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--muted)}
.dw .lights{display:flex;gap:7px}
.dw .lights i{width:10px;height:10px;border-radius:50%;display:block}
.dw .lights i:nth-child(1){background:#fb7185}.dw .lights i:nth-child(2){background:#f5b942}.dw .lights i:nth-child(3){background:var(--accent)}
.dw .rec{margin-left:auto;color:var(--accent);display:inline-flex;align-items:center;gap:7px}
.dw .frame{aspect-ratio:16/9;background:#000}
.dw .frame iframe{width:100%;height:100%;border:0;display:block}
.dw .vp-note{text-align:center;font-family:var(--mono);font-size:12.5px;color:var(--muted);margin-top:14px}
.dw section{margin-top:64px}
.dw .label{font-family:var(--mono);font-size:12px;letter-spacing:2px;color:var(--accent);text-transform:uppercase;margin-bottom:18px}
.dw .label::before{content:"// ";color:var(--faint)}
.dw h2{font-family:var(--display);font-weight:600;font-size:clamp(24px,3.6vw,34px);letter-spacing:-.5px;margin:0 0 8px}
.dw .lead{color:var(--muted);max-width:680px;margin:0 0 26px}
.dw .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.dw .stat{padding:26px 22px}
.dw .stat .n{font-family:var(--display);font-weight:700;font-size:54px;color:var(--accent);line-height:1;text-shadow:0 0 24px rgba(52,211,168,.35)}
.dw .stat .l{margin-top:10px;color:var(--muted);font-size:14px;font-family:var(--mono)}
.dw .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.dw .step{padding:22px 20px}
.dw .step .sn{font-family:var(--mono);font-size:12px;color:var(--accent);letter-spacing:1px}
.dw .step b{display:block;font-family:var(--display);font-weight:600;font-size:17px;margin:12px 0 7px}
.dw .step span{color:var(--muted);font-size:14px}
.dw .flow{margin-top:22px;font-family:var(--mono);font-size:13px;color:var(--faint);text-align:center;overflow-wrap:anywhere}
.dw .flow b{color:var(--accent);font-weight:500}
.dw .proof{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center}
.dw .proof ul{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:11px}
.dw .proof li{display:flex;gap:10px;color:var(--text);font-size:14.5px}
.dw .proof li i{color:var(--accent);font-style:normal}
.dw .term{padding:0;overflow:hidden}
.dw .term .bar{display:flex;align-items:center;gap:7px;padding:11px 15px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:11px;color:var(--faint)}
.dw .term .bar i{width:9px;height:9px;border-radius:50%;background:#22302e;display:block}
.dw .term pre{margin:0;padding:18px 20px;overflow-x:auto;font-family:var(--mono);font-size:13px;line-height:1.7;color:#bfe9dc}
.dw .term .k{color:var(--accent)}.dw .term .c{color:var(--faint)}
.dw .beyond{display:grid;grid-template-columns:1.05fr 1fr;gap:16px;align-items:stretch}
.dw .beyond .big{padding:30px}
.dw .beyond .big p{color:var(--muted);margin:.6em 0 0}
.dw .idx{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dw .idx>div{padding:16px 18px}
.dw .idx b{display:block;font-family:var(--mono);font-size:13px;color:var(--text)}
.dw .idx span{color:var(--muted);font-size:13px}
.dw .mods{display:grid;gap:12px}
.dw .mod{display:flex;gap:18px;align-items:flex-start;padding:20px 22px}
.dw .mod .tag{flex-shrink:0;font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--accent);border:1px solid var(--line2);border-radius:999px;padding:5px 11px;margin-top:3px;background:rgba(52,211,168,.07);min-width:104px;text-align:center}
.dw .mod b{display:block;font-family:var(--display);font-weight:600;font-size:16px;margin-bottom:4px}
.dw .mod span{color:var(--muted);font-size:14px}
.dw .console{padding:34px;text-align:center}
.dw .console h2{margin-bottom:6px}
.dw .console p{color:var(--muted);margin:0 0 20px}
.dw form{display:flex;gap:0;max-width:480px;margin:0 auto;border:1px solid var(--line2);border-radius:6px;overflow:hidden;background:#070d0e}
.dw form .pr{display:flex;align-items:center;padding:0 14px;color:var(--accent);font-family:var(--mono);font-size:16px}
.dw input[type=email]{flex:1;background:transparent;border:0;color:var(--text);padding:15px 8px;font-size:15px;font-family:var(--mono);outline:none;min-width:0}
.dw input[type=email]::placeholder{color:var(--faint)}
.dw .wlbtn{font-family:var(--mono);font-size:13px;letter-spacing:1px;text-transform:uppercase;background:var(--accent);color:#03130d;border:0;padding:0 22px;font-weight:600;cursor:pointer;transition:.15s}
.dw .wlbtn:hover{background:var(--accent2)}.dw .wlbtn:disabled{opacity:.5;cursor:default}
.dw .msg{margin-top:13px;font-size:13px;font-family:var(--mono);min-height:18px}
.dw .msg.ok{color:var(--accent)}.dw .msg.err{color:var(--crit)}
.dw .chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:18px}
.dw .chips span{font-family:var(--mono);font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.dw .maker{display:flex;gap:24px;align-items:center;padding:26px 28px}
.dw .maker img{width:88px;height:88px;border-radius:50%;border:1px solid var(--accent);object-fit:cover;flex-shrink:0;box-shadow:0 0 24px rgba(52,211,168,.25)}
.dw .maker .ml{font-family:var(--mono);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--faint)}
.dw .maker .mn{font-family:var(--display);font-weight:600;font-size:22px;margin-top:3px}
.dw .maker .mb{color:var(--muted);font-size:14px;margin:8px 0 12px}
.dw .maker .mlk{display:flex;gap:16px;font-family:var(--mono);font-size:13px}
.dw footer{text-align:center;color:var(--muted);font-size:13px;font-family:var(--mono);padding:46px 0 56px;margin-top:60px;border-top:1px solid var(--line)}
.dw footer a{margin:0 2px}
.dw .rv{opacity:0;transform:translateY(14px);animation:dwrise .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes dwrise{to{opacity:1;transform:none}}
@media (max-width:820px){.dw .steps{grid-template-columns:repeat(2,1fr)}.dw .beyond,.dw .proof{grid-template-columns:1fr}}
@media (max-width:560px){.dw .stats,.dw .steps,.dw .idx{grid-template-columns:1fr}.dw .mod{flex-direction:column;gap:10px}.dw .maker{flex-direction:column;text-align:center}.dw .maker .mlk{justify-content:center}}
@media (prefers-reduced-motion:reduce){.dw *{animation:none!important}}
`;

const TICKER: [string, string][] = [
  ["claim ✓", "tk-c"], ["hold_create", "tk-d"], ["oversell_reject ⚠ 10.66.6.0/24", "tk-r"],
  ["claim ✓", "tk-c"], ["agent_scan health 75", "tk-a"], ["waitlist_add", "tk-d"], ["checkout $", "tk-c"],
  ["oversell_reject ⚠ 10.66.6.0/24", "tk-r"], ["OAT-005 scalping bot flagged", "tk-x"],
  ["agent_scan latency 5043ms cost $0.0003", "tk-a"], ["claim ✓", "tk-c"], ["block 10.66.6.0/24", "tk-x"],
  ["telemetry: mcp", "tk-a"], ["oversold 0", "tk-c"],
];

const STEPS = [
  ["01", "Instrument", "Every hot path emits a structured event: claim, hold, expiry, oversell-reject, waitlist, checkout."],
  ["02", "Ship to Splunk", "Events stream to Splunk over the HTTP Event Collector. Splunk is the system of record."],
  ["03", "Reason", "The agent pulls telemetry back via the MCP Server, reasons with Splunk Hosted Models (OpenAI-compatible fallback), and scores drop health 0–100."],
  ["04", "Act", "It recommends one concrete fix, applies it in one click, and auto-pages on-call — writing the action back to Splunk."],
];

const MODS = [
  ["Security", "OWASP OAT-005 scalping detection", "The oversell-bot cluster is raised as a security finding (OWASP Automated Threats OAT-005) with a confidence score and a block action, reasoned by Splunk’s Foundation-Sec hosted security model. Provable correctness makes it a zero-false-positive bot signal."],
  ["Hosted Models", "Splunk-native reasoning, with a floor", "The agent reasons on Splunk Hosted Models via an OpenAI-compatible endpoint — and never goes dark: reasoning degrades Hosted Models → hosted API → a deterministic rules engine, while the read path falls back MCP → REST → local buffer."],
  ["AI monitoring", "Agent self-observability", "DropWatch monitors its own agent: LLM tier, latency, token usage, estimated cost, confidence and drift, shipped to Splunk as dropwatch:agent. Parity with Splunk’s AI Agent Monitoring."],
  ["MCP", "Runnable MCP path + | dropwatch command", "The agent pulls telemetry over the Splunk MCP Server’s run_splunk_search contract end-to-end, and | dropwatch runs the same detection natively in the Splunk search bar."],
  ["Detect", "Anomaly detection + early warning", "A baseline z-score detector flags off-pattern behavior on any index, and claim-rate velocity plus p95 write latency warn of a building stampede before it crosses the threshold."],
  ["Respond", "Alert webhooks + packaged Splunk app", "High-severity findings auto-page Slack or PagerDuty with the agent’s reasoning, and an installable Splunk app runs six detectors natively on a schedule."],
];

const CLAIM_CODE = `UpdateItem {
  Key: { PK: "DROP#aura-1", SK: "META" },
  ConditionExpression:
    "claimed < totalStock AND status = live",
  UpdateExpression: "SET claimed = claimed + 1"
}
// DynamoDB serializes every writer.
// 100 units -> exactly 100 winners. Oversold: 0`;

export default function LandingPage() {
  const tickerSeq = [...TICKER, ...TICKER];
  return (
    <div className="dw flex-1">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="scan" />

      <div className="wrap">
        <header className="rv">
          <div className="brand">
            Drop<b>Watch</b>
          </div>
          <span className="status">
            <span className="dot" /> Agent online
          </span>
        </header>

        {/* hero */}
        <section className="hero" style={{ marginTop: 0 }}>
          <div className="eyebrow rv" style={{ animationDelay: ".05s" }}>
            Splunk Agentic Ops · Observability
          </div>
          <h1 className="rv" style={{ animationDelay: ".12s" }}>
            Provable correctness.
            <br />
            <span className="glow">Clean signals.</span>
          </h1>
          <p className="sub rv" style={{ animationDelay: ".2s" }}>
            DropWatch ships every flash-drop event to Splunk over HEC, then an LLM agent reads it
            back through the MCP Server, scores drop health, flags oversell-bot subnets, and monitors
            its own reasoning.
          </p>
          <div className="hero-cta rv" style={{ animationDelay: ".28s" }}>
            <a className="btn primary" href="/ops">
              ▸ Open the live dashboard
            </a>
            <a className="btn" href="https://youtu.be/mUfKYCnnaME" target="_blank" rel="noopener">
              Watch the 2:35 demo
            </a>
            <a className="btn" href="#waitlist">
              Request access
            </a>
          </div>

          <div className="ticker rv" style={{ animationDelay: ".36s" }} aria-hidden="true">
            <div className="ticker-track">
              {tickerSeq.map(([t, c], i) => (
                <span key={i} className={c}>
                  {t}
                  <span className="tk-d"> · </span>
                </span>
              ))}
            </div>
          </div>

          <div className="viewport hud rv" style={{ animationDelay: ".42s" }}>
            <div className="chrome">
              <span className="lights">
                <i />
                <i />
                <i />
              </span>
              <span>dropwatch://ops · telemetry: mcp · agent: aiml</span>
              <span className="rec">
                <span className="dot" /> LIVE
              </span>
            </div>
            <div className="frame">
              <iframe
                src="https://www.youtube.com/embed/mUfKYCnnaME"
                title="DropWatch demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
          <p className="vp-note">
            This isn’t a mockup — <a href="/ops">open the live agent dashboard →</a> running on
            Cloudflare Workers, pulling telemetry over the Splunk MCP Server (telemetry: mcp).
          </p>
        </section>

        <section className="stats">
          <div className="stat hud">
            <div className="n">0</div>
            <div className="l">oversold, by construction</div>
          </div>
          <div className="stat hud">
            <div className="n">75</div>
            <div className="l">drop-health, scored live</div>
          </div>
          <div className="stat hud">
            <div className="n">/24</div>
            <div className="l">oversell-bot subnet, caught</div>
          </div>
        </section>

        {/* how it works */}
        <section>
          <div className="label">01 — How it works</div>
          <h2>An agent, not a dashboard</h2>
          <p className="lead">
            The same closed loop runs over any Splunk index. The flash drop is just the showcase
            payload.
          </p>
          <div className="steps">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="step hud">
                <div className="sn">{n}</div>
                <b>{title}</b>
                <span>{body}</span>
              </div>
            ))}
          </div>
          <div className="flow">
            pull <b>→</b> summarize <b>→</b> reason <b>→</b> score <b>→</b> recommend <b>→</b> apply{" "}
            <b>→</b> page
          </div>
        </section>

        {/* the guarantee — atomic write proof (best of the ZeroDrop landing) */}
        <section>
          <div className="label">02 — Why the signals are clean</div>
          <h2>The oversell-proof guarantee</h2>
          <p className="lead">
            Most stores read stock, then write the order — under a spike, hundreds pass that check at
            once. ZeroDrop never reads stock: every claim is one atomic conditional write. That’s why
            an oversell-reject can’t be a bug — only a bot. The signal is clean by construction.
          </p>
          <div className="proof">
            <div>
              <ul>
                <li>
                  <i>✓</i> No locks, no read-modify-write races — DynamoDB serializes every writer
                </li>
                <li>
                  <i>✓</i> 10,000 race for 100 units → exactly 100 win, the rest get an atomic
                  waitlist slot
                </li>
                <li>
                  <i>✓</i> So a post-sellout reject cluster from one /24 = automated checkout bots,
                  zero false positives
                </li>
                <li>
                  <i>✓</i> That guarantee is what makes the telemetry trustworthy enough to act on
                </li>
              </ul>
            </div>
            <div className="hud term">
              <div className="bar">
                <i />
                <i />
                <i />
                <span style={{ marginLeft: 8 }}>the entire claim path</span>
              </div>
              <pre>
                <code>{CLAIM_CODE}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* beyond */}
        <section>
          <div className="label">03 — Beyond flash drops</div>
          <h2>One pattern, any telemetry</h2>
          <div className="beyond">
            <div className="big hud">
              <h2 style={{ fontSize: 20, margin: 0 }}>Works on any Splunk index</h2>
              <p>
                Under the drop-specific detectors sits a generic z-score anomaly detector that knows
                nothing about the flash-drop taxonomy. Point the same agent at any stream and it
                scores health, ranks anomalies, and pages on-call the same way.
              </p>
            </div>
            <div className="idx">
              <div className="hud">
                <b>App / services</b>
                <span>error-rate spikes, latency</span>
              </div>
              <div className="hud">
                <b>ITOps</b>
                <span>queue depth, saturation</span>
              </div>
              <div className="hud">
                <b>NetOps</b>
                <span>packet drops, anomalies</span>
              </div>
              <div className="hud">
                <b>Security</b>
                <span>abuse + bot clusters</span>
              </div>
            </div>
          </div>
        </section>

        {/* what's new */}
        <section>
          <div className="label">04 — What’s new</div>
          <h2>Built for Splunk’s latest AI capabilities</h2>
          <p className="lead">Recently shipped, all open source and exercised by the test suite.</p>
          <div className="mods">
            {MODS.map(([tag, title, body]) => (
              <div key={title} className="mod hud">
                <span className="tag">{tag}</span>
                <div>
                  <b>{title}</b>
                  <span>{body}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* waitlist */}
        <section id="waitlist">
          <div className="console hud">
            <div className="label" style={{ textAlign: "center" }}>
              05 — Access
            </div>
            <h2>Join the waitlist</h2>
            <p>DropWatch is built in the open. Get early access and product updates.</p>
            <WaitlistForm />
            <div className="chips">
              <span>Splunk HEC</span>
              <span>MCP Server</span>
              <span>Foundation-Sec</span>
              <span>Next.js</span>
              <span>DynamoDB</span>
              <span>TypeScript</span>
            </div>
          </div>
        </section>

        {/* maker */}
        <section>
          <div className="maker hud">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jerom.jpg" alt="Jerom Tom" width={88} height={88} />
            <div>
              <div className="ml">Built by</div>
              <div className="mn">Jerom Tom</div>
              <p className="mb">
                Building DropWatch in the open: agentic observability for oversell-proof flash drops.
              </p>
              <div className="mlk">
                <a href="https://jeromtom.com" target="_blank" rel="noopener">
                  jeromtom.com
                </a>
                <a href="https://github.com/jeromtom" target="_blank" rel="noopener">
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer>
          Splunk Agentic Ops Hackathon · Observability ·{" "}
          <a href="https://youtu.be/mUfKYCnnaME">demo</a> ·{" "}
          <a href="https://devpost.com/software/dropwatch-qnpgy6">Devpost</a> ·{" "}
          <a href="https://github.com/jeromtom/zerodrop-splunk-ops">source</a>
          <br />
          Provable correctness creates clean signals. © 2026
        </footer>
      </div>
    </div>
  );
}
