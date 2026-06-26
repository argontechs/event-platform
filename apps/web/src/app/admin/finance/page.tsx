import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin, canManageCompany } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { PrintButton } from "@/components/admin/print-button";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Cost of Sales = direct event costs; everything else is Operating Expenses.
const COGS_EXP = new Set(["MATERIALS", "TRANSPORT", "RENTAL"]);
const COGS_PETTY = new Set(["Petrol", "Parking", "Hardware", "Transport", "Shipping"]);

type Period = "day" | "week" | "month";

function periodRange(period: Period, anchor: Date) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  let start: Date, end: Date, step: (n: number) => Date;
  if (period === "day") {
    start = a;
    end = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1);
    step = (n) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + n);
  } else if (period === "week") {
    const dow = (a.getDay() + 6) % 7; // Monday = 0
    start = new Date(a.getFullYear(), a.getMonth(), a.getDate() - dow);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    step = (n) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7);
  } else {
    start = new Date(a.getFullYear(), a.getMonth(), 1);
    end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    step = (n) => new Date(a.getFullYear(), a.getMonth() + n, 1);
  }
  return { start, end, prev: step(-1), next: step(1) };
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const user = await requireUser();
  const lang = await getBoLang();
  const t = makeT(lang);

  if (!canManageCompany(user)) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Finance (P&L)")}</h1>
        <p className="mt-3 text-sm text-slate-500">{t("You don't have access to staff management.")}</p>
      </section>
    );
  }
  const companyId = isSuperAdmin(user) ? await getActiveCompanyId(user) : user.companyId;
  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Finance (P&L)")}</h1>
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-slate-800">
          {t("Pick a company from the switcher above to view its data.")}
        </p>
      </section>
    );
  }
  const company = await prisma.company.findUnique({ where: { id: companyId } });

  const sp = await searchParams;
  const period: Period = sp.period === "day" || sp.period === "week" ? sp.period : "month";
  const anchor = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? new Date(sp.date + "T00:00:00") : new Date();
  const { start, end, prev, next } = periodRange(period, anchor);
  const inRange = (d: Date | null | undefined) => !!d && d >= start && d < end;

  // Income — confirmed payments.
  const payments = await prisma.payment.findMany({
    where: { companyId, status: "CONFIRMED" },
    select: { amount: true, confirmedAt: true, createdAt: true },
    take: 5000,
  });
  const income = payments.filter((p) => inRange(p.confirmedAt ?? p.createdAt)).reduce((s, p) => s + Number(p.amount), 0);

  // Expenses + petty cash → COGS vs Operating, by category.
  const expenses = await prisma.expense.findMany({
    where: { companyId, status: { in: ["APPROVED", "REIMBURSED"] } },
    select: { amount: true, category: true, expenseDate: true },
    take: 8000,
  });
  const petty = await prisma.pettyCashEntry.findMany({
    where: { companyId, type: "SPEND", status: "APPROVED" },
    select: { amount: true, category: true, entryDate: true },
    take: 8000,
  });

  const cogs = new Map<string, number>();
  const opex = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

  for (const e of expenses) {
    if (!inRange(e.expenseDate)) continue;
    const label = e.category.charAt(0) + e.category.slice(1).toLowerCase();
    (COGS_EXP.has(e.category) ? add(cogs, label, Number(e.amount)) : add(opex, label, Number(e.amount)));
  }
  for (const p of petty) {
    if (!inRange(p.entryDate)) continue;
    const cat = p.category || "Petty cash";
    const label = `${cat} (petty)`;
    (COGS_PETTY.has(cat) ? add(cogs, label, Number(p.amount)) : add(opex, label, Number(p.amount)));
  }

  const cogsTotal = [...cogs.values()].reduce((a, b) => a + b, 0);
  const opexTotal = [...opex.values()].reduce((a, b) => a + b, 0);
  const grossProfit = income - cogsTotal;
  const netProfit = grossProfit - opexTotal;
  const grossMargin = income > 0 ? (grossProfit / income) * 100 : 0;
  const netMargin = income > 0 ? (netProfit / income) * 100 : 0;

  // Expenses analysis (all categories, % of total expenses).
  const totalExp = cogsTotal + opexTotal;
  const analysis = [...cogs.entries(), ...opex.entries()]
    .map(([k, v]) => ({ category: k, amount: v, pct: totalExp > 0 ? (v / totalExp) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const periodLabel =
    period === "day"
      ? start.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-MY", { day: "numeric", month: "long", year: "numeric" })
      : period === "week"
        ? `${isoDay(start)} → ${isoDay(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1))}`
        : start.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-MY", { month: "long", year: "numeric" });

  const tab = (p: Period, label: string) => (
    <Link
      href={`/admin/finance?period=${p}&date=${isoDay(anchor)}`}
      className={`rounded-md px-3 py-1.5 text-sm ${period === p ? "bg-accent text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </Link>
  );

  return (
    <section className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">{t("Finance — P&L")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {tab("day", t("Daily"))}
          {tab("week", t("Weekly"))}
          {tab("month", t("Monthly"))}
          <form action="/admin/finance" className="flex items-center gap-1">
            <input type="hidden" name="period" value={period} />
            <input name="date" type="date" defaultValue={isoDay(anchor)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900" />
            <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">{t("Go")}</button>
          </form>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between print:hidden">
        <Link href={`/admin/finance?period=${period}&date=${isoDay(prev)}`} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100">← {t("Previous")}</Link>
        <span className="text-sm font-medium">{periodLabel}</span>
        <Link href={`/admin/finance?period=${period}&date=${isoDay(next)}`} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100">{t("Next")} →</Link>
      </div>

      <div className="print-document mt-5">
        {/* Company header */}
        <div className="flex items-start justify-between border-b border-slate-300 pb-3">
          <div className="flex items-start gap-3">
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-12 w-12 object-contain" />
            ) : null}
            <div>
              <p className="font-bold text-slate-900">{company?.legalName ?? company?.name}</p>
              {company?.ssmRegNo ? <p className="text-[11px] text-slate-600">Reg No: {company.ssmRegNo}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">{t("Profit & Loss Statement")}</p>
            <p className="text-[11px] text-slate-500">{periodLabel}</p>
          </div>
        </div>

        {/* P&L statement — Malaysian format */}
        <table className="mt-4 w-full text-sm">
          <tbody>
            <PLRow label={t("Revenue")} value={rm(income)} bold />
            <PLHead label={t("Less: Cost of Sales")} />
            {[...cogs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <PLRow key={k} label={k} value={`(${rm(v)})`} indent />
            ))}
            <PLRow label={t("Total Cost of Sales")} value={`(${rm(cogsTotal)})`} sub />
            <PLRow label={`${t("Gross Profit")} (${grossMargin.toFixed(1)}%)`} value={rm(grossProfit)} bold border />
            <PLHead label={t("Less: Operating Expenses")} />
            {[...opex.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <PLRow key={k} label={k} value={`(${rm(v)})`} indent />
            ))}
            <PLRow label={t("Total Operating Expenses")} value={`(${rm(opexTotal)})`} sub />
            <tr className="border-t-2 border-slate-800">
              <td className="py-2 font-bold">{t("Net Profit / (Loss)")} ({netMargin.toFixed(1)}%)</td>
              <td className={`py-2 text-right font-bold ${netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {netProfit >= 0 ? rm(netProfit) : `(${rm(Math.abs(netProfit))})`}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Expenses analysis */}
        <div className="page-break mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t("Expenses Analysis")}</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5">{t("Category")}</th>
                <th className="py-1.5 text-right">{t("Amount")}</th>
                <th className="w-16 py-1.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {analysis.length === 0 ? (
                <tr><td colSpan={3} className="py-3 text-slate-400">{t("No approved expenses this month.")}</td></tr>
              ) : (
                analysis.map((a) => (
                  <tr key={a.category} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-700">{a.category}</td>
                    <td className="py-1.5 text-right">{rm(a.amount)}</td>
                    <td className="py-1.5 text-right text-slate-500">{a.pct.toFixed(1)}%</td>
                  </tr>
                ))
              )}
              <tr className="border-t-2 border-slate-400 font-semibold">
                <td className="py-1.5">{t("Total Expenses")}</td>
                <td className="py-1.5 text-right">{rm(totalExp)}</td>
                <td className="py-1.5 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          {t("Revenue = confirmed payments. Cost of Sales = event materials/transport/rental + event petty cash. Operating = overhead.")}
        </p>
      </div>

      <div className="mt-4 print:hidden">
        <PrintButton label={t("Save as PDF")} />
      </div>
    </section>
  );
}

function PLRow({ label, value, bold, sub, indent, border }: { label: string; value: string; bold?: boolean; sub?: boolean; indent?: boolean; border?: boolean }) {
  return (
    <tr className={border ? "border-t border-slate-300" : ""}>
      <td className={`py-1 ${bold ? "font-bold" : ""} ${sub ? "text-slate-500" : ""} ${indent ? "pl-4 text-slate-600" : ""}`}>{label}</td>
      <td className={`py-1 text-right ${bold ? "font-bold" : ""} ${sub ? "text-slate-500" : ""}`}>{value}</td>
    </tr>
  );
}
function PLHead({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</td>
    </tr>
  );
}
