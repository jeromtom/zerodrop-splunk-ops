import { notFound, redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { DropAdmin } from "@/components/DropAdmin";
import { getSessionEmail, getUser } from "@/lib/auth";
import { getDrop } from "@/lib/drops";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drop — ZeroDrop" };

export default async function DropAdminPage({
  params,
}: PageProps<"/dashboard/drops/[id]">) {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const { id } = await params;
  const [user, drop] = await Promise.all([getUser(email), getDrop(id)]);
  if (!drop || drop.ownerEmail !== email) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <DashboardNav brandName={user?.name ?? email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <DropAdmin dropId={id} />
      </main>
    </div>
  );
}
