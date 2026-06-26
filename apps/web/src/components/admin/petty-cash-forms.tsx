"use client";

import { useActionState } from "react";
import {
  addTopupAction,
  addSpendAction,
  type PettyCashState,
} from "@/lib/petty-cash/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const init: PettyCashState = { error: "" };
const field =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";
const CATS = ["Petrol", "Parking", "Hardware", "Transport", "Meal", "Shipping", "Misc"];

export function PettyCashForms({ isManager }: { isManager: boolean }) {
  const t = makeT(useBoLang());
  const [topState, topAction, topPending] = useActionState(addTopupAction, init);
  const [spState, spAction, spPending] = useActionState(addSpendAction, init);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Spend (cash out) — any staff */}
      <form action={spAction} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">↘ {t("Record a spend (cash out)")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Date")}</span>
            <input name="entryDate" type="date" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Pay to (who spent)")}</span>
            <input name="payTo" className={field} placeholder="Thio May Fang" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t("Description")}</span>
            <input name="description" required className={field} placeholder={t("e.g. Lalamove for Delux setup")} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Category")}</span>
            <select name="category" className={`${field} [&_option]:text-slate-900`}>
              <option value="">—</option>
              {CATS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Amount (RM)")}</span>
            <input name="amount" type="number" step="0.01" required className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t("Receipt photo (optional)")}</span>
            <input name="receipts" type="file" accept="image/*" multiple
              className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white" />
          </label>
        </div>
        {spState.error ? <p className="mt-2 text-sm text-red-500">{spState.error}</p> : null}
        <button type="submit" disabled={spPending}
          className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {spPending ? t("Submitting…") : t("Submit spend")}
        </button>
        <p className="mt-2 text-xs text-slate-400">{t("Spends need manager approval before they affect the balance.")}</p>
      </form>

      {/* Top-up (cash in) — managers only */}
      {isManager ? (
        <form action={topAction} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
          <h2 className="text-sm font-medium text-slate-900">↗ {t("Add cash to float (top-up)")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">{t("Date")}</span>
              <input name="entryDate" type="date" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">{t("Amount (RM)")}</span>
              <input name="amount" type="number" step="0.01" required className={field} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-slate-600">{t("Description")}</span>
              <input name="description" className={field} placeholder={t("e.g. Reimbursement / bring forward")} />
            </label>
          </div>
          {topState.error ? <p className="mt-2 text-sm text-red-500">{topState.error}</p> : null}
          <button type="submit" disabled={topPending}
            className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
            {topPending ? t("Adding…") : t("Add to float")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
