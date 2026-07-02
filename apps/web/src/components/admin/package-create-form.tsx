"use client";

import { useActionState } from "react";
import { createPackageAction, type PackageState } from "@/lib/packages/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: PackageState = { error: "" };

export function PackageCreateForm() {
  const [state, action, pending] = useActionState(createPackageAction, initial);
  const t = makeT(useBoLang());
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <input name="name" placeholder={t("Package name (e.g. Birthday Backdrop)")} className={field} required />
      <input name="category" placeholder={t("Category (e.g. Backdrop, Booth)")} className={field} />
      <input name="code" placeholder={t("Package code (e.g. CNW021)")} className={field} />
      <input name="tierLabel" placeholder={t("Tier (e.g. Basic Backdrop)")} className={field} />
      <input name="price" type="number" step="0.01" placeholder={t("Price (RM)")} className={field} />
      <input name="originalPrice" type="number" step="0.01" placeholder={t("Original price (was)")} className={field} />
      <input name="images" type="file" accept="image/*" multiple className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white sm:col-span-2" />
      <textarea name="description" rows={3} placeholder={t("What's included… (separate items with •)")} className={`${field} sm:col-span-2`} />
      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("Package added.")}</p> : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {pending ? t("Adding…") : t("Add package")}
        </button>
      </div>
    </form>
  );
}
