# Recording the DropWatch demo — Cowork-driven

The CLI agent can't drive the browser or record audio. This splits the work so
**Cowork performs the on-screen demo** and you only press the recorder hotkeys +
add narration.

## One-time setup (you)
1. Start the app. Your other project uses :3000, so run in the repo:
   `npm run db:local` (terminal 1) · `npm run db:seed` then `PORT=3055 npm run dev` (terminal 2).
2. Open two browser tabs: (A) `http://localhost:3055`  (B) Splunk → the imported
   `dashboards/dropwatch.xml`. Log in to the app: demo@zerodrop.app / drop-zero-2026.
3. Recorder: press **Win+Alt+R** (Xbox Game Bar) to start recording the browser
   window; press it again to stop. (It captures the focused window — keep the demo
   in one browser window, switch tabs A/B as needed.) Do a 5-second test clip first.

## Narration options (pick one)
- Talk over it live while Cowork clicks (you read DEMO_SCRIPT.md lines), OR
- Record silent, add captions in any editor, OR
- Record silent + generate a voiceover from DEMO_SCRIPT.md with a TTS tool, lay it on top.

## Cowork prompt — paste into Claude in Chrome (it performs the clicks)
```
You are performing a screen demo in the browser for a hackathon video. Do each step
slowly with a ~2s pause so it records cleanly. Do NOT submit anything. The app is at
http://localhost:3055 (tab A); Splunk dashboard is tab B. I will start/stop the
screen recorder myself.

1. Tab A: show the landing page, then open a drop showing 0/100 stock.
2. Click "Unleash the stampede". Wait for the stock bar to reach 100/100 with
   "oversold 0". Pause 3s on that result.
3. Switch to tab B (Splunk). In the search bar run:
   index=zerodrop sourcetype=zerodrop:telemetry | stats count by event
   Run it, then scroll to the dashboard's claim-rate timechart and the
   oversell-reject-by-subnet table. Pause 3s on each.
4. Switch to tab A and navigate to /ops. Point the cursor at the header
   (telemetry / LLM badges). Click "Re-scan". Wait for findings to load.
5. Hover slowly over the health score (75) and the HIGH "Oversell-bot" finding,
   then over the metrics panel (claim rate ~7x baseline). Pause 3s each.
6. On the oversell-bot finding card, click the recommended action button
   ("Flag IP cluster"). Wait for the green confirmation. Scroll to the
   Applied actions / live feed and pause 3s.
7. Tell me you're done so I can stop the recorder.
```

## Fallback if Cowork isn't available
Just screen-record yourself doing steps 1–6 above following DEMO_SCRIPT.md — it's
~2:40 of clicking. The seeded Splunk index already has demo data so panels aren't empty.
