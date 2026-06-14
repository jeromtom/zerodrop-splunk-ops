import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { StockBar } from "@/components/StockBar";
import { getSessionEmail, getUser } from "@/lib/auth";
import { listDropsByOwner } from "@/lib/drops";
import { money } from "@/lib/format";
import type { Drop } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — ZeroDrop" };

function dropState(d: Drop): { label: string; cls: string } {
  if (d.startsAt > Date.now())
    return { label: "SCHEDULED", cls: "bg-sky-400/10 text-sky-300" };
  if (d.claimed >= d.totalStock)
    return { label: "SOLD OUT", cls: "bg-rose-400/10 text-rose-300" };
  return { label: "LIVE", cls: "bg-accent/10 text-accent" };
}

export default async function DashboardPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  const [user, drops] = await Promise.all([getUser(email), listDropsByOwner(email)]);

  const totalRevenue = drops.reduce(
    (sum, d) => sum + Math.min(d.claimed, d.totalStock) * d.price,
    0
  );
  const totalClaimed = drops.reduce((sum, d) => sum + Math.min(d.claimed, d.totalStock), 0);
  const totalWaitlist = drops.reduce((sum, d) => sum + d.waitlistCount, 0);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardNav brandName={user?.name ?? email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your drops</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Every number below is an atomic DynamoDB counter — refresh as hard as you like.
            </p>
          </div>
        </div>

        {/* top-line stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            ["Drops", String(drops.length)],
            ["Units claimed", totalClaimed.toLocaleString()],
            ["Waitlisted", totalWaitlist.toLocaleString()],
            ["Gross revenue", money(totalRevenue)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-xs uppercase tracking-widest text-zinc-500">{label}</div>
              <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        {/* drop cards */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {drops.map((d) => {
            const st = dropState(d);
            return (
              <Link
                key={d.id}
                href={`/dashboard/drops/${d.id}`}
                className="zd-rise rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition hover:border-zinc-600"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{d.emoji}</span>
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-sm text-zinc-500">
                        {money(d.price)} · {d.totalStock.toLocaleString()} units
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <div className="mt-5">
                  <StockBar
                    claimed={Math.min(d.claimed, d.totalStock)}
                    total={d.totalStock}
                    live={st.label === "LIVE"}
                  />
                  <div className="mt-2 flex justify-between font-mono text-xs text-zinc-500">
                    <span>
                      {Math.min(d.claimed, d.totalStock)} / {d.totalStock} claimed
                    </span>
                    {d.waitlistCount > 0 && <span>+{d.waitlistCount} waitlisted</span>}
                  </div>
                </div>
              </Link>
            );
          })}

          {drops.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-zinc-800 p-14 text-center">
              <div className="text-4xl">📦</div>
              <h2 className="mt-3 text-lg font-semibold">No drops yet</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Create your first drop — it takes about a minute.
              </p>
              <Link
                href="/dashboard/new"
                className="mt-6 inline-block rounded-xl bg-accent px-6 py-2.5 font-semibold text-zinc-950 transition hover:brightness-110"
              >
                + New drop
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
