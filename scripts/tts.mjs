// Generate DropWatch demo voiceover clips with ElevenLabs.
// Run: node --env-file=.env.local scripts/tts.mjs
// Env: ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (optional), ELEVENLABS_MODEL (optional)
// Text is the verbatim narration from VOICEOVER.md (TTS-tuned: H-E-C, A-I-M-L, slash-ops, etc).
import { mkdir, writeFile } from "node:fs/promises";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("Missing ELEVENLABS_API_KEY (put it in .env.local and run with --env-file=.env.local)");
  process.exit(1);
}
const VOICE = process.env.ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9"; // Daniel — Steady Broadcaster
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };

const beats = [
  ["00-intro", "This is DropWatch — agentic observability for oversell-proof flash drops. The drop is safe by design. Now let's make it fully observable, on Splunk."],
  ["01-problem", "Flash drops sell out in seconds, and the number one way brands lose trust is overselling. ZeroDrop makes that impossible. Every claim is one atomic DynamoDB conditional write, so overselling can't happen by construction. Once you're safe, the real question is: what is actually happening during the drop? That's DropWatch."],
  ["02-hec", "We unleash the stampede. The stock bar races to a hundred out of a hundred, with zero oversold. And every claim, hold, expiry, oversell-reject, waitlist, and checkout just emitted a structured event to Splunk, over H-E-C, the H-T-T-P Event Collector. Here they are, live in the zerodrop index. Watch the claim-rate timechart spike, and the oversell-rejects break out by slash-twenty-four subnet."],
  ["03-agent", "DropWatch isn't a passive dashboard, it's an agent. It reads the live telemetry stream, summarizes it, and a real language model reasons about drop health. The header confirms it: telemetry from the buffer, reasoning on the live A-I-M-L model. The verdict comes back fast. Drop-health score: seventy-five out of a hundred. And a high-severity finding: oversell-bot activity. In the agent's own words, the oversell-reject rate is around fifty-eight percent, and one subnet, ten-dot-sixty-six-dot-six-dot-zero slash twenty-four, produces the majority of those rejects. That's the bot signature. And remember, no oversell ever happened. The DynamoDB guard held every time. The metrics panel shows the other half of the story: claim rate running about seven times baseline, peaking near sixty-four a minute. That's the stampede."],
  ["03-agent-short", "DropWatch isn't a passive dashboard, it's an agent. It reads the live telemetry stream, and a real language model reasons about drop health. The verdict comes back fast: the drop-health score drops, with a high-severity finding, oversell-bot activity. The oversell-reject rate is eighty percent, and one subnet, ten-dot-sixty-six-dot-six-dot-zero slash twenty-four, drives a disproportionate share of those rejects. That's the bot signature. And remember, no oversell ever happened. The DynamoDB guard held every time, landing on a hundred out of a hundred."],
  ["04-apply", "It doesn't just alert, it recommends a concrete action. One click, flag the IP cluster, and the agent flags ten-dot-sixty-six-dot-six-dot-zero slash twenty-four. The card turns green, flagged. And the action is recorded straight back to the live feed, so the remediation itself is observable too. The loop closes: pull, reason, recommend, apply."],
  ["05-close", "DropWatch turns ZeroDrop's hot paths into Splunk telemetry over H-E-C, and an agent that reads it, reasons with a live L-L-M, and acts. The Splunk MCP Server and Hosted Models paths are wired and shown in the code and docs, ready for a production stack. Oversell-proof, and now fully observable."],
  ["06-outro", "Oversell-proof by construction, observable by design. DropWatch — telemetry to Splunk, an agent that reasons and acts. Thanks for watching."],
];

async function render(name, text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(`audio/${name}.mp3`, buf);
      return buf.length;
    }
    const body = await res.text();
    if (attempt === 2) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

await mkdir("audio", { recursive: true });
console.log(`voice=${VOICE} model=${MODEL}`);
let total = 0;
for (const [name, text] of beats) {
  const bytes = await render(name, text);
  total += bytes;
  console.log(`  audio/${name}.mp3  ${(bytes / 1024).toFixed(0)} KB  (${text.split(/\s+/).length} words)`);
}
console.log(`done: ${beats.length} clips, ${(total / 1024 / 1024).toFixed(2)} MB total in audio/`);
