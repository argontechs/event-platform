import Link from "next/link";
import { prisma } from "@event/db";
import type { Prisma } from "@prisma/client";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { createManualQuotationAction, sendQuotationAction } from "@/lib/quotations/actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { ListFilters, Pagination, dateRangeFilter } from "@/components/admin/list-filters";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
const PAGE_SIZE = 25;

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const t = makeT(await getBoLang());
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const sp = await searchParams;

  const companies = isSuperAdmin(user)
    ? await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : user.companyId
      ? await prisma.company.findMany({ where: { id: user.companyId }, select: { id: true, name: true } })
      : [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Quotations")}</h1>
        <NewQuotation companies={companies} />
      </div>
      {!companyId ? (
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      ) : (
        <QuotationsTable
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

async function NewQuotation({ companies }: { companies: { id: string; name: string }[] }) {
  if (companies.length === 0) return null;
  const t = makeT(await getBoLang());
  return (
    <form action={createManualQuotationAction} className="flex items-center gap-2">
      {companies.length > 1 ? (
        <select
          name="companyId"
          defaultValue={companies[0].id}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
          aria-label={t("Company for new quotation")}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="companyId" value={companies[0].id} />
      )}
      <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
        {t("+ New quotation")}
      </button>
    </form>
  );
}

async function QuotationsTable({
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
  const where: Prisma.QuotationWhereInput = { companyId };
  if (STATUSES.includes(status)) where.status = status as Prisma.QuotationWhereInput["status"];
  if (q.trim()) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const range = dateRangeFilter(from, to);
  if (range) where.createdAt = range;

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { customer: true, _count: { select: { items: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.quotation.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <ListFilters basePath="/admin/quotations" statuses={STATUSES} status={status} q={q} from={from} to={to} dates searchPlaceholder={t("Search number or customer…")} />

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Number")}</th>
              <th className="px-4 py-3 font-medium">{t("Customer")}</th>
              <th className="px-4 py-3 font-medium">{t("Event date")}</th>
              <th className="px-4 py-3 font-medium">{t("Created")}</th>
              <th className="px-4 py-3 font-medium">{t("Items")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Total")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("No quotations match.")}</td>
              </tr>
            ) : (
              quotations.map((qt) => (
                <tr key={qt.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/quotations/${qt.id}`} className="font-medium text-slate-900 hover:text-accent">
                      {qt.number}
                    </Link>
                    {qt.changesRequested ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{t("changes")}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{qt.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{qt.eventDate ? qt.eventDate.toISOString().slice(0, 10) : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{qt.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-500">{qt._count.items}</td>
                  <td className="px-4 py-3"><StatusBadge status={qt.status} /></td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">RM {money(Number(qt.total))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/quotations/${qt.id}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">
                        {t("Open")}
                      </Link>
                      <Link href={`/admin/quotations/${qt.id}/preview`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">
                        {t("PDF")}
                      </Link>
                      {qt.status === "DRAFT" ? (
                        <form action={sendQuotationAction.bind(null, qt.id)}>
                          <button className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:brightness-110">{t("Send")}</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/admin/quotations" status={status} q={q} from={from} to={to} page={page} pages={pages} total={total} noun="quotation" />
    </div>
  );
}
