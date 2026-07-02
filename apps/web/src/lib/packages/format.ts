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
