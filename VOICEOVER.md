# VOICEOVER — DropWatch demo video

Narration script for an ElevenLabs AI voice (optional futuristic talking-head
avatar on the intro/outro only). Target runtime **2:40**, hard cap **3:00**.
Beats mirror [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) exactly.

> Honesty note baked into the words: HEC ingestion into the `zerodrop` index and
> the slash-ops agent reasoning with a real LLM are narrated as **live**. The
> Splunk MCP Server, REST search read-back, and Splunk Hosted Models are narrated
> as **wired and shown in the code and docs** — never as running. Overselling is
> impossible by construction, so the oversell-reject stream is a clean bot signal.

---

## 1. Timed narration

The "Speak" column is the exact TTS input. It is written phonetically where a
voice engine would otherwise mispronounce a term (for example, "H-E-C" reads as
letters, not "heck"). Render each beat as its own clip for easy syncing.

### 0:00–0:20 — The problem + the guarantee
**On screen:** Landing page, then a drop sitting at zero of one hundred.

> Flash drops sell out in seconds, and the number one way brands lose trust is overselling. ZeroDrop makes that impossible. Every claim is one atomic DynamoDB conditional write, so overselling can't happen by construction. Once you're safe, the real question is: what is actually happening during the drop? That's DropWatch.

### 0:20–0:50 — Generate a live drop (telemetry to Splunk via HEC)
**On screen:** Click "Unleash the stampede" — stock races to one hundred of one hundred, oversold zero. Cut to Splunk; run the stats-by-event search.

> We unleash the stampede. The stock bar races to a hundred out of a hundred, with zero oversold. And every claim, hold, expiry, oversell-reject, waitlist, and checkout just emitted a structured event to Splunk, over H-E-C, the H-T-T-P Event Collector. Here they are, live in the zerodrop index. Watch the claim-rate timechart spike, and the oversell-rejects break out by slash-twenty-four subnet.

### 0:50–1:50 — The agent reasons (the AI moment)
**On screen:** Open slash-ops, click "Re-scan." Point at the header (`telemetry: buffer · LLM: aiml`), the health score, the HIGH finding, and the metrics panel.

> DropWatch isn't a passive dashboard, it's an agent. It reads the live telemetry stream, summarizes it, and a real language model reasons about drop health. The header confirms it: telemetry from the buffer, reasoning on the live A-I-M-L model. The verdict comes back fast. Drop-health score: seventy-five out of a hundred. And a high-severity finding: oversell-bot activity. In the agent's own words, the oversell-reject rate is around fifty-eight percent, and one subnet, ten-dot-sixty-six-dot-six-dot-zero slash twenty-four, produces the majority of those rejects. That's the bot signature. And remember, no oversell ever happened. The DynamoDB guard held every time. The metrics panel shows the other half of the story: claim rate running about seven times baseline, peaking near sixty-four a minute. That's the stampede.

### 1:50–2:25 — Recommend, then apply (close the loop)
**On screen:** On the finding card, click "Flag IP cluster" (flag_ip_cluster → 10.66.6.0/24); card turns green. Show the applied-actions live feed updating.

> It doesn't just alert, it recommends a concrete action. One click, flag the IP cluster, and the agent flags ten-dot-sixty-six-dot-six-dot-zero slash twenty-four. The card turns green, flagged. And the action is recorded straight back to the live feed, so the remediation itself is observable too. The loop closes: pull, reason, recommend, apply.

### 2:25–2:40 — Close
**On screen:** Hold on slash-ops result; optional B-roll of the terminal printing the severity-ranked report.

> DropWatch turns ZeroDrop's hot paths into Splunk telemetry over H-E-C, and an agent that reads it, reasons with a live L-L-M, and acts. The Splunk MCP Server and Hosted Models paths are wired and shown in the code and docs, ready for a production stack. Oversell-proof, and now fully observable.

---

## 2. Voice settings (ElevenLabs)

