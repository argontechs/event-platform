# Critique ignore list

Findings to drop silently in future critique runs (with reasons):

- **gradient-text** at `apps/web/src/app/globals.css` (`.gradient-text` class and its usages on the hero H1, stat numbers, service-card indexes): owner decision 2026-07-02 — the animated blue-violet headline is deliberate Party Eventilicious brand identity. See "The Signature Gradient Exception" in DESIGN.md. Still flag NEW gradient-clipped text elsewhere, and still flag the tenant-theming leak (hardcoded #7cc0ff/#a78bfa not routed through --brand) as a separate issue.
- **design-system-color** `#a78bfa` at `apps/web/src/app/globals.css` (gradient stop): part of the signature gradient exception above.
- **design-system-color** `#000` at `apps/web/src/app/globals.css` (inside `@media print`): false positive — print-media A4 document colors, not design drift.
