import { describe, it, expect } from "vitest";
import { parseInclusions, groupByCode, clampPage, paginate } from "./format";

describe("parseInclusions", () => {
  it("splits on bullets and trims", () => {
    expect(parseInclusions("• 4ft x 8ft Backdrop • Flower Set • White Carpet")).toEqual([
      "4ft x 8ft Backdrop",
      "Flower Set",
      "White Carpet",
    ]);
  });
  it("drops empty segments", () => {
    expect(parseInclusions("• A •  • B •")).toEqual(["A", "B"]);
  });
  it("returns a single item for bulletless text", () => {
    expect(parseInclusions("Just a description")).toEqual(["Just a description"]);
  });
  it("returns [] for null/empty", () => {
    expect(parseInclusions(null)).toEqual([]);
    expect(parseInclusions("")).toEqual([]);
    expect(parseInclusions("   ")).toEqual([]);
  });
});

describe("groupByCode", () => {
  const mk = (id: string, code: string | null, price: number) => ({ id, code, price });

  it("groups rows sharing a code into one design block, tiers by price asc", () => {
    const rows = [mk("a", "CNW021", 2888), mk("b", "CNW021", 1288)];
    const blocks = groupByCode(rows);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "design", code: "CNW021" });
    if (blocks[0].kind === "design") {
      expect(blocks[0].tiers.map((t) => t.id)).toEqual(["b", "a"]); // 1288 before 2888
    }
  });

  it("keeps uncoded rows as standalone single blocks, preserving order", () => {
    const rows = [mk("x", null, 100), mk("a", "CNW021", 1288), mk("y", null, 200)];
    const blocks = groupByCode(rows);
    expect(blocks.map((b) => b.kind)).toEqual(["single", "design", "single"]);
  });
});

describe("clampPage", () => {
  it("parses valid pages and clamps out-of-range values", () => {
    expect(clampPage("2", 5)).toBe(2);
    expect(clampPage("0", 5)).toBe(1);
    expect(clampPage("-3", 5)).toBe(1);
    expect(clampPage("99", 5)).toBe(5);
  });
  it("falls back to 1 for junk input", () => {
    expect(clampPage(undefined, 5)).toBe(1);
    expect(clampPage("abc", 5)).toBe(1);
    expect(clampPage("2.7", 5)).toBe(2); // truncates
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("slices the requested page", () => {
    const p = paginate(items, "2", 10);
    expect(p).toMatchObject({ page: 2, pages: 3, total: 25 });
    expect(p.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });
  it("clamps past-the-end pages to the last page", () => {
    expect(paginate(items, "9", 10).items).toEqual([21, 22, 23, 24, 25]);
  });
  it("handles an empty list as one empty page", () => {
    expect(paginate([], "3", 10)).toMatchObject({ items: [], page: 1, pages: 1, total: 0 });
  });
});
