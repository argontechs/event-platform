"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPwState } from "@/lib/users/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: ResetPwState = { error: "" };

/** Per-row admin reset of ANOTHER staff member's password (siblings the role/status form). */
export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction.bind(null, userId), initial);
  const t = makeT(useBoLang());

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={t("New password (min 8)")}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-accent"
      />
      <button
        disabled={pending}
        className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? t("Resetting…") : t("Reset password")}
      </button>
      {state.error ? <span className="text-xs text-red-500">{state.error}</span> : null}
      {state.ok ? <span className="text-xs text-emerald-600">{t("Password reset.")}</span> : null}
    </form>
  );
}
