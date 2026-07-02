import { describe, it, expect } from "vitest";
import { parseInclusions } from "./format";

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
