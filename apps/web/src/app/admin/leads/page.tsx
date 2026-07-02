import Link from "next/link";
import { prisma } from "@event/db";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { dateRangeFilter } from "@/components/admin/list-filters";
import { createQuotationForLead } from "@/lib/quotations/actions";
import { updateLeadStatusAction } from "@/lib/leads/actions";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "REVIEWING", "QUOTED", "ACCEPTED", "REJECTED", "CONVERTED", "LOST"];
const PAGE_SIZE = 25;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const sp = await searchParams;
  const t = makeT(await getBoLang());

  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("Leads")}</h1>
      {!companyId ? (
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      ) : (
        <LeadsTable
          companyId={companyId}
          status={sp.status ?? ""}
          q={sp.q ?? ""}
          from={sp.from ?? ""}
          to={sp.to ?? ""}
          page={Math.max(1, Number(sp.page ?? "1") || 1)}
        />
      )}
    </section>
  );
}

async function LeadsTable({
  companyId,
  status,
  q,
  from,
  to,
  page,
}: {
  companyId: string;
  status: string;
  q: string;
  from: string;
  to: string;
  page: number;
}) {
  const t = makeT(await getBoLang());
  const where: Prisma.LeadWhereInput = { companyId };
  if (STATUSES.includes(status)) where.status = status as Prisma.LeadWhereInput["status"];
  if (q.trim()) {
    where.OR = [
      { referenceNo: { contains: q, mode: "insensitive" } },
      { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
      { customer: { is: { email: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const range = dateRangeFilter(from, to);
  if (range) where.createdAt = range;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { customer: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    for (const [k, v] of Object.entries(patch)) p.set(k, String(v));
    return `?${p.toString()}`;
  };

  const tab =
    "rounded-full px-3 py-1.5 text-sm transition";

  return (
    <div className="mt-6">
      {/* Filters */}
      <form className="flex flex-wrap items-center gap-2" action="/admin/leads">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("Search reference, name or email…")}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
        <label className="flex items-center gap-1 text-xs text-slate-500">{t("From")}
          <input name="from" type="date" defaultValue={from} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900" /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">{t("To")}
          <input name="to" type="date" defaultValue={to} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900" /></label>
        <input type="hidden" name="status" value={status} />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
          {t("Search")}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href={qs({ page: 1, status: "" }).replace(/status=&?/, "")} className={`${tab} ${!status ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
          {t("All")}
        </Link>
        {STATUSES.map((st) => (
          <Link
            key={st}
            href={`?${new URLSearchParams({ ...(q ? { q } : {}), status: st, page: "1" }).toString()}`}
            className={`${tab} ${status === st ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
          >
            {st.toLowerCase()}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Reference")}</th>
              <th className="px-4 py-3 font-medium">{t("Customer")}</th>
              <th className="px-4 py-3 font-medium">{t("Event")}</th>
              <th className="px-4 py-3 font-medium">{t("Date")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t("No leads match.")}</td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/leads/${l.id}`} className="text-slate-900 hover:text-accent">
                      {l.referenceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{l.eventType.toLowerCase()}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.eventDate ? l.eventDate.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/leads/${l.id}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">
                        {t("View")}
                      </Link>
                      {["NEW", "REVIEWING"].includes(l.status) ? (
                        <>
                          <form action={createQuotationForLead.bind(null, l.id)}>
                            <button className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:brightness-110">{t("+ Quote")}</button>
                          </form>
                          <form action={updateLeadStatusAction.bind(null, l.id)}>
                            <input type="hidden" name="status" value="LOST" />
                            <ConfirmSubmit
                              label={t("Lost")}
                              title={t("Mark this lead as lost?")}
                              confirmLabel={t("Mark as lost")}
                              buttonClassName="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                            />
                          </form>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>{total} {total === 1 ? t("lead") : t("leads")}</span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={qs({ page: page - 1 })} className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-100">{t("Prev")}</Link>
          ) : null}
          <span>{t("Page")} {page} / {pages}</span>
          {page < pages ? (
            <Link href={qs({ page: page + 1 })} className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-100">{t("Next")}</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
