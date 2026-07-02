import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { PackageCreateForm } from "@/components/admin/package-create-form";
import { addPackageImagesAction, deletePackageAction, togglePackageAction } from "@/lib/packages/actions";
import { parseInclusions, clampPage } from "@/lib/packages/format";
import { ZoomableImage } from "@/components/site/zoomable-image";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function PackagesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = makeT(await getBoLang());
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const canManage = isSuperAdmin(user) || user.role === "COMPANY_ADMIN" || user.role === "SALES";

  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Packages")}</h1>
        <div className="mt-6"><SelectCompanyNotice /></div>
      </section>
    );
  }

  const total = await prisma.package.count({ where: { companyId } });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = clampPage((await searchParams).page, pages);
  const packages = await prisma.package.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
  });

  return (
    <section className="max-w-4xl">
      <h1 className="text-2xl font-semibold">{t("Packages")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("Your menu of services — shown on the public site and handy when building quotations.")}</p>

      {canManage ? (
        <div className="mt-5">
          <PackageCreateForm />
        </div>
      ) : null}

      {packages.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">{t("No packages yet — add one above.")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {packages.map((p) => {
            const imgs = Array.isArray(p.imageUrls) ? (p.imageUrls as string[]) : [];
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {imgs[0] ? (
                  <ZoomableImage src={imgs[0]} alt={p.name} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="aspect-video w-full bg-slate-100" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {p.code ? <span className="mr-1 text-slate-400">{p.code}</span> : null}
                        {p.name}
                      </p>
                      {p.tierLabel ? <p className="text-xs font-medium text-slate-500">{p.tierLabel}</p> : null}
                      {p.category ? <p className="text-xs text-slate-400">{p.category}</p> : null}
                    </div>
                    <div className="text-right">
                      {p.originalPrice != null && Number(p.originalPrice) > 0 ? (
                        <p className="text-xs text-slate-400 line-through">RM {money(Number(p.originalPrice))}</p>
                      ) : null}
                      <p className="font-semibold text-accent">RM {money(Number(p.price))}</p>
                    </div>
                  </div>
                  {(() => {
                    const items = parseInclusions(p.description);
                    if (items.length === 0) return null;
                    if (items.length === 1 && !(p.description ?? "").includes("•")) {
                      return <p className="mt-2 text-sm text-slate-600">{items[0]}</p>;
                    }
                    return (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                        {items.map((it, i) => <li key={i}>{it}</li>)}
                      </ul>
                    );
                  })()}
                  {imgs.length > 1 ? (
                    <div className="mt-3 flex gap-1.5">
                      {imgs.slice(1, 5).map((u, i) => (
                        <ZoomableImage key={i} src={u} alt={p.name} buttonClassName="cursor-zoom-in" className="h-12 w-12 rounded object-cover" />
                      ))}
                    </div>
                  ) : null}

                  {canManage ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <form action={addPackageImagesAction.bind(null, p.id)} className="flex items-center gap-1">
                        <input name="images" type="file" accept="image/*" multiple className="w-36 text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1" />
                        <button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("Add images")}</button>
                      </form>
                      <Link href={`/admin/packages/${p.id}/edit`} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("Edit")}</Link>
                      <form action={togglePackageAction.bind(null, p.id)}>
                        <button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
                          {p.active ? t("Hide") : t("Show")}
                        </button>
                      </form>
                      <form action={deletePackageAction.bind(null, p.id)}>
                        <button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">{t("Delete")}</button>
                      </form>
                      {!p.active ? <span className="text-xs text-slate-400">{t("hidden from site")}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-1.5">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
            n === page ? (
              <span key={n} aria-current="page" className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white">{n}</span>
            ) : (
              <Link key={n} href={`/admin/packages?page=${n}`} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">{n}</Link>
            ),
          )}
        </nav>
      ) : null}
    </section>
  );
}
