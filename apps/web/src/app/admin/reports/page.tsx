import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/rbac";
import { buildGroupReport } from "@/lib/reports/group";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

export default async function GroupReportsPage() {
  await requireSuperAdmin();
  const t = makeT(await getBoLang());
  const { rows, totals } = await buildGroupReport();

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Group reports")}</h1>
        <a
          href="/admin/reports/export"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
        >
          {t("Export CSV")}
        </a>
      </div>
      <p className="mt-1 text-sm text-slate-500">{t("Consolidated across all companies.")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label={t("Revenue (confirmed)")} value={rm(totals.revenue)} />
        <Card label={t("Outstanding balances")} value={rm(totals.outstanding)} />
        <Card label={t("Accepted quotes")} value={String(totals.accepted)} />
        <Card label={t("Upcoming events")} value={String(totals.upcoming)} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Company")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Leads")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Accepted")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Active events")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Upcoming")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Revenue")}</th>
              <th className="px-4 py-3 font-medium text-right">{t("Outstanding")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {t("No companies yet.")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.companyId} className="border-t border-slate-200 hover:bg-white">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${r.companyId}`} className="text-slate-900 hover:text-accent">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.leads}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.accepted}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.activeEvents}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.upcoming}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{rm(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{rm(r.outstanding)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 font-medium">
                <td className="px-4 py-3 text-slate-900">{t("Total")}</td>
                <td className="px-4 py-3 text-right text-slate-800">{totals.leads}</td>
                <td className="px-4 py-3 text-right text-slate-800">{totals.accepted}</td>
                <td className="px-4 py-3 text-right text-slate-800">{totals.activeEvents}</td>
                <td className="px-4 py-3 text-right text-slate-800">{totals.upcoming}</td>
                <td className="px-4 py-3 text-right text-slate-900">{rm(totals.revenue)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{rm(totals.outstanding)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
