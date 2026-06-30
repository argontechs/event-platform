"use client";

import { useActionState, useEffect, useRef } from "react";
import { recordPaymentAction, type RecordPaymentState } from "@/lib/bookings/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: RecordPaymentState = { error: "" };

export function RecordPaymentForm({
  bookingId,
  defaultAmount,
}: {
  bookingId: string;
  defaultAmount: number;
}) {
  const [state, action, pending] = useActionState(
    recordPaymentAction.bind(null, bookingId),
    initial,
  );
  const t = makeT(useBoLang());
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful record so the same payment isn't re-entered.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <form ref={formRef} action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Amount (RM)")}</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          min={0}
          defaultValue={defaultAmount > 0 ? defaultAmount : ""}
          className={field}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Type")}</span>
        <select name="type" defaultValue="DEPOSIT" className={field}>
          <option value="DEPOSIT">{t("Deposit")}</option>
          <option value="BALANCE">{t("Balance")}</option>
          <option value="OTHER">{t("Other")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Method")}</span>
        <select name="method" defaultValue="BANK_TRANSFER" className={field}>
          <option value="BANK_TRANSFER">{t("Bank transfer")}</option>
          <option value="DUITNOW_QR">{t("DuitNow QR")}</option>
          <option value="CASH">{t("Cash")}</option>
          <option value="OTHER">{t("Other")}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Reference / transaction no.")}</span>
        <input name="reference" type="text" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t("Payment proof (optional)")}</span>
        <input name="proof" type="file" accept="image/*" className={field} />
      </label>

      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("Payment recorded.")}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Recording…") : t("Record payment")}
        </button>
      </div>
    </form>
  );
}
