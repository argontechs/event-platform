import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin, canManageCompany } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { PrintButton } from "@/components/admin/print-button";
import { PettyCashForms } from "@/components/admin/petty-cash-forms";
import { approvePettyAction, rejectPettyAction, deletePettyAction } from "@/lib/petty-cash/actions";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: Date): string {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Resolve a period shortcut / from-to into [start, end). Empty = all time.
function pcRange(period: string, from: string, to: string): { start?: Date; end?: Date } {
  const now = new Date();
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return { start: d0, end: new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1) };
  if (period === "week") {
    const dow = (d0.getDay() + 6) % 7;
    const s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - dow);
    return { start: s, end: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7) };
  }
  if (period === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  const r: { start?: Date; end?: Date } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) r.start = new Date(from + "T00:00:00");
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { const e = new Date(to + "T00:00:00"); r.end = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1); }
  return r;
}

export default async function PettyCashPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string }>;
}) {
  const user = await requireUser();
  const lang = await getBoLang();
  const t = makeT(lang);
  const companyId = isSuperAdmin(user) ? await getActiveCompanyId(user) : user.companyId;

  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Petty cash")}</h1>
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-slate-800">
          {t("Pick a company from the switcher above to view its data.")}
        </p>
      </section>
    );
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const allEntries = await prisma.pettyCashEntry.findMany({
    where: { companyId },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    include: { submittedBy: { select: { name: true } } },
  });

  const sp = await searchParams;
  const period = sp.period ?? "";
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const q = (sp.q ?? "").trim().toLowerCase();
  const { start, end } = pcRange(period, from, to);
  const filtered = !!(start || end);
  const inPeriod = (d: Date) => (!start || d >= start) && (!end || d < end);
  const sign = (e: { type: string }) => (e.type === "TOPUP" ? 1 : -1);

  // Opening balance = approved movements BEFORE the period start.
  const opening = start
    ? allEntries
        .filter((e) => e.status === "APPROVED" && e.entryDate < start)
        .reduce((s, e) => s + sign(e) * Number(e.amount), 0)
    : 0;

  // Entries shown = within the period (+ keyword match on pay-to / description).
  const periodEntries = allEntries.filter(
    (e) =>
      inPeriod(e.entryDate) &&
      (!q || (e.payTo ?? "").toLowerCase().includes(q) || e.description.toLowerCase().includes(q)),
  );

  const manager = canManageCompany(user);
  const approvedIn = periodEntries.filter((e) => e.type === "TOPUP" && e.status === "APPROVED").reduce((s, e) => s + Number(e.amount), 0);
  const approvedOut = periodEntries.filter((e) => e.type === "SPEND" && e.status === "APPROVED").reduce((s, e) => s + Number(e.amount), 0);
  const pendingOut = periodEntries.filter((e) => e.type === "SPEND" && e.status === "PENDING").reduce((s, e) => s + Number(e.amount), 0);
  const closing = opening + approvedIn - approvedOut;
  const balance = closing;

  // Running balance starts from the opening balance and accumulates per period entry.
  let run = opening;
  const rows = periodEntries.map((e) => {
    const isIn = e.type === "TOPUP";
    if (e.status === "APPROVED") run += isIn ? Number(e.amount) : -Number(e.amount);
    return { e, isIn, balance: e.status === "APPROVED" ? run : null };
  });

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const base = { period, from, to, q, ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/petty-cash${s ? `?${s}` : ""}`;
  };
  const pillCls = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`;

  const addr = company
    ? [company.addressLine1, company.addressLine2, [company.postcode, company.city].filter(Boolean).join(" "), company.state]
        .filter(Boolean)
        .join(", ")
    : "";

  const STATUS: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    REJECTED: "bg-red-50 text-red-600",
  };

  return (
    <section className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">{t("Petty cash")}</h1>
        <PrintButton label={t("Save as PDF")} />
      </div>

      <div className="print-document mt-4">
        {/* Company header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
          <div className="flex items-start gap-3">
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-12 w-12 object-contain" />
            ) : null}
            <div>
              <p className="font-bold text-slate-900">{company?.legalName ?? company?.name}</p>
              {company?.ssmRegNo ? <p className="text-[11px] text-slate-600">Reg No: {company.ssmRegNo}</p> : null}
              {addr ? <p className="text-[11px] text-slate-600">{addr}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">PETTY CASH</p>
            <p className="text-[11px] text-slate-500">{t("Reimbursement statement")}</p>
            {filtered ? <p className="text-[11px] font-medium text-slate-600">{from || (start ? isoDay(start) : "")} → {to || (end ? isoDay(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)) : "")}</p> : null}
          </div>
        </div>

        {/* Balance summary — opening → movements → closing for the period */}
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {filtered ? <Stat label={t("Opening balance")} value={rm(opening)} tone="text-slate-700" /> : null}
          <Stat label={t("Cash in (approved)")} value={rm(approvedIn)} tone="text-emerald-700" />
          <Stat label={t("Cash out (approved)")} value={rm(approvedOut)} tone="text-red-600" />
          <Stat label={filtered ? t("Closing balance") : t("Balance in hand")} value={rm(closing)} tone="text-slate-900" />
          <Stat label={t("Pending approval")} value={rm(pendingOut)} tone="text-amber-600" />
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-2 print:hidden">
          <div className="flex flex-wrap gap-1.5">
            <Link href={qs({ period: "", from: "", to: "" })} className={pillCls(!filtered)}>{t("All time")}</Link>
            <Link href={qs({ period: "today", from: "", to: "" })} className={pillCls(period === "today")}>{t("Today")}</Link>
            <Link href={qs({ period: "week", from: "", to: "" })} className={pillCls(period === "week")}>{t("This week")}</Link>
            <Link href={qs({ period: "month", from: "", to: "" })} className={pillCls(period === "month")}>{t("This month")}</Link>
          </div>
          <form action="/admin/petty-cash" className="flex flex-wrap items-center gap-2">
            <input name="q" defaultValue={sp.q ?? ""} placeholder={t("Search pay-to / description…")}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent" />
            <label className="flex items-center gap-1 text-xs text-slate-500">{t("From")}
              <input name="from" type="date" defaultValue={from} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900" /></label>
            <label className="flex items-center gap-1 text-xs text-slate-500">{t("To")}
              <input name="to" type="date" defaultValue={to} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900" /></label>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110">{t("Search")}</button>
          </form>
        </div>

        {/* Ledger */}
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("Date")}</th>
                <th className="px-3 py-2">{t("Pay to")}</th>
                <th className="px-3 py-2">{t("Description")}</th>
                <th className="px-3 py-2 text-right">{t("In")}</th>
                <th className="px-3 py-2 text-right">{t("Out")}</th>
                <th className="px-3 py-2 text-right">{t("Balance")}</th>
                <th className="px-3 py-2">{t("Status")}</th>
                <th className="px-3 py-2 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {filtered ? (
                <tr className="border-t border-slate-100 bg-slate-50/60">
                  <td className="px-3 py-2 text-slate-500" colSpan={5}>{t("Opening balance")}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{opening.toFixed(2)}</td>
                  <td className="px-3 py-2" colSpan={2}></td>
                </tr>
              ) : null}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">{t("No entries yet.")}</td>
                </tr>
              ) : (
                rows.map(({ e, isIn, balance }) => (
                  <tr key={e.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-slate-600">{fmtDate(e.entryDate)}</td>
                    <td className="px-3 py-2 text-slate-700">{e.payTo ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-900">
                      {e.description}
                      {e.category ? <span className="ml-2 text-xs text-slate-400">· {e.category}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700">{isIn ? Number(e.amount).toFixed(2) : ""}</td>
                    <td className="px-3 py-2 text-right text-red-600">{!isIn ? Number(e.amount).toFixed(2) : ""}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{balance !== null ? balance.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS[e.status] ?? ""}`}>
                        {e.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 print:hidden">
                      {manager && e.status === "PENDING" ? (
                        <div className="flex gap-1">
                          <form action={approvePettyAction.bind(null, e.id)}>
                            <button className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">✓</button>
                          </form>
                          <form action={rejectPettyAction.bind(null, e.id)}>
                            <button className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">✕</button>
                          </form>
                        </div>
                      ) : manager ? (
                        <form action={deletePettyAction.bind(null, e.id)}>
                          <button className="text-xs text-slate-400 hover:text-red-500">{t("Delete")}</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-right text-xs text-slate-500">
          {t("Balance in hand")}: <span className="font-semibold text-slate-800">{rm(balance)}</span>
        </p>
      </div>

      {/* Add forms (not printed) */}
      <div className="mt-8 print:hidden">
        <PettyCashForms isManager={manager} />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
