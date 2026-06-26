import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { UserCreateForm } from "@/components/admin/user-create-form";
import { updateUserAction } from "@/lib/users/actions";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "SALES", "PLANNER"];

export default async function UsersPage() {
  const me = await requireUser();
  const t = makeT(await getBoLang());
  if (!(isSuperAdmin(me) || me.role === "COMPANY_ADMIN")) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Staff")}</h1>
        <p className="mt-3 text-sm text-slate-500">{t("You don't have access to staff management.")}</p>
      </section>
    );
  }

  const superAdmin = isSuperAdmin(me);
  const activeCompanyId = await getActiveCompanyId(me);

  const where = superAdmin
    ? activeCompanyId
      ? { OR: [{ companyId: activeCompanyId }, { role: "SUPER_ADMIN" as const }] }
      : {}
    : { companyId: me.companyId };

  const [users, companies] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { company: { select: { name: true } } },
      take: 200,
    }),
    superAdmin
      ? prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <section className="max-w-4xl">
      <h1 className="text-2xl font-semibold">{t("Staff")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t("Add team members and control their access. Roles: company admin, sales, planner.")}
      </p>

      <div className="mt-5">
        <UserCreateForm superAdmin={superAdmin} companies={companies} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Name")}</th>
              <th className="px-4 py-3 font-medium">{t("Email")}</th>
              {superAdmin ? <th className="px-4 py-3 font-medium">{t("Company")}</th> : null}
              <th className="px-4 py-3 font-medium">{t("Role & status")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-200">
                <td className="px-4 py-3 text-slate-900">
                  {u.name}
                  {u.id === me.id ? <span className="ml-2 text-xs text-slate-400">{t("(you)")}</span> : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                {superAdmin ? (
                  <td className="px-4 py-3 text-slate-600">{u.company?.name ?? "— group —"}</td>
                ) : null}
                <td className="px-4 py-3">
                  <form action={updateUserAction.bind(null, u.id)} className="flex flex-wrap items-center gap-2">
                    <select
                      name="role"
                      defaultValue={u.role}
                      disabled={!superAdmin && u.role === "SUPER_ADMIN"}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-accent"
                    >
                      {(superAdmin ? ROLES : ROLES.filter((r) => r !== "SUPER_ADMIN")).map((r) => (
                        <option key={r} value={r}>{r.replace("_", " ").toLowerCase()}</option>
                      ))}
                    </select>
                    <select
                      name="status"
                      defaultValue={u.status}
                      disabled={u.id === me.id}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-accent"
                    >
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                    <button className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-100">
                      {t("Save")}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
