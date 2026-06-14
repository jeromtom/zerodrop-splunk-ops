# DEMO_SCRIPT — beat-by-beat, under 3 minutes

Target runtime **2:35**. Record at 1080p+, system audio off, narrate over it (or record
voiceover after). Rules require: app working on its intended device **and** the AWS
database visibly in use. No third-party logos/music.

**Prep before recording**
- Production Vercel URL open in a clean browser profile (no bookmarks bar).
- Second window: AWS Console → DynamoDB → `zerodrop` → Explore items + Monitor tab.
- Logged in as demo@zerodrop.app; AURA-1 drop **reset to 0/100** (Reset demo button).
- A phone-width responsive window (or real phone) ready for the buyer view.

---

### 0:00 – 0:20 · The problem (landing page)
On `/`, slow scroll past the hero.
> "Limited drops are how indie brands launch — and the fastest way to destroy one is
> overselling. Five hundred checkouts, three hundred refund emails. It happens because
> stores check stock, then write the order — and under a spike, everyone passes that
> check at once. This is ZeroDrop: drops that physically cannot oversell."

### 0:20 – 0:45 · Create a drop (dashboard)
Log in → dashboard → "+ New drop". Fill it live: name "Demo Tee — First Run", 🧥, $40,
50 units, Immediately → Create.
> "I'm a brand. Sixty seconds: name, price, stock, go. ZeroDrop gives me one link and a
> live dashboard. Every number you'll see is an atomic DynamoDB counter."

### 0:45 – 1:15 · Buyer experience (public page)
Open the AURA-1 public page in the phone-width window. Enter an email, hit **Claim
yours** → claim page with hold countdown → tap the demo checkout.
> "Buyers get a live stock bar, claim in one tap, and get a real hold — ten minutes,
> enforced by DynamoDB TTL. If they walk away, the unit goes back on sale
> automatically. Confirmed means claim number 1 of 100, guaranteed."

### 1:15 – 2:05 · THE MONEY SHOT — the stampede
Back on the drop admin page, full screen. Select **500 concurrent buyers** → **Unleash
the stampede**. Let the stock bar race; point at the counters as they settle.
> "Now the part every commerce platform gets wrong. I'm firing five hundred concurrent
> buyers at the ninety-nine remaining pairs — real requests, racing on the live
> database. No locks, no queue. Each one is a single conditional write: increment
> claimed only if claimed is still below stock. DynamoDB serializes every writer...
> and there it is. Exactly 100 of 100 claimed. 401 waitlisted — each with an atomic
> position. Oversold: zero. Not 'usually zero'. Zero by construction."

### 2:05 – 2:20 · Prove the database (AWS console)
Cut to the AWS console: Explore items (DROP META item with `claimed: 100`, CLAIM items),
then the Monitor tab's write-request spike.
> "Here's the same drop inside AWS — one DynamoDB table, single-table design: drops,
> claims, and brands under one key space, with the write spike from the stampede."

### 2:20 – 2:35 · Business + stack (landing pricing)
Scroll to the pricing tiers.
> "ZeroDrop is monetizable B2B SaaS — free to start, $29 for indie brands, $99 plus
> one percent at pro scale. And because the stack is Vercel functions plus DynamoDB
> on-demand, a drop costs us fractions of a cent to host. Built on the zero stack:
> Next.js on Vercel, Amazon DynamoDB underneath. ZeroDrop — sell out, never oversell."

---

**Editing notes**
- Keep one continuous take for the stampede (0 cuts between click and result) — it's
  the credibility moment.
- Captions for the four big numbers (Attempted / Won stock / Waitlisted / Oversold 0)
  help judges skimming without audio.
- End card (2 sec): logo + "DynamoDB conditional writes · Vercel · #H0Hackathon".
