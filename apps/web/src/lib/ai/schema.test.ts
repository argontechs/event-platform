import { describe, it, expect } from "vitest";
import { AiMaterial } from "./schema";

// FV-26 — AI-drafted material costs/quantities are bounded so a hallucinated or
// injected negative / NaN / absurd value can't become a real quote line.
describe("FV-26 AiMaterial bounds", () => {
  it("clamps a negative cost to 0", () => {
    expect(AiMaterial.parse({ name: "x", estCost: -9999, quantity: 1 }).estCost).toBe(0);
  });
  it("defaults a NaN quantity to 1", () => {
    expect(AiMaterial.parse({ name: "x", quantity: "abc", estCost: 10 }).quantity).toBe(1);
  });
  it("rejects an absurd cost (>10M)", () => {
    expect(AiMaterial.parse({ name: "x", estCost: 1e308, quantity: 1 }).estCost).toBeLessThanOrEqual(10_000_000);
  });
  it("keeps a valid material intact", () => {
    const m = AiMaterial.parse({ name: "Arch", quantity: 2, unit: "set", estCost: 250, analysis: "ok" });
    expect(m).toMatchObject({ name: "Arch", quantity: 2, estCost: 250 });
  });
});
