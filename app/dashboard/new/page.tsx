import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/DashboardNav";
import { NewDropForm } from "@/components/NewDropForm";
import { getSessionEmail, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "New drop — ZeroDrop" };

export default async function NewDropPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");
  const user = await getUser(email);

  return (
    <div className="flex flex-1 flex-col">
      <DashboardNav brandName={user?.name ?? email} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">New drop</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Set it up once — DynamoDB enforces the rest at any traffic level.
        </p>
        <NewDropForm />
      </main>
    </div>
  );
}
