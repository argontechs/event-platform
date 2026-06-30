"use client";

import { useActionState } from "react";
import { changeMyPasswordAction, type ChangePwState } from "@/lib/users/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: ChangePwState = { error: "" };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeMyPasswordAction, initial);
  const t = makeT(useBoLang());
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <form action={action} className="grid max-w-md gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        placeholder={t("Current password")}
        className={field}
      />
      <input
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={t("New password (min 8)")}
        className={field}
      />
      <input
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder={t("Confirm new password")}
        className={field}
      />

      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-600">{t("Password changed successfully.")}</p> : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Saving…") : t("Change password")}
        </button>
      </div>
    </form>
  );
}
