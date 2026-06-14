"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EMOJIS = ["🔥", "👟", "💿", "🏺", "🧢", "🎟️", "📦", "🖼️", "⌚", "🧥", "💍", "🎮"];

export function NewDropForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [price, setPrice] = useState("49");
  const [stock, setStock] = useState("100");
  const [startsIn, setStartsIn] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          emoji,
          price: Math.round(parseFloat(price || "0") * 100),
          totalStock: parseInt(stock || "0", 10),
          startsInMinutes: parseInt(startsIn || "0", 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push(`/dashboard/drops/${data.drop.id}`);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm outline-none transition focus:border-accent";

  return (
    <form onSubmit={submit} className="zd-rise mt-8 space-y-5">
      <div>
        <span className="mb-1.5 block text-sm text-zinc-300">Icon</span>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid size-11 place-items-center rounded-xl border text-xl transition ${
                emoji === e
                  ? "border-accent bg-accent/10"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm text-zinc-300">Drop name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="AURA-1 Sneaker — Lunar"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm text-zinc-300">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="What makes this drop worth racing for?"
          className={input}
        />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm text-zinc-300">Price (USD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className={input}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-zinc-300">Units</span>
          <input
            type="number"
            min="1"
            max="1000000"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
            className={input}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-zinc-300">Goes live</span>
          <select value={startsIn} onChange={(e) => setStartsIn(e.target.value)} className={input}>
            <option value="0">Immediately</option>
            <option value="5">In 5 minutes</option>
            <option value="60">In 1 hour</option>
            <option value="1440">In 24 hours</option>
            <option value="10080">In 1 week</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-accent py-3 font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create drop"}
      </button>
    </form>
  );
}
