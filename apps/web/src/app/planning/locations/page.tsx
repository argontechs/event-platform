import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const t = makeT(await getBoLang());

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Locations")}</h1>
        <Link
          href="/planning/locations/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          {t("+ New location")}
        </Link>
      </div>
      {!companyId ? (
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      ) : (
        <List companyId={companyId} />
      )}
    </section>
  );
}

async function List({ companyId }: { companyId: string }) {
  const t = makeT(await getBoLang());
  const locations = await prisma.location.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  if (locations.length === 0) {
    return <p className="mt-6 text-sm text-slate-400">{t("No locations yet.")}</p>;
  }
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {locations.map((l) => (
        <Link
          key={l.id}
          href={`/planning/locations/${l.id}`}
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-accent/40"
        >
          <p className="font-medium text-slate-900">{l.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {[l.city, l.state].filter(Boolean).join(", ") || "—"}
            {l.capacity ? ` · ${t("up to")} ${l.capacity}` : ""}
          </p>
        </Link>
      ))}
    </div>
  );
}
