"use client";

import { useActionState } from "react";
import { updatePackageAction, type PackageState } from "@/lib/packages/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: PackageState = { error: "" };

type Initial = {
  id: string;
  name: string;
  code: string | null;
  tierLabel: string | null;
  category: string | null;
  price: number;
  originalPrice: number | null;
  description: string | null;
};

export function PackageEditForm({ pkg }: { pkg: Initial }) {
  const [state, action, pending] = useActionState(updatePackageAction.bind(null, pkg.id), initial);
  const t = makeT(useBoLang());
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <input name="name" defaultValue={pkg.name} placeholder={t("Package name (e.g. Birthday Backdrop)")} className={field} required />
      <input name="category" defaultValue={pkg.category ?? ""} placeholder={t("Category (e.g. Backdrop, Booth)")} className={field} />
      <input name="code" defaultValue={pkg.code ?? ""} placeholder={t("Package code (e.g. CNW021)")} className={field} />
      <input name="tierLabel" defaultValue={pkg.tierLabel ?? ""} placeholder={t("Tier (e.g. Basic Backdrop)")} className={field} />
      <input name="price" type="number" step="0.01" defaultValue={pkg.price} placeholder={t("Price (RM)")} className={field} />
      <input name="originalPrice" type="number" step="0.01" defaultValue={pkg.originalPrice ?? ""} placeholder={t("Original price (was)")} className={field} />
      <textarea name="description" rows={4} defaultValue={pkg.description ?? ""} placeholder={t("What's included… (separate items with •)")} className={`${field} sm:col-span-2`} />
      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {pending ? t("Saving…") : t("Save changes")}
        </button>
      </div>
    </form>
  );
}
