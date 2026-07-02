import { describe, it, expect } from "vitest";
import { parseInclusions, groupByCode } from "./format";

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
