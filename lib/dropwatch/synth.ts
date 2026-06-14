/**
 * Synthetic drop-telemetry synthesizer (MOCK MODE).
 *
 * Produces a realistic stream of DropEvents for a flash drop, with two planted
 * incidents the DropWatch agent must catch:
 *
 *   1. STAMPEDE: a sudden spike of claims + oversell_reject events as stock
 *      runs out (the drop "goes viral").
 *   2. OVERSELL BOT: one IP cluster (10.66.6.x) hammering the claim endpoint,
 *      generating a disproportionate share of oversell_reject events — the
 *      signature of automated checkout bots.
 *
 * Deterministic when given a seed, so the end-to-end test is stable.
 */

import { type DropEvent, maskBuyer, newEvent } from "./events";

// Tiny deterministic PRNG (mulberry32) — no deps.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SynthOptions {
  dropId?: string;
  dropName?: string;
  totalStock?: number;
  seed?: number;
  /** Inject the planted stampede + bot incidents (default true). */
  withIncident?: boolean;
}

export interface SynthStream {
  events: DropEvent[];
  dropId: string;
  dropName: string;
  totalStock: number;
}

export function synthesize(opts: SynthOptions = {}): SynthStream {
  const dropId = opts.dropId ?? "aura-1-lunar";
  const dropName = opts.dropName ?? "AURA-1 Lunar Sneaker";
  const totalStock = opts.totalStock ?? 100;
  const withIncident = opts.withIncident ?? true;
  const rand = rng(opts.seed ?? 42);

  const events: DropEvent[] = [];
  const base = Date.now() - 12 * 60_000; // window starts 12 min ago
  let claimed = 0;
  let t = base;

  const goodIp = () => `73.${1 + Math.floor(rand() * 200)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`;
  const botIp = () => `10.66.6.${1 + Math.floor(rand() * 12)}`;
  const buyer = (i: number) => maskBuyer(`buyer${i}@mail.com`);

  const push = (ev: DropEvent) => {
    ev.time = new Date(t).toISOString();
    ev.dropName = dropName;
    events.push(ev);
  };

  // ---- Phase 1: warm-up (steady, healthy claims) ~6 min --------------------
  for (let i = 0; i < 40 && claimed < totalStock; i++) {
    t += 4000 + rand() * 6000;
    claimed++;
    push(newEvent("claim", dropId, { buyer: buyer(i), ip: goodIp(), position: claimed, latencyMs: 8 + Math.floor(rand() * 12) }));
    push(newEvent("hold_create", dropId, { buyer: buyer(i), position: claimed }));
    if (rand() < 0.6) push(newEvent("checkout", dropId, { buyer: buyer(i), position: claimed, meta: { revenueCents: 18000 } }));
    if (rand() < 0.12) push(newEvent("hold_expiry", dropId, { buyer: buyer(i), position: claimed }));
  }

  // ---- Phase 2: STAMPEDE — viral spike, stock runs out ---------------------
  if (withIncident) {
    for (let i = 40; i < 240; i++) {
      t += 80 + rand() * 220; // claims arriving every ~150ms = stampede
      if (claimed < totalStock) {
        claimed++;
        push(newEvent("claim", dropId, { buyer: buyer(i), ip: goodIp(), position: claimed, latencyMs: 20 + Math.floor(rand() * 60) }));
        push(newEvent("hold_create", dropId, { buyer: buyer(i), position: claimed }));
      } else {
        // Sold out: half waitlist, half are bots slamming the conditional guard.
        const isBot = rand() < 0.55;
        push(
          newEvent("oversell_reject", dropId, {
            buyer: isBot ? maskBuyer(`bot${i}@x.io`) : buyer(i),
            ip: isBot ? botIp() : goodIp(),
            latencyMs: 6 + Math.floor(rand() * 10),
            meta: { reason: "claimed>=totalStock", bot: isBot },
          })
        );
        if (!isBot && rand() < 0.7)
          push(newEvent("waitlist_add", dropId, { buyer: buyer(i), ip: goodIp(), position: i - totalStock }));
      }
    }

    // ---- Phase 3: hold-expiry storm (abandoned carts after the rush) -------
    for (let i = 0; i < 18; i++) {
      t += 1500 + rand() * 3000;
      push(newEvent("hold_expiry", dropId, { buyer: buyer(i), meta: { abandoned: true } }));
    }
  } else {
    // Calm tail.
    for (let i = 40; i < 60 && claimed < totalStock; i++) {
      t += 5000 + rand() * 8000;
      claimed++;
      push(newEvent("claim", dropId, { buyer: buyer(i), ip: goodIp(), position: claimed }));
    }
  }

  // Final sim summary event.
  push(
    newEvent("sim_summary", dropId, {
      meta: {
        requested: withIncident ? 240 : 60,
        claimed,
        totalStock,
        oversold: 0, // ZeroDrop's guarantee — always 0
        rejects: events.filter((e) => e.event === "oversell_reject").length,
      },
    })
  );

  events.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return { events, dropId, dropName, totalStock };
}
