import { ClaimStatus } from "@/components/ClaimStatus";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your claim — ZeroDrop" };

export default async function ClaimPage({
  params,
}: PageProps<"/claim/[dropId]/[claimId]">) {
  const { dropId, claimId } = await params;
  return (
    <div className="zd-glow flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-3xl px-6 py-5">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 pb-24">
        <ClaimStatus dropId={dropId} claimId={claimId} />
      </main>
    </div>
  );
}
