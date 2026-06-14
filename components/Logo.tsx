import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-accent font-mono text-sm font-bold text-zinc-950 transition-transform group-hover:-rotate-6">
        0
      </span>
      <span className="text-lg font-semibold tracking-tight">
        Zero<span className="text-accent">Drop</span>
      </span>
    </Link>
  );
}
