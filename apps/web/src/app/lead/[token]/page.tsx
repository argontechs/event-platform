import { notFound } from "next/navigation";
import { prisma } from "@event/db";
import { LeadUploadForm } from "@/components/site/lead-upload-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add photos · Event Platform" };

export default async function LeadUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Only confirm the token exists — don't load (or render) lead-identifying
  // details. The access code is verified inside addLeadImagesAction on submit.
  const lead = await prisma.lead.findUnique({
    where: { uploadToken: token },
    select: { id: true },
  });
  if (!lead) notFound();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 25% 15%, var(--brand-wash-1-strong, rgba(37,99,235,0.35)), transparent 60%), radial-gradient(55% 55% at 85% 90%, var(--brand-wash-2-strong, rgba(14,116,233,0.30)), transparent 60%), #060c1c",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--brand-soft,#7dd3fc)]">Your event proposal</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Share more photos</h1>
          <p className="mt-1 text-sm text-slate-300">
            Enter your access code and add any extra inspiration or venue photos so we can
            tailor your proposal.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl shadow-blue-950/40">
          <LeadUploadForm token={token} />
        </div>
      </div>
    </main>
  );
}
