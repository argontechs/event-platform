import Link from "next/link";
import { prisma } from "@event/db";
import { requireSuperAdmin } from "@/lib/auth/rbac";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function CompaniesListPage() {
  await requireSuperAdmin();
  const t = makeT(await getBoLang());
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sstRegistered: true,
      customDomains: true,
      defaultProfitPercent: true,
    },
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Companies")}</h1>
        <Link
          href="/admin/companies/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          {t("+ New company")}
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Name")}</th>
              <th className="px-4 py-3 font-medium">{t("SST")}</th>
              <th className="px-4 py-3 font-medium">{t("Default profit")}</th>
              <th className="px-4 py-3 font-medium">{t("Domains")}</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {t("No companies yet. Create your first one.")}
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-t border-slate-200 hover:bg-white">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${c.id}`} className="text-slate-900 hover:text-accent">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.sstRegistered ? t("Registered") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {String(c.defaultProfitPercent)}%
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {c.customDomains.join(", ") || "—"}
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
