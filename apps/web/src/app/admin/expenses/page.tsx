import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  REIMBURSED: "bg-blue-50 text-blue-700",
};
const STATUS_ZH: Record<string, string> = {
  SUBMITTED: "待审批",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  REIMBURSED: "已报销",
};
const CAT_ZH: Record<string, string> = {
  MATERIALS: "材料",
  TRANSPORT: "交通",
  RENTAL: "租赁",
  FOOD: "餐饮",
  MARKETING: "营销",
  SALARY: "薪资",
  MISC: "其他",
};
const CATEGORIES = ["MATERIALS", "TRANSPORT", "RENTAL", "FOOD", "MARKETING", "SALARY", "MISC"];

// Resolve a daily/weekly/monthly shortcut (or explicit from/to) into a range.
function rangeFor(period: string, from: string, to: string): { gte?: Date; lt?: Date } {
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return { gte: d0, lt: new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1) };
  if (period === "week") {
    const dow = (d0.getDay() + 6) % 7;
    const s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - dow);
    return { gte: s, lt: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7) };
  }
  if (period === "month") return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  const r: { gte?: Date; lt?: Date } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) r.gte = new Date(from + "T00:00:00");
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const e = new Date(to + "T00:00:00");
    r.lt = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
  }
  return r;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; cat?: string; q?: string; status?: string }>;
}) {
  const user = await requireUser();
  const lang = await getBoLang();
  const t = makeT(lang);
  const companyId = isSuperAdmin(user) ? await getActiveCompanyId(user) : user.companyId;

  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Expenses")}</h1>
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-slate-800">
          {t("Pick a company from the switcher above to view its data.")}
        </p>
      </section>
    );
  }

  const sp = await searchParams;
  const period = sp.period ?? "";
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const cat = CATEGORIES.includes(sp.cat ?? "") ? sp.cat! : "";
  const q = (sp.q ?? "").trim();
  const range = rangeFor(period, from, to);

  const where: import("@prisma/client").Prisma.ExpenseWhereInput = { companyId };
  if (range.gte || range.lt) where.expenseDate = { ...(range.gte ? { gte: range.gte } : {}), ...(range.lt ? { lt: range.lt } : {}) };
  if (cat) where.category = cat as never;
  if (q) where.vendor = { contains: q, mode: "insensitive" };

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
    take: 500,
    include: { submittedBy: { select: { name: true } }, booking: { select: { title: true } } },
  });

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const base = { period, from, to, cat, q, ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/admin/expenses?${p.toString()}`;
  };
  const pillCls = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`;

  const now = new Date();
  const inThisMonth = (d: Date) =>
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  const pendingCount = expenses.filter((e) => e.status === "SUBMITTED").length;
  const approvedThisMonth = expenses
    .filter((e) => (e.status === "APPROVED" || e.status === "REIMBURSED") && inThisMonth(e.expenseDate))
    .reduce((s, e) => s + Number(e.amount), 0);
  const pendingThisMonth = expenses
    .filter((e) => e.status === "SUBMITTED" && inThisMonth(e.expenseDate))
    .reduce((s, e) => s + Number(e.amount), 0);

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
  const catLabel = (c: string) => (lang === "zh" ? CAT_ZH[c] ?? c : c.charAt(0) + c.slice(1).toLowerCase());

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Expenses")}</h1>
        <Link
          href="/admin/expenses/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          + {t("New claim")}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {stat(t("Pending approval"), String(pendingCount))}
        {stat(t("Pending (this month)"), rm(pendingThisMonth))}
        {stat(t("Approved (this month)"), rm(approvedThisMonth))}
      </div>

      {/* Filters: period shortcuts + date range + category + keyword */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ period: "", from: "", to: "" })} className={pillCls(!period && !from && !to)}>{t("All time")}</Link>
          <Link href={qs({ period: "today", from: "", to: "" })} className={pillCls(period === "today")}>{t("Today")}</Link>
          <Link href={qs({ period: "week", from: "", to: "" })} className={pillCls(period === "week")}>{t("This week")}</Link>
          <Link href={qs({ period: "month", from: "", to: "" })} className={pillCls(period === "month")}>{t("This month")}</Link>
        </div>
        <form action="/admin/expenses" className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder={t("Search vendor…")}
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent" />
          <select name="cat" defaultValue={cat} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 [&_option]:text-slate-900">
            <option value="">{t("All categories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{lang === "zh" ? CAT_ZH[c] ?? c : c.charAt(0) + c.slice(1).toLowerCase()}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-500">{t("From")}
            <input name="from" type="date" defaultValue={from} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
          <label className="flex items-center gap-1 text-xs text-slate-500">{t("To")}
            <input name="to" type="date" defaultValue={to} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /></label>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110">{t("Search")}</button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">{t("Date")}</th>
              <th className="px-4 py-2.5">{t("Vendor / shop")}</th>
              <th className="px-4 py-2.5">{t("Category")}</th>
              <th className="px-4 py-2.5 text-right">{t("Amount paid (RM)")}</th>
              <th className="px-4 py-2.5">{t("Status")}</th>
              <th className="px-4 py-2.5">{t("Submitted by")}</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  {t("No claims yet.")}
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-700">{e.expenseDate.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-slate-900">
                    {e.vendor}
                    {e.booking ? <span className="ml-2 text-xs text-slate-400">· {e.booking.title}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{catLabel(e.category)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">{Number(e.amount).toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {lang === "zh" ? STATUS_ZH[e.status] ?? e.status : e.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{e.submittedBy?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/expenses/${e.id}`} className="text-xs text-accent hover:underline">
                      {t("View")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
