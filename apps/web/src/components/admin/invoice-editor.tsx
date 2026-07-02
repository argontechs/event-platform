"use client";

import { useActionState, useState } from "react";
import { updateInvoiceAction, type InvoiceActionState } from "@/lib/invoices/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

export type InvoiceLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

const initialState: InvoiceActionState = { error: "" };

function rm(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

export function InvoiceEditor({
  invoiceId,
  sstRate,
  sstRegistered,
  amountPaid,
  packages = [],
  initial,
}: {
  invoiceId: string;
  sstRate: number;
  sstRegistered: boolean;
  amountPaid: number;
  packages?: { id: string; name: string; price: number; description?: string }[];
  initial: {
    number: string;
    lines: InvoiceLine[];
    sstApplied: boolean;
    b2bExempt: boolean;
    customerSstNumber: string;
    discount: number;
    remarks: string;
    customer: { name: string; email: string; phone: string };
    doc: {
      preparedBy: string;
      eventDate: string;
      setupTime: string;
      startTime: string;
      dismantleTime: string;
      venue: string;
    };
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateInvoiceAction.bind(null, invoiceId),
    initialState,
  );

  const [lines, setLines] = useState<InvoiceLine[]>(initial.lines);
  const [sstApplied, setSstApplied] = useState(initial.sstApplied);
  const [b2bExempt, setB2bExempt] = useState(initial.b2bExempt);
  const [customerSst, setCustomerSst] = useState(initial.customerSstNumber);
  const [discount, setDiscount] = useState(initial.discount);
  const [remarks, setRemarks] = useState(initial.remarks);
  const [cust, setCust] = useState(initial.customer);
  const t = makeT(useBoLang());

  const sstActive = sstRegistered && sstApplied;
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const afterDiscount = Math.max(0, subtotal - (discount || 0));
  const sstAmount = sstActive && !b2bExempt ? (afterDiscount * sstRate) / 100 : 0;
  const preRound = afterDiscount + sstAmount;
  const total = Math.round(preRound / 0.05) * 0.05;
  const balanceDue = Math.max(0, total - amountPaid);

  function update(i: number, patch: Partial<InvoiceLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: 1, unit: "unit", unitPrice: 0 }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addPackage(id: string) {
    const pkg = packages.find((p) => p.id === id);
    if (!pkg) return;
    // Include the package's full inclusions in the line so they print on the
    // invoice. Bullet each inclusion onto its own line.
    const incl = (pkg.description ?? "")
      .split("•")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `- ${s}`)
      .join("\n");
    const description = incl ? `${pkg.name}\n${incl}` : pkg.name;
    setLines((prev) => [
      ...prev,
      { description, quantity: 1, unit: "set", unitPrice: pkg.price },
    ]);
  }

  const num =
    "w-full rounded border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-900 outline-none focus:border-accent";
  const txt =
    "w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="items" value={JSON.stringify(lines)} />

      {/* Bill-to */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Customer name")}</span>
          <input name="custName" className={txt} value={cust.name}
            onChange={(e) => setCust({ ...cust, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Email")}</span>
          <input name="custEmail" className={txt} value={cust.email}
            onChange={(e) => setCust({ ...cust, email: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Phone")}</span>
          <input name="custPhone" className={txt} value={cust.phone}
            onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
        </label>
      </div>

      {/* Event & document details */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <p className="text-sm font-medium text-slate-900 sm:col-span-3">{t("Event & document details")}</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Invoice number")}</span>
          <input name="number" defaultValue={initial.number} className={txt} required maxLength={50} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Prepared by")}</span>
          <input name="preparedBy" defaultValue={initial.doc.preparedBy} className={txt} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Event date")}</span>
          <input type="date" name="eventDate" defaultValue={initial.doc.eventDate} className={txt} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Venue")}</span>
          <input name="venue" defaultValue={initial.doc.venue} className={txt} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Setup time")}</span>
          <input name="setupTime" defaultValue={initial.doc.setupTime} placeholder="11AM" className={txt} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Start time")}</span>
          <input name="startTime" defaultValue={initial.doc.startTime} placeholder="5:30PM" className={txt} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Dismantle time")}</span>
          <input name="dismantleTime" defaultValue={initial.doc.dismantleTime} placeholder="10:30PM" className={txt} />
        </label>
      </div>

      {/* Lines */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-white text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">{t("Description")}</th>
              <th className="px-3 py-2 font-medium">{t("Qty")}</th>
              <th className="px-3 py-2 font-medium">{t("Unit")}</th>
              <th className="px-3 py-2 font-medium text-right">{t("Unit price (RM)")}</th>
              <th className="px-3 py-2 font-medium text-right">{t("Amount")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">{t("No items.")}</td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <textarea
                      className={`${txt} min-h-[2.2rem] resize-y`}
                      rows={l.description.includes("\n") ? Math.min(8, l.description.split("\n").length) : 1}
                      value={l.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 w-16">
                    <input type="number" min={0} className={num} value={l.quantity}
                      onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 w-20">
                    <input className={txt} value={l.unit}
                      onChange={(e) => update(i, { unit: e.target.value })} />
                  </td>
                  <td className="px-3 py-2 w-28">
                    <input type="number" min={0} step="0.01" className={num} value={l.unitPrice}
                      onChange={(e) => update(i, { unitPrice: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-900">{rm(l.quantity * l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeLine(i)}
                      className="text-slate-400 hover:text-red-400" aria-label={t("Remove line")}>✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={addLine}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100">
          {t("+ Add line")}
        </button>
        {packages.length > 0 ? (
          <select
            onChange={(e) => { if (e.target.value) { addPackage(e.target.value); e.target.value = ""; } }}
            defaultValue=""
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-accent"
          >
            <option value="">{t("+ Add from package…")}</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — RM {p.price.toFixed(2)}</option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sstApplied" checked={sstActive} disabled={!sstRegistered}
            onChange={(e) => setSstApplied(e.target.checked)} />
          <span className={sstRegistered ? "text-slate-600" : "text-slate-400"}>
            {t("Apply SST")} ({sstRate}%){!sstRegistered ? ` — ${t("company not SST-registered")}` : ""}
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">{t("Discount")} (RM)</span>
          <input name="discount" type="number" step="0.01" value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="w-28 rounded border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-900 outline-none focus:border-accent" />
        </label>
      </div>

      {sstRegistered ? (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-2.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="b2bExempt" checked={b2bExempt}
              onChange={(e) => setB2bExempt(e.target.checked)} />
            <span className="text-slate-700">🇲🇾 {t("Void 8% SST — B2B same-category exemption")}</span>
          </label>
          {b2bExempt ? (
            <label className="mt-2 flex flex-col gap-1 text-xs">
              <span className="text-slate-500">{t("Customer SST no. (required for exemption)")}</span>
              <input name="customerSstNumber" value={customerSst}
                onChange={(e) => setCustomerSst(e.target.value)}
                placeholder="W10-1808-32000000"
                className="max-w-xs rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-accent" />
            </label>
          ) : null}
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Remarks")}</span>
        <textarea name="remarks" rows={2} value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent" />
      </label>

      {/* Totals */}
      <div className="ml-auto w-full max-w-xs space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <Row label={t("Subtotal")} value={rm(subtotal)} />
        {discount > 0 ? <Row label={t("Discount")} value={`− ${rm(discount)}`} /> : null}
        {sstActive && b2bExempt ? (
          <Row label={t("SST")} value={t("Exempt (B2B)")} />
        ) : sstActive ? (
          <Row label={`${t("SST")} (${sstRate}%)`} value={rm(sstAmount)} />
        ) : null}
        <div className="my-1 border-t border-slate-200" />
        <Row label={t("Total")} value={rm(total)} strong />
        <Row label={t("Amount paid")} value={rm(amountPaid)} />
        <Row label={t("Balance due")} value={rm(balanceDue)} strong />
      </div>

      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}

      <div>
        <button type="submit" disabled={pending}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {pending ? t("Saving…") : t("Save invoice")}
        </button>
      </div>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "text-base font-semibold text-slate-900" : "text-slate-900"}>{value}</span>
    </div>
  );
}
