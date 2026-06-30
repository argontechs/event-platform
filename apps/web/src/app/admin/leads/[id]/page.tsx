import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { createQuotationForLead } from "@/lib/quotations/actions";
import { updateLeadStatusAction } from "@/lib/leads/actions";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";
import { CopyButton } from "@/components/ui/copy-button";

const LEAD_STATUSES = ["NEW", "REVIEWING", "QUOTED", "ACCEPTED", "REJECTED", "CONVERTED", "LOST"];

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = makeT(await getBoLang());

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { customer: true, attachments: true, quotations: true },
  });
  if (!lead) notFound();
  if (!isSuperAdmin(user) && user.companyId !== lead.companyId) redirect("/admin/leads");

  const images = lead.attachments.filter((a) => a.kind === "REFERENCE");
  const createAction = createQuotationForLead.bind(null, lead.id);

  const facts: [string, string][] = [
    [t("Event"), lead.eventType.toLowerCase()],
    [t("Date"), lead.eventDate ? lead.eventDate.toISOString().slice(0, 10) : "—"],
    [t("Time"), lead.eventTime ?? "—"],
    [t("Venue"), lead.venueText ?? "—"],
    [t("Guests"), lead.guestCount ? String(lead.guestCount) : "—"],
    [t("Budget (RM)"), `${lead.budgetMin ?? "?"} – ${lead.budgetMax ?? "?"}`],
    [t("Purpose"), lead.purpose ?? "—"],
  ];

  return (
    <section className="max-w-4xl">
      <Link href="/admin/leads" className="text-sm text-slate-500 hover:text-slate-900">
        ← {t("Leads")}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{lead.referenceNo}</h1>
        <form action={updateLeadStatusAction.bind(null, lead.id)} className="flex items-center gap-2">
          <select
            name="status"
            defaultValue={lead.status}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-accent"
            aria-label={t("Lead status")}
          >
            {LEAD_STATUSES.map((st) => (
              <option key={st} value={st}>{st.toLowerCase()}</option>
            ))}
          </select>
          <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100">
            {t("Update")}
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {lead.customer?.name} · {lead.customer?.email} · {lead.customer?.phone}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
            <span className="text-slate-400">{k}: </span>
            <span className="text-slate-900">{v}</span>
          </div>
        ))}
      </div>

      {lead.theme ? (
        <p className="mt-4 text-sm text-slate-600">
          <span className="text-slate-400">{t("Theme & preferences:")} </span>
          {lead.theme}
        </p>
      ) : null}
      {lead.specialRequest ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="text-slate-400">{t("Special request:")} </span>
          {lead.specialRequest}
        </p>
      ) : null}

      {/* Reference images */}
      {images.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm uppercase tracking-wide text-slate-500">{t("Reference images")}</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={a.url}
                alt={a.filename ?? "reference"}
                className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Request more photos from the customer */}
      {lead.uploadToken ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-900">{t("Request more photos")}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {t("Share this password-protected link so the customer can upload extra reference photos straight onto this lead.")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {(process.env.APP_BASE_URL ?? "")}/lead/{lead.uploadToken}
            </code>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {t("Access code:")} <strong className="text-slate-900">{lead.uploadPin}</strong>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton
              label={t("Copy link")}
              copiedLabel={t("Copied")}
              text={`${process.env.APP_BASE_URL ?? ""}/lead/${lead.uploadToken}`}
            />
            <CopyButton
              label={t("Copy link + code")}
              copiedLabel={t("Copied")}
              text={`${process.env.APP_BASE_URL ?? ""}/lead/${lead.uploadToken}\n${t("Access code:")} ${lead.uploadPin}`}
            />
          </div>
        </div>
      ) : null}

      {/* Quotations */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("Quotations")}</h2>
        <form action={createAction}>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
            {t("+ Create quotation")}
          </button>
        </form>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {lead.quotations.length === 0 ? (
          <p className="text-sm text-slate-400">
            {t("None yet. Create one, then generate with AI or build it manually.")}
          </p>
        ) : (
          lead.quotations.map((q) => (
            <Link
              key={q.id}
              href={`/admin/quotations/${q.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-white"
            >
              <span className="text-slate-900">{q.number}</span>
              <span className="text-slate-500">
                {q.status.toLowerCase()} · RM {Number(q.total).toFixed(2)}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
