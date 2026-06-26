import { describe, it, expect } from "vitest";
import { unitPrice, lineTotal, computeTotals, round05 } from "./calc";

describe("quotation pricing", () => {
  it("applies profit % to cost", () => {
    // Arrange / Act / Assert
    expect(unitPrice(100, 30)).toBe(130);
    expect(unitPrice(0, 30)).toBe(0);
  });

  it("computes a line total", () => {
    expect(lineTotal(3, 100, 30)).toBe(390);
  });

  it("computes totals with SST and deposit", () => {
    const t = computeTotals({
      lines: [
        { quantity: 2, costPrice: 100, profitPercent: 50 }, // 2 × 150 = 300
        { quantity: 1, costPrice: 200, profitPercent: 0 }, // 200
      ],
      discount: 0,
      sstApplied: true,
      sstRate: 8,
      depositPercent: 50,
    });
    expect(t.subtotal).toBe(500);
    expect(t.sstAmount).toBe(40); // 8% of 500
    expect(t.total).toBe(540);
    expect(t.depositAmount).toBe(270);
    expect(t.balanceDue).toBe(270);
  });

  it("never lets a discount push totals below zero", () => {
    const t = computeTotals({
      lines: [{ quantity: 1, costPrice: 100, profitPercent: 0 }],
      discount: 500,
      sstApplied: false,
      sstRate: 0,
      depositPercent: 50,
    });
    expect(t.afterDiscount).toBe(0);
    expect(t.total).toBe(0);
  });

  it("rounds cash to the nearest 5 sen (round05)", () => {
    expect(round05(1234.57)).toBe(1234.55);
    expect(round05(1234.58)).toBe(1234.6);
    expect(round05(10)).toBe(10);
  });

  it("floors a negative-profit line at zero so it can't drag the subtotal down", () => {
    // profit% below -100 would make unitPrice negative; lineTotal must clamp to 0.
    expect(lineTotal(1, 100, -200)).toBe(0);
    const t = computeTotals({
      lines: [
        { quantity: 1, costPrice: 100, profitPercent: 0 }, // 100
        { quantity: 1, costPrice: 100, profitPercent: -200 }, // clamped to 0
      ],
      discount: 0,
      sstApplied: false,
      sstRate: 0,
      depositPercent: 0,
    });
    expect(t.subtotal).toBe(100);
  });
});
