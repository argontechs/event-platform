import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminDashboard() {
  const user = await requireUser();
  const superAdmin = isSuperAdmin(user);
  const activeCompanyId = await getActiveCompanyId(user);

  // Company users (and super-admins with a company selected) see that company.
  // Super-admins with no selection see a group-wide rollup.
  const scope = activeCompanyId ? { companyId: activeCompanyId } : {};
  const groupView = superAdmin && !activeCompanyId;

  const company = activeCompanyId
    ? await prisma.company.findUnique({ where: { id: activeCompanyId }, select: { name: true } })
    : null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    leadsTotal,
    leadsNew,
    quotesTotal,
    quotesSent,
    activeBookings,
    invAgg,
    upcoming,
  ] = await Promise.all([
    prisma.lead.count({ where: scope }),
    prisma.lead.count({ where: { ...scope, status: { in: ["NEW", "REVIEWING"] } } }),
    prisma.quotation.count({ where: scope }),
    prisma.quotation.count({ where: { ...scope, status: "SENT" } }),
    prisma.booking.count({
      where: { ...scope, status: { in: ["CONFIRMED", "IN_PLANNING", "READY"] } },
    }),
    prisma.invoice.aggregate({ where: scope, _sum: { amountPaid: true, balanceDue: true } }),
    prisma.booking.findMany({
      where: {
        ...scope,
        eventDate: { gte: startOfToday },
        status: { notIn: ["CANCELLED", "CLOSED"] },
      },
      orderBy: { eventDate: "asc" },
      take: 6,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const collected = Number(invAgg._sum.amountPaid ?? 0);
  const outstanding = Number(invAgg._sum.balanceDue ?? 0);
  const t = makeT(await getBoLang());

  const cards = [
    { label: t("Leads"), value: String(leadsTotal), sub: `${leadsNew} ${t("new")}`, href: "/admin/leads" },
    { label: t("Quotations"), value: String(quotesTotal), sub: `${quotesSent} ${t("sent")}`, href: "/admin/quotations" },
    { label: t("Active bookings"), value: String(activeBookings), sub: t("in planning"), href: "/admin/bookings" },
    { label: t("Revenue collected"), value: rm(collected), sub: t("paid to date"), href: "/admin/invoices" },
    { label: t("Outstanding"), value: rm(outstanding), sub: t("balance due"), href: "/admin/invoices" },
  ];

  return (
    <section className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("Dashboard")}</h1>
        <p className="text-sm text-slate-600">
          {groupView ? (
            <>{t("Viewing")} <strong className="text-slate-900">{t("all companies")}</strong></>
          ) : (
            <>{t("Active company:")} <strong className="text-slate-900">{company?.name ?? "—"}</strong></>
          )}
        </p>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-accent/50 hover:shadow-sm"
          >
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* Upcoming events */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("Upcoming events")}</h2>
          <Link href="/planning" className="text-sm text-accent hover:underline">
            {t("Event Planning")} →
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Date")}</th>
                <th className="px-4 py-3 font-medium">{t("Event")}</th>
                <th className="px-4 py-3 font-medium">{t("Customer")}</th>
                <th className="px-4 py-3 font-medium">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    {t("No upcoming events.")}
                  </td>
                </tr>
              ) : (
                upcoming.map((b) => (
                  <tr key={b.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {b.eventDate ? b.eventDate.toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/planning/${b.id}`} className="text-slate-900 hover:text-accent">
                        {b.eventType.toLowerCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.status.replace("_", " ").toLowerCase()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