**Voice profile:** a confident, slightly synthetic, futuristic narrator — clear
diction, neutral-to-mid pitch, steady energy. Good stock choices: **Adam**,
**Antoni**, or **Daniel** (male, authoritative tech-demo timbre); **Rachel** or
**Alice** if you prefer a female narrator. If you want a more overtly "synthetic"
edge, audition a Voice Library voice tagged *narration / characters / robotic*
but keep it intelligible — clarity beats gimmick for judges.

**Model:** **Eleven Multilingual v2** for best pronunciation control and prosody
on the spelled-out acronyms (H-E-C, L-L-M, A-I-M-L). Use **Turbo v2.5** only if
you need faster/cheaper iteration and accept slightly less expressive output.

**Slider guidance (0–100 scale):**
- **Stability ~45–55** — low enough to sound alive and confident, high enough to
  avoid wobble on the long 0:50–1:50 paragraph.
- **Similarity / Clarity ~80** — keeps the chosen voice's identity and crisp
  consonants for the acronyms.
- **Style ~10–20** — a touch of expressiveness for the "futuristic" tone without
  drifting into theatrical. Keep modest; high Style hurts consistency.
- **Speaker Boost: ON.**

**Workflow:** render **each of the five beats as a separate audio clip** (and the
avatar intro/outro as two more). Separate clips let you nudge timing per beat in
the editor and re-render just one line if a number is misread. Target ~150 words
per minute; if any clip runs long, trim words rather than speeding up the voice.

---

## 3. Avatar intro/outro (optional)

A futuristic talking-head avatar works best as a **bookend** — an 8–10 second
intro and an 8–10 second outro — while the middle stays screen-recording plus
voiceover. Judges most want to see the product actually working, so don't let an
avatar eat the demo minutes.

**INTRO (~9s):**
> This is DropWatch — agentic observability for oversell-proof flash drops. The drop is safe by design. Now let's make it fully observable, on Splunk.

**OUTRO (~9s):**
> Oversell-proof by construction, observable by design. DropWatch — telemetry to Splunk, an agent that reasons and acts. Thanks for watching.

**Tooling (honest):** ElevenLabs is primarily a **voice** tool — it does not
natively produce a talking-head avatar. To get a futuristic avatar, generate the
ElevenLabs audio first, then drive a talking head with **HeyGen**, **D-ID**, or
**Synthesia** (each accepts an uploaded audio track and lip-syncs an avatar). If
ElevenLabs has shipped a video/avatar feature in your account, that works too —
but the audio-plus-HeyGen/D-ID/Synthesia route is the reliable path. Keep the
avatar on intro and outro only; use plain voiceover over the screen capture for
the 0:20–2:25 product demo.

---

## 4. Production checklist

1. **Render VO clips** — five beat clips (plus optional intro/outro) in
   ElevenLabs using the voice settings above. Listen back specifically for the
   acronyms (H-E-C, L-L-M, A-I-M-L) and the subnet reading
   ("ten-dot-sixty-six-dot-six-dot-zero slash twenty-four").
2. **Screen-record** the flow per [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) beats using
   **Win + Alt + R** (Windows Game Bar). Capture the landing page → "Unleash the
   stampede" → Splunk stats search + timechart → slash-ops Re-scan → Flag IP
   cluster → live feed. Record at 1080p or higher.
3. **Lay VO over the capture** in any editor (Clipchamp, DaVinci Resolve,
   CapCut, Premiere). Align each beat clip to its on-screen action; trim dead air.
4. **Optional avatar intro/outro** — drop the HeyGen/D-ID/Synthesia avatar clips
   on the front and back only.
5. **Export 1080p** (MP4, H.264). Confirm total runtime is **under 3:00**
   (target ~2:40).
6. **Upload to YouTube** (or Vimeo/Youku per rules), set to **Public**, language
   **English**, **under 3 minutes**. Unlisted is fine while testing, but the
   final submission link must be public.

---

**Total spoken word count (five narration beats, 0:00–2:40): 335 words.**
At ~150 words per minute that is about **2 minutes 14 seconds of speech**, leaving
comfortable headroom for on-screen pauses, the stats-search reveal, and click
beats while staying safely under the 3-minute cap. The optional avatar intro
(~28 words) and outro (~26 words) add roughly 22 seconds if you use them, for a
combined narrated total still comfortably under 3:00.
