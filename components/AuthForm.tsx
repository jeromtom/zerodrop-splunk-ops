"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error — is the local DB running? (npm run db:local)");
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail("demo@zerodrop.app");
    setPassword("drop-zero-2026");
  }

  return (
    <div className="zd-glow flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-5">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="zd-rise w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your brand"}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            {mode === "login"
              ? "Log in to run your drops."
              : "Free to start — your first drop is 60 seconds away."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-zinc-300">Brand name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={64}
                  placeholder="Apex Studios"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none transition focus:border-accent"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm text-zinc-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@brand.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-zinc-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none transition focus:border-accent"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-accent py-2.5 font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "One sec…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          {mode === "login" && (
            <button
              onClick={fillDemo}
              className="mt-3 w-full rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500"
            >
              Use the demo account
            </button>
          )}

          <p className="mt-6 text-center text-sm text-zinc-500">
            {mode === "login" ? (
              <>
                New here?{" "}
                <Link href="/signup" className="text-accent hover:underline">
                  Create your brand
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-accent hover:underline">
                  Log in
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
