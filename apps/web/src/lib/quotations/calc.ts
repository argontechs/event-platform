/**
 * Pure pricing math for quotations. No I/O — safe to use on client & server,
 * and unit-tested in Phase 11.
 *
 *   costPrice ──(+ profit%)──> unitPrice ──(× qty)──> lineTotal
 *   Σ lineTotal ──(− discount)──> afterDiscount ──(+ SST)──> total ──(× deposit%)──> deposit
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Malaysia cash rounding to the nearest 5 sen. Shared by every invoice path so
// confirmPayment, manual, and from-quotation invoices all agree on the total.
export function round05(n: number): number {
  return round2(Math.round(n / 0.05) * 0.05);
}

export function unitPrice(costPrice: number, profitPercent: number): number {
  return round2(costPrice * (1 + profitPercent / 100));
}

export function lineTotal(quantity: number, costPrice: number, profitPercent: number): number {
  // Floor at 0: a single line with profit% < -100 must not drag the subtotal negative.
  return Math.max(0, round2(quantity * unitPrice(costPrice, profitPercent)));
}

export type CalcLine = {
  quantity: number;
  costPrice: number;
  profitPercent: number;
};

export type TotalsInput = {
  lines: CalcLine[];
  discount: number;
  sstApplied: boolean;
  sstRate: number;
  depositPercent: number;
  b2bExempt?: boolean; // Malaysia B2B same-category service-tax exemption → voids SST
};

export type Totals = {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  sstAmount: number;
  total: number;
  depositAmount: number;
  balanceDue: number;
};

export function computeTotals(t: TotalsInput): Totals {
  const subtotal = round2(
    t.lines.reduce(
      (sum, l) => sum + lineTotal(l.quantity, l.costPrice, l.profitPercent),
      0,
    ),
  );
  const discount = round2(Math.max(0, t.discount));
  const afterDiscount = round2(Math.max(0, subtotal - discount));
  const sstAmount = t.sstApplied && !t.b2bExempt ? round2((afterDiscount * t.sstRate) / 100) : 0;
  const total = round2(afterDiscount + sstAmount);
  const depositAmount = round2((total * t.depositPercent) / 100);
  const balanceDue = round2(total - depositAmount);
  return { subtotal, discount, afterDiscount, sstAmount, total, depositAmount, balanceDue };
}
