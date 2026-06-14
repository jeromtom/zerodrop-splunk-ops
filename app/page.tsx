import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StockBar } from "@/components/StockBar";
import { getDropBySlug } from "@/lib/drops";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Create your drop",
    body: "Name, price, stock, go-live time. Sixty seconds, no storefront required.",
  },
  {
    n: "02",
    title: "Share one link",
    body: "Your drop page handles the stampede — countdown, live stock, claim queue.",
  },
  {
    n: "03",
    title: "Sell out. Exactly.",
    body: "Every claim is one atomic database write. 100 units means 100 buyers — never 101.",
  },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    features: ["1 drop / month", "50 units per drop", "Atomic claims & waitlist", "ZeroDrop link"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Indie",
    price: "$29",
    cadence: "/ month",
    features: [
      "Unlimited drops",
      "1,000 units per drop",
      "Custom slug & branding",
      "Waitlist export (CSV)",
    ],
    cta: "Go Indie",
    featured: true,
  },
  {
    name: "Pro",
    price: "$99",
    cadence: "/ month + 1% per claim",
    features: [
      "1,000,000 units per drop",
      "Multi-region reads",
      "API access & webhooks",
      "Priority support",
    ],
    cta: "Go Pro",
    featured: false,
  },
];

export default async function LandingPage() {
  const demo = await getDropBySlug("aura-1-lunar").catch(() => null);

  return (
    <div className="zd-glow flex-1">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 text-zinc-300 hover:text-foreground">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-zinc-950 transition hover:brightness-110"
          >
            Start a drop
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 text-center">
        <p className="zd-rise mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs text-zinc-400">
          <span className="zd-live-dot inline-block size-1.5 rounded-full bg-accent" />
          Built on DynamoDB conditional writes — overselling is impossible by construction
        </p>
        <h1 className="zd-rise mx-auto max-w-3xl text-5xl font-bold tracking-tight sm:text-7xl">
          Sell out.
          <br />
          <span className="text-accent">Never oversell.</span>
        </h1>
        <p className="zd-rise mx-auto mt-6 max-w-xl text-lg text-zinc-400">
          Flash drops for independent brands. One link, any traffic spike, and exactly as many
          orders as you have units — refund emails are not a growth strategy.
        </p>
        <div className="zd-rise mt-9 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-zinc-950 transition hover:brightness-110"
          >
            Launch your first drop
          </Link>
          {demo && (
            <Link
              href={`/d/${demo.slug}`}
              className="rounded-xl border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:border-zinc-500"
            >
              See a live drop →
            </Link>
          )}
        </div>

        {/* live demo card */}
        {demo && (
          <Link
            href={`/d/${demo.slug}`}
            className="zd-rise mx-auto mt-14 block max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-left transition hover:border-zinc-600"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{demo.emoji}</span>
                <div>
                  <div className="font-semibold">{demo.name}</div>
                  <div className="text-sm text-zinc-500">{money(demo.price)} · live now</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <span className="zd-live-dot size-1.5 rounded-full bg-accent" /> LIVE
              </span>
            </div>
            <div className="mt-4">
              <StockBar claimed={Math.min(demo.claimed, demo.totalStock)} total={demo.totalStock} live />
              <div className="mt-2 flex justify-between font-mono text-xs text-zinc-500">
                <span>
                  {Math.min(demo.claimed, demo.totalStock)} / {demo.totalStock} claimed
                </span>
                <span>{Math.max(0, demo.totalStock - demo.claimed)} left</span>
              </div>
            </div>
          </Link>
        )}
      </section>

      {/* steps */}
      <section className="border-y border-zinc-900 bg-zinc-950/60">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
              <div className="font-mono text-sm text-accent">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* the guarantee */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The oversell-proof guarantee
            </h2>
            <p className="mt-4 leading-relaxed text-zinc-400">
              Most stores check stock, then write the order — and under a traffic spike, hundreds
              of buyers pass that check at once. ZeroDrop never reads stock at all: every claim is
              a single <span className="font-mono text-accent">conditional write</span> that
              Amazon DynamoDB serializes. If 10,000 people race for 100 units, exactly 100 win and
              9,900 land on an atomic waitlist with a guaranteed position.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-300">
              {[
                "No locks, no queues to operate, no read-modify-write races",
                "10-minute holds expire automatically (DynamoDB TTL)",
                "Waitlist positions are atomic too — no duplicates, no gaps",
                "Serverless end-to-end: Vercel functions + DynamoDB on-demand",
              ].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span className="mt-0.5 text-accent">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 px-4 py-3">
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="size-2.5 rounded-full bg-zinc-700" />
              <span className="ml-2 font-mono text-xs text-zinc-600">the entire claim path</span>
            </div>
            <pre className="overflow-x-auto px-5 pb-5 font-mono text-[13px] leading-relaxed text-zinc-300">
              <code>{`UpdateItem {
  Key: { PK: "DROP#aura-1", SK: "META" },
  ConditionExpression:
    "claimed < totalStock AND status = live",
  UpdateExpression:
    "SET claimed = claimed + 1"
}
// DynamoDB serializes every writer.
// 100 units -> exactly 100 winners.
// Oversell count, forever: 0`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="border-t border-zinc-900 bg-zinc-950/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Pricing that scales with your hype
          </h2>
          <p className="mt-3 text-center text-zinc-400">
            On-demand infrastructure means a drop costs us fractions of a cent. You only pay when
            you grow.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`rounded-2xl border p-7 ${
                  t.featured
                    ? "border-accent/60 bg-accent/5 shadow-lg shadow-accent/5"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.featured && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-zinc-950">
                      POPULAR
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{t.price}</span>{" "}
                  <span className="text-sm text-zinc-500">{t.cadence}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 block rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                    t.featured
                      ? "bg-accent text-zinc-950 hover:brightness-110"
                      : "border border-zinc-700 text-zinc-200 hover:border-zinc-500"
                  }`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-500 sm:flex-row">
          <Logo />
          <p>
            Built for the H0 hackathon · Next.js on Vercel ·{" "}
            <span className="text-zinc-400">Amazon DynamoDB</span> single-table backend
          </p>
        </div>
      </footer>
    </div>
  );
}
