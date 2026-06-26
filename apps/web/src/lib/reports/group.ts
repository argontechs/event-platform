import { prisma } from "@event/db";

export type CompanyReportRow = {
  companyId: string;
  name: string;
  leads: number;
  accepted: number;
  activeEvents: number;
  upcoming: number;
  revenue: number; // confirmed payments
  outstanding: number; // open booking balances
};

export type GroupReport = {
  rows: CompanyReportRow[];
  totals: Omit<CompanyReportRow, "companyId" | "name">;
};

/** Aggregate consolidated metrics across all companies (super-admin view). */
export async function buildGroupReport(): Promise<GroupReport> {
  const now = new Date();
  const [companies, revenue, balances, active, leads, accepted, upcoming] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.payment.groupBy({ by: ["companyId"], where: { status: "CONFIRMED" }, _sum: { amount: true } }),
    prisma.booking.groupBy({
      by: ["companyId"],
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      _sum: { balanceDue: true },
    }),
    // Active = currently in the production pipeline (not completed/closed/cancelled).
    prisma.booking.groupBy({
      by: ["companyId"],
      where: { status: { in: ["CONFIRMED", "IN_PLANNING", "READY"] } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({ by: ["companyId"], _count: { _all: true } }),
    prisma.quotation.groupBy({ by: ["companyId"], where: { status: "ACCEPTED" }, _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["companyId"],
      where: { eventDate: { gte: now }, status: { notIn: ["CLOSED", "CANCELLED"] } },
      _count: { _all: true },
    }),
  ]);

  const revMap = new Map(revenue.map((r) => [r.companyId, Number(r._sum.amount ?? 0)]));
  const balMap = new Map(balances.map((b) => [b.companyId, Number(b._sum.balanceDue ?? 0)]));
  const evtMap = new Map(active.map((b) => [b.companyId, b._count._all]));
  const leadMap = new Map(leads.map((l) => [l.companyId, l._count._all]));
  const accMap = new Map(accepted.map((a) => [a.companyId, a._count._all]));
  const upMap = new Map(upcoming.map((u) => [u.companyId, u._count._all]));

  const rows: CompanyReportRow[] = companies.map((c) => ({
    companyId: c.id,
    name: c.name,
    leads: leadMap.get(c.id) ?? 0,
    accepted: accMap.get(c.id) ?? 0,
    activeEvents: evtMap.get(c.id) ?? 0,
    upcoming: upMap.get(c.id) ?? 0,
    revenue: revMap.get(c.id) ?? 0,
    outstanding: balMap.get(c.id) ?? 0,
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      accepted: acc.accepted + r.accepted,
      activeEvents: acc.activeEvents + r.activeEvents,
      upcoming: acc.upcoming + r.upcoming,
      revenue: acc.revenue + r.revenue,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { leads: 0, accepted: 0, activeEvents: 0, upcoming: 0, revenue: 0, outstanding: 0 },
  );

  return { rows, totals };
}
