import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { getBoLang } from "@/lib/i18n/bo";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function PlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const superAdmin = isSuperAdmin(user);
  const activeCompanyId = await getActiveCompanyId(user);

  const companies = superAdmin
    ? await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const lang = await getBoLang();

  return (
    <AdminShell user={user} superAdmin={superAdmin} companies={companies} activeCompanyId={activeCompanyId} lang={lang}>
      {children}
    </AdminShell>
  );
}
