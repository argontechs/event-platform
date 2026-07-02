/**
 * Split a package description into inclusion lines using the "•" convention
 * the quotation importer also uses (quotation-editor.tsx). A description with
 * no bullet yields a single item; callers decide whether to render a <ul>
 * (multiple items / contains "•") or a plain <p>.
 */
export function parseInclusions(description: string | null | undefined): string[] {
  if (!description) return [];
  return description
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CodeBlock<T> =
  | { kind: "single"; pkg: T }
  | { kind: "design"; code: string; tiers: T[] };

/**
 * Group packages by their `code`: rows sharing a non-null code become one
 * "design" block (its tiers sorted by price ascending); rows with no code
 * stay standalone "single" blocks. First-seen order is preserved.
 */
export function groupByCode<T extends { code: string | null; price: unknown }>(
  items: T[],
): CodeBlock<T>[] {
  const blocks: CodeBlock<T>[] = [];
  const byCode = new Map<string, Extract<CodeBlock<T>, { kind: "design" }>>();
  for (const p of items) {
    if (!p.code) {
      blocks.push({ kind: "single", pkg: p });
      continue;
    }
    let d = byCode.get(p.code);
    if (!d) {
      d = { kind: "design", code: p.code, tiers: [] };
      byCode.set(p.code, d);
      blocks.push(d);
    }
    d.tiers.push(p);
  }
  for (const b of blocks) {
    if (b.kind === "design") b.tiers.sort((x, y) => Number(x.price) - Number(y.price));
  }
  return blocks;
}
