"use client";

import { useActionState } from "react";
import { submitPaymentProofAction, type ProofState } from "@/lib/quotes/public-actions";

const initial: ProofState = { error: "" };

export function PaymentProofForm({
  token,
  suggestedAmount,
}: {
  token: string;
  suggestedAmount: number;
}) {
  const [state, action, pending] = useActionState(
    submitPaymentProofAction.bind(null, token),
    initial,
  );

  if (state.ok) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        Thank you — we&apos;ve received your payment proof and will confirm shortly.
      </p>
    );
  }

  const field =
    "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/60">Amount paid (RM)</span>
        <input name="amount" type="number" step="0.01" min={0} defaultValue={suggestedAmount} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/60">Method</span>
        <select name="method" defaultValue="DUITNOW_QR" className={field}>
          <option value="DUITNOW_QR">DuitNow QR</option>
          <option value="BANK_TRANSFER">Bank transfer</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-white/60">Reference / transaction no.</span>
        <input name="reference" type="text" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-white/60">Payment proof (screenshot/receipt)</span>
        <input name="proof" type="file" accept="image/*" className={field} />
      </label>

      {state.error ? <p className="text-sm text-red-400 sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          style={{ backgroundColor: "var(--brand, #2f6fed)" }}
        >
          {pending ? "Uploading…" : "Submit payment proof"}
        </button>
      </div>
    </form>
  );
}
