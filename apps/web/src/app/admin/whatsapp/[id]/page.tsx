import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { WhatsappReply } from "@/components/admin/whatsapp-reply";
import { takeOverConversationAction } from "@/lib/whatsapp/actions";

export const dynamic = "force-dynamic";

export default async function WhatsappThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const convo = await prisma.whatsappConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  if (!convo) notFound();
  if (!isSuperAdmin(user) && user.companyId !== convo.companyId) redirect("/admin/whatsapp");

  // Mark read on open.
  if (convo.unread > 0) {
    await prisma.whatsappConversation.update({ where: { id: convo.id }, data: { unread: 0 } });
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col" style={{ minHeight: "70vh" }}>
      <div className="flex items-center justify-between">
        <Link href="/admin/whatsapp" className="text-sm text-slate-500 hover:text-slate-900">
          ← WhatsApp
        </Link>
        <div className="text-right">
          <p className="font-medium text-slate-900">{convo.name || convo.waPhone}</p>
          <p className="text-xs text-slate-400">+{convo.waPhone}</p>
        </div>
      </div>

      {convo.botActive ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          <span>🤖 The enquiry bot is handling this chat (asking event questions).</span>
          <form action={takeOverConversationAction.bind(null, convo.id)}>
            <button className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:brightness-110">Take over</button>
          </form>
        </div>
      ) : null}

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        {convo.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No messages yet.</p>
        ) : (
          convo.messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                  m.direction === "OUT"
                    ? "bg-accent text-white"
                    : "border border-slate-200 bg-white text-slate-900"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${m.direction === "OUT" ? "text-white/70" : "text-slate-400"}`}>
                  {m.createdAt.toISOString().slice(11, 16)}
                  {m.direction === "OUT" ? ` · ${m.status}` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3">
        <WhatsappReply conversationId={convo.id} />
      </div>
    </section>
  );
}
