"use client";

import { useActionState } from "react";
import { createUserAction, type UserFormState } from "@/lib/users/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: UserFormState = { error: "" };

export function UserCreateForm({
  superAdmin,
  companies,
}: {
  superAdmin: boolean;
  companies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createUserAction, initial);
  const t = makeT(useBoLang());
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  const roles = superAdmin
    ? ["COMPANY_ADMIN", "SALES", "PLANNER", "SUPER_ADMIN"]
    : ["COMPANY_ADMIN", "SALES", "PLANNER"];

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <input name="name" placeholder={t("Full name")} className={field} required />
      <input name="email" type="email" placeholder="email@company.com" className={field} required />
      <input name="password" type="password" placeholder={t("Temporary password (min 8)")} className={field} required />
      <select name="role" defaultValue="SALES" className={field}>
        {roles.map((r) => (
          <option key={r} value={r}>{r.replace("_", " ").toLowerCase()}</option>
        ))}
      </select>
      {superAdmin ? (
        <select name="companyId" defaultValue={companies[0]?.id ?? ""} className={`${field} sm:col-span-2`}>
          <option value="">{t("— company (leave empty for super-admin) —")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : null}

      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("Staff member added.")}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Adding…") : t("Add staff")}
        </button>
      </div>
    </form>
  );
}
