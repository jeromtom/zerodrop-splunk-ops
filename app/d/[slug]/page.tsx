import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DropPublic } from "@/components/DropPublic";
import { Logo } from "@/components/Logo";
import { getDropBySlug } from "@/lib/drops";
import { toPublicDrop } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/d/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const drop = await getDropBySlug(slug).catch(() => null);
  return { title: drop ? `${drop.name} — ZeroDrop` : "Drop — ZeroDrop" };
}

export default async function PublicDropPage({ params }: PageProps<"/d/[slug]">) {
  const { slug } = await params;
  const drop = await getDropBySlug(slug);
  if (!drop) notFound();

  return (
    <div className="zd-glow flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-3xl px-6 py-5">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20">
        {/* Server Components render once per request — a request-time clock is fine here. */}
        {/* eslint-disable-next-line react-hooks/purity */}
        <DropPublic initial={toPublicDrop(drop)} serverNow={Date.now()} />
      </main>
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Oversell-proof — every claim is an atomic Amazon DynamoDB conditional write.
      </footer>
    </div>
  );
}
