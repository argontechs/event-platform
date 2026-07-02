import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PackageEditForm } from "@/components/admin/package-edit-form";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = makeT(await getBoLang());
  const user = await requireUser();
  const canManage = isSuperAdmin(user) || user.role === "COMPANY_ADMIN" || user.role === "SALES";
  if (!canManage) redirect("/admin/packages");

  const pkg = await prisma.package.findUnique({ where: { id } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) notFound();

  return (
    <section className="max-w-2xl">
      <Link href="/admin/packages" className="text-sm text-slate-500 hover:text-slate-800">← {t("Packages")}</Link>
      <h1 className="mt-2 text-2xl font-semibold">{t("Edit")}</h1>
      <div className="mt-5">
        <PackageEditForm
          pkg={{
            id: pkg.id,
            name: pkg.name,
            code: pkg.code,
            tierLabel: pkg.tierLabel,
            category: pkg.category,
            price: Number(pkg.price),
            originalPrice: pkg.originalPrice == null ? null : Number(pkg.originalPrice),
            description: pkg.description,
          }}
        />
      </div>
    </section>
  );
}
