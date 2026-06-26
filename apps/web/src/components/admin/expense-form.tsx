"use client";

import { useActionState, useEffect, useState } from "react";
import {
  extractReceiptAction,
  submitExpenseAction,
  type ExpenseExtractState,
  type ExpenseSubmitState,
} from "@/lib/expenses/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const CATS = ["MATERIALS", "TRANSPORT", "RENTAL", "FOOD", "MARKETING", "SALARY", "MISC"];
const CAT_ZH: Record<string, string> = {
  MATERIALS: "材料",
  TRANSPORT: "交通",
  RENTAL: "租赁",
  FOOD: "餐饮",
  MARKETING: "营销",
  SALARY: "薪资",
  MISC: "其他",
};

const exInit: ExpenseExtractState = { error: "" };
const subInit: ExpenseSubmitState = { error: "" };

const field =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

export function ExpenseForm({ bookings }: { bookings: { id: string; title: string }[] }) {
  const lang = useBoLang();
  const t = makeT(lang);
  const [exState, exAction, exPending] = useActionState(extractReceiptAction, exInit);
  const [subState, subAction, subPending] = useActionState(submitExpenseAction, subInit);

  const [f, setF] = useState({
    vendor: "",
    expenseDate: "",
    category: "MATERIALS",
    amount: "",
    sstAmount: "",
    paymentMethod: "",
    bookingId: "",
    notes: "",
  });
  const [receiptUrls, setReceiptUrls] = useState("");
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => {
    if (!exState.ok) return;
    if (exState.receiptUrls) setReceiptUrls(exState.receiptUrls);
    const d = exState.data;
    if (d) {
      setF((p) => ({
        ...p,
        vendor: d.vendor || p.vendor,
        expenseDate: d.date || p.expenseDate,
        category: d.category || p.category,
        amount: d.total ? String(d.total) : p.amount,
        sstAmount: d.sst ? String(d.sst) : p.sstAmount,
        notes: d.summary || p.notes,
      }));
    }
  }, [exState]);

  const catLabel = (c: string) => (lang === "zh" ? CAT_ZH[c] ?? c : c.charAt(0) + c.slice(1).toLowerCase());

  return (
    <div className="max-w-2xl space-y-5">
      {/* Step 1 — upload + AI extract */}
      <form action={exAction} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">
          <span className="mr-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">{t("Step 1")}</span>
          {t("Upload receipt")}
        </h2>
        <p className="text-xs text-slate-500">{t("Snap or upload the receipt — AI reads the details for you.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="receipts"
            type="file"
            accept="image/*"
            multiple
            required
            className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white"
          />
          <button
            type="submit"
            disabled={exPending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {exPending ? t("Reading receipt…") : `✨ ${t("Extract with AI")}`}
          </button>
        </div>
        {exState.error ? <p className="mt-2 text-sm text-red-500">{exState.error}</p> : null}
        {receiptUrls && !exState.error ? (
          <>
            <p className="mt-2 text-sm text-emerald-600">{t("Receipt uploaded — check the details below, then submit.")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {receiptUrls.split(",").map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="receipt" className="h-20 w-20 rounded-md border border-slate-200 object-cover" />
              ))}
            </div>
          </>
        ) : null}
      </form>

      {/* Step 2 — claim details */}
      <form action={subAction} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900">
          <span className="mr-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">{t("Step 2")}</span>
          {t("Claim details")}
        </h2>
        <input type="hidden" name="receiptUrls" value={receiptUrls} />
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t("Vendor / shop")}</span>
            <input name="vendor" value={f.vendor} onChange={(e) => set({ vendor: e.target.value })} className={field} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Date")}</span>
            <input name="expenseDate" type="date" value={f.expenseDate} onChange={(e) => set({ expenseDate: e.target.value })} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Category")}</span>
            <select name="category" value={f.category} onChange={(e) => set({ category: e.target.value })} className={`${field} [&_option]:text-slate-900`}>
              {CATS.map((c) => (
                <option key={c} value={c}>{catLabel(c)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Amount paid (RM)")}</span>
            <input name="amount" type="number" step="0.01" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className={field} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("SST / tax (RM)")}</span>
            <input name="sstAmount" type="number" step="0.01" value={f.sstAmount} onChange={(e) => set({ sstAmount: e.target.value })} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("Paid by")}</span>
            <input name="paymentMethod" value={f.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} placeholder={t("Cash, card, e-wallet…")} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">{t("For event (optional)")}</span>
            <select name="bookingId" value={f.bookingId} onChange={(e) => set({ bookingId: e.target.value })} className={`${field} [&_option]:text-slate-900`}>
              <option value="">{t("— company overhead —")}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-slate-600">{t("Notes")}</span>
            <textarea name="notes" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={field} />
          </label>
        </div>
        {subState.error ? <p className="mt-2 text-sm text-red-500">{subState.error}</p> : null}
        <button
          type="submit"
          disabled={subPending}
          className="mt-4 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {subPending ? t("Submitting…") : t("Submit claim")}
        </button>
      </form>
    </div>
  );
}
