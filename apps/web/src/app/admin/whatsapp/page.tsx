import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { startWhatsappConversationAction } from "@/lib/whatsapp/actions";

export const dynamic = "force-dynamic";

export default async function WhatsappInboxPage() {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);

  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      </section>
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { waPhoneNumberId: true },
  });
  const conversations = await prisma.whatsappConversation.findMany({
    where: { companyId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <section className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">WhatsApp</h1>
        <form action={startWhatsappConversationAction} className="flex items-center gap-2">
          <input type="hidden" name="companyId" value={companyId} />
          <input
            name="phone"
            placeholder="60123456789"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
          />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
            New chat
          </button>
        </form>
      </div>

      {!company?.waPhoneNumberId ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          WhatsApp isn&apos;t connected for this company yet. Add the Cloud API
          phone-number ID and access token in <strong>Company settings → WhatsApp</strong>,
          and point your Meta webhook at <code>/api/whatsapp/webhook</code>.
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              href={`/admin/whatsapp/${c.id}`}
              className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {c.name || c.waPhone}
                  {c.unread > 0 ? (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-white">{c.unread}</span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-slate-500">{c.messages[0]?.body ?? "—"}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {c.lastMessageAt.toISOString().slice(5, 16).replace("T", " ")}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
