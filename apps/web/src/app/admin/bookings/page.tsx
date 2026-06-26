import Link from "next/link";
import { prisma } from "@event/db";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { ListFilters, Pagination, dateRangeFilter } from "@/components/admin/list-filters";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const STATUSES = ["CONFIRMED", "IN_PLANNING", "READY", "EXECUTED", "COMPLETED", "CLOSED", "CANCELLED"];
const PAGE_SIZE = 25;

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const t = makeT(await getBoLang());
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const sp = await searchParams;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Bookings")}</h1>
        <Link href="/planning/events/new" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
          {t("+ New booking")}
        </Link>
      </div>
      {!companyId ? (
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      ) : (
        <BookingsTable
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

async function BookingsTable({
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
  const where: Prisma.BookingWhereInput = { companyId };
  if (STATUSES.includes(status)) where.status = status as Prisma.BookingWhereInput["status"];
  if (q.trim()) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const range = dateRangeFilter(from, to);
  if (range) where.eventDate = range;

  const [bookings, total, agg] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { eventDate: "asc" },
      include: { customer: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
    prisma.booking.aggregate({ where, _sum: { totalAmount: true, balanceDue: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <ListFilters basePath="/admin/bookings" statuses={STATUSES} status={status} q={q} from={from} to={to} dates searchPlaceholder={t("Search event or customer…")} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{t("Booked value")}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">RM {money(Number(agg._sum.totalAmount ?? 0))}</p>
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
              <th className="px-4 py-3 font-medium">{t("Event")}</th>
              <th className="px-4 py-3 font-medium">{t("Customer")}</th>
              <th className="px-4 py-3 font-medium">{t("Event date")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Total")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Balance")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">{t("No bookings match.")}</td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-slate-900 hover:text-accent">
                      {b.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{b.eventDate ? b.eventDate.toISOString().slice(0, 10) : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-right text-slate-800">RM {money(Number(b.totalAmount))}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">RM {money(Number(b.balanceDue))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/bookings/${b.id}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("View")}</Link>
                      <Link href={`/planning/${b.id}`} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("Plan")}</Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination basePath="/admin/bookings" status={status} q={q} from={from} to={to} page={page} pages={pages} total={total} noun="booking" />
    </div>
  );
}
