"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";

export function DashboardNav({ brandName }: { brandName: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <span className="hidden rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400 sm:inline">
            {brandName}
          </span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/dashboard/new"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-zinc-950 transition hover:brightness-110"
          >
            + New drop
          </Link>
          <button
            onClick={logout}
            className="rounded-lg px-3 py-2 text-zinc-400 transition hover:text-foreground"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
