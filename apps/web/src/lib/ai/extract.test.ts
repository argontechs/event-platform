import { describe, it, expect } from "vitest";
import { parseQuotationItems } from "./openai";

describe("parseQuotationItems (quotation OCR output → safe line items)", () => {
  it("extracts valid line items as-is", () => {
    const r = parseQuotationItems(
      JSON.stringify({ items: [{ description: "Backdrop", quantity: 2, unit: "set", unitPrice: 500 }] }),
    );
    expect(r).toEqual([{ description: "Backdrop", quantity: 2, unit: "set", unitPrice: 500 }]);
  });

  it("defaults bad quantity to 1 and clamps out-of-range price to 0", () => {
    const r = parseQuotationItems(
      JSON.stringify({
        items: [
          { description: "Neg", quantity: -5, unit: "", unitPrice: -10 },
          { description: "Huge", quantity: "abc", unitPrice: 1e12 },
        ],
      }),
    );
    expect(r[0]).toEqual({ description: "Neg", quantity: 1, unit: "", unitPrice: 0 });
    expect(r[1].quantity).toBe(1);
    expect(r[1].unitPrice).toBe(0);
  });

  it("drops items with an empty description", () => {
    const r = parseQuotationItems(
      JSON.stringify({
        items: [
          { description: "   ", quantity: 1, unitPrice: 1 },
          { description: "Real", quantity: 1, unitPrice: 5 },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].description).toBe("Real");
  });

  it("returns [] for missing or non-array items", () => {
    expect(parseQuotationItems(JSON.stringify({ items: "nope" }))).toEqual([]);
    expect(parseQuotationItems("{}")).toEqual([]);
    expect(parseQuotationItems("")).toEqual([]);
  });

  it("throws on unparseable model output", () => {
    expect(() => parseQuotationItems("not json at all")).toThrow();
  });
});
