import Link from "next/link";
import { prisma } from "@event/db";
import type { Prisma } from "@prisma/client";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { createManualInvoiceAction } from "@/lib/invoices/actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { ListFilters, Pagination, dateRangeFilter } from "@/components/admin/list-filters";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const STATUSES = ["ISSUED", "PARTIAL", "PAID", "VOID"];
const PAGE_SIZE = 25;

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function InvoicesPage({
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
        <h1 className="text-2xl font-semibold">{t("Invoices")}</h1>
        <NewInvoice companies={companies} t={t} />
      </div>
      {!companyId ? (
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      ) : (
        <InvoicesTable
          companyId={companyId}
          status={sp.status ?? ""}
          q={sp.q ?? ""}
          from={sp.from ?? ""}
          to={sp.to ?? ""}
          page={Math.max(1, Number(sp.page ?? "1") || 1)}
          t={t}
        />
      )}
    </section>
  );
}

function NewInvoice({ companies, t }: { companies: { id: string; name: string }[]; t: (s: string) => string }) {
  if (companies.length === 0) return null;
  return (
    <form action={createManualInvoiceAction} className="flex items-center gap-2">
      {companies.length > 1 ? (
        <select
          name="companyId"
          defaultValue={companies[0].id}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
          aria-label={t("Company for new invoice")}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="companyId" value={companies[0].id} />
      )}
      <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
        {t("+ New invoice")}
      </button>
    </form>
  );
}

type CustomerSnapshot = { name?: string };

async function InvoicesTable({
  companyId,
  status,
  q,
  from,
  to,
  page,
  t,
}: {
  companyId: string;
  status: string;
  q: string;
  from: string;
  to: string;
  page: number;
  t: (s: string) => string;
}) {
  const where: Prisma.InvoiceWhereInput = { companyId };
  if (STATUSES.includes(status)) where.status = status as Prisma.InvoiceWhereInput["status"];
  if (q.trim()) where.number = { contains: q, mode: "insensitive" };
  const range = dateRangeFilter(from, to);
  if (range) where.issuedAt = range;

  const [invoices, total, agg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where, _sum: { total: true, balanceDue: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <ListFilters basePath="/admin/invoices" statuses={STATUSES} status={status} q={q} from={from} to={to} dates searchPlaceholder={t("Search invoice number…")} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("Invoiced")} ({status ? status.toLowerCase() : "all"})</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">RM {money(Number(agg._sum.total ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("Outstanding balance")}</p>
          <p className="mt-1 text-xl font-semibold text-red-600">RM {money(Number(agg._sum.balanceDue ?? 0))}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Number")}</th>
              <th className="px-4 py-3 font-medium">{t("Customer")}</th>
              <th className="px-4 py-3 font-medium">{t("Issued")}</th>
              <th className="px-4 py-3 font-medium">{t("Type")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Total")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Balance")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("No invoices match.")}</td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const cust = (inv.customerSnapshot ?? {}) as CustomerSnapshot;
                return (
                  <tr key={inv.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-accent">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{cust.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{inv.issuedAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.type.toLowerCase()}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-right text-slate-800">RM {money(Number(inv.total))}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">RM {money(Number(inv.balanceDue))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/invoices/${inv.id}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("View")}</Link>
                        <Link href={`/admin/invoices/${inv.id}/edit`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("Edit")}</Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/admin/invoices" status={status} q={q} from={from} to={to} page={page} pages={pages} total={total} noun="invoice" />
    </div>
  );
}
