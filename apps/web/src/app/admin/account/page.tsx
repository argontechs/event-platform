import { requireUser } from "@/lib/auth/rbac";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await requireUser();
  const t = makeT(await getBoLang());

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">{t("Account")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("Your profile and password.")}</p>

      <dl className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">{t("Name")}</dt>
          <dd className="text-slate-900">{me.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("Email")}</dt>
          <dd className="text-slate-900">{me.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t("Role")}</dt>
          <dd className="text-slate-900">{me.role.replace("_", " ").toLowerCase()}</dd>
        </div>
      </dl>

      <h2 className="mt-6 text-sm font-medium text-slate-900">{t("Change password")}</h2>
      <div className="mt-2">
        <ChangePasswordForm />
      </div>
    </section>
  );
}
