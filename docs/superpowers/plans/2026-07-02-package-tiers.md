# Package Tiers, Codes & Richer Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Represent the client's Tea Ceremony (coded, two-tier) and Wedding Decoration catalogues faithfully — add package `code`, `tierLabel`, and original ("was") price; group tiers into one card on the public site; add the missing Edit screen — then load both catalogues to production behind a price-review gate.

**Architecture:** Three additive nullable columns on the existing `Package` model (no child table). Each tier stays its own `Package` row; a shared `code` groups them. Public page groups rows by `code` into one card with two tier columns; strikethrough from `originalPrice`; inclusions rendered from the existing `•`-separated `description` convention. Back office gains create-form fields + a new Edit route.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19 (`useActionState`), Prisma 6 + PostgreSQL, Vitest, Tailwind. Package manager: **npm**. Local commands run from `apps/web/` unless noted.

## Global Constraints

- **Do not guess prices.** Every transcribed price is reviewed by Brendan before any write to the production DB. (Standing rule.)
- **Backward compatible:** existing packages have `code = null` and MUST render exactly as they do today (single card, `<p>` description).
- **Reuse the `•` inclusion convention** — the quote importer (`apps/web/src/components/admin/quotation-editor.tsx:106`) splits `description` on `•`; the new parser MUST match (split on `•`, trim, drop empties).
- **No new dependency** for tiers (no child table). Images stored on local disk via existing `saveUpload` → `/api/uploads/<companyId>/<file>`.
- **Prod schema changes are surgical `ALTER TABLE`** (no migrations folder exists; matches prior manual-patch workflow).
- **Deploy marker:** a web build is done only when `build.log` prints `naming to docker.io/library/event-platform-web`. The SWC musl warning is non-fatal.
- **Target company:** Party Eventilicious (KL) — confirm the exact `companyId` at execution before loading data.

---

### Task 1: Schema — add `code`, `tierLabel`, `originalPrice`

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (model `Package`)

**Interfaces:**
- Produces: `Package.code: string | null`, `Package.tierLabel: string | null`, `Package.originalPrice: Decimal | null` on the generated Prisma client — consumed by every later task.

- [ ] **Step 1: Add the three columns to the `Package` model**

In `packages/db/prisma/schema.prisma`, change the `Package` model so it reads:

```prisma
model Package {
  id            String   @id @default(cuid())
  companyId     String
  name          String
  code          String?  // design code, e.g. "CNW021" / "Package A" — groups a design's tiers
  tierLabel     String?  // "Basic Backdrop" / "Full Backdrop"; null for one-off packages
  category      String?
  description   String?  // inclusions, "•"-separated (the quote importer parses this)
  price         Decimal  @default(0) @db.Decimal(12, 2)
  originalPrice Decimal? @db.Decimal(12, 2) // "was" price for the strikethrough; null = no discount
  imageUrls     Json     @default("[]") // array of /api/uploads/... image URLs
  active        Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
}
```

- [ ] **Step 2: Validate the schema**

Run (from repo root): `npx prisma validate --schema packages/db/prisma/schema.prisma`
Expected: `The schema at packages/db/prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Regenerate the Prisma client**

Run (from repo root): `npx prisma generate --schema packages/db/prisma/schema.prisma`
Expected: `Generated Prisma Client` — the new fields are now on the client types. (No DB connection needed; pages are `force-dynamic`, so `next build` does not read the DB.)

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add Package.code, tierLabel, originalPrice (nullable)"
```

> Prod `ALTER TABLE` is applied in Task 9 (deploy), not here.

---

### Task 2: Inclusions parser + test

**Files:**
- Create: `apps/web/src/lib/packages/format.ts`
- Test: `apps/web/src/lib/packages/format.test.ts`

**Interfaces:**
- Produces: `parseInclusions(description: string | null | undefined): string[]` — consumed by the admin card (Task 6) and public page (Task 7).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/packages/format.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `npx vitest run src/lib/packages/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"` / `parseInclusions is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/web/src/lib/packages/format.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/web`): `npx vitest run src/lib/packages/format.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/packages/format.ts apps/web/src/lib/packages/format.test.ts
git commit -m "feat(packages): add parseInclusions helper (• convention)"
```

---

### Task 3: `groupByCode` grouping helper + test

**Files:**
- Modify: `apps/web/src/lib/packages/format.ts`
- Modify: `apps/web/src/lib/packages/format.test.ts`

**Interfaces:**
- Produces:
  - `type CodeBlock<T> = { kind: "single"; pkg: T } | { kind: "design"; code: string; tiers: T[] }`
  - `groupByCode<T extends { code: string | null; price: unknown }>(items: T[]): CodeBlock<T>[]`
  - Consumed by the public page (Task 7). Preserves first-seen block order; tiers sorted by `price` ascending (Basic before Full).

- [ ] **Step 1: Add the failing test**

Append to `apps/web/src/lib/packages/format.test.ts`:

```ts
import { groupByCode } from "./format";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `npx vitest run src/lib/packages/format.test.ts`
Expected: FAIL — `groupByCode is not a function`.

- [ ] **Step 3: Implement `groupByCode`**

Append to `apps/web/src/lib/packages/format.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/web`): `npx vitest run src/lib/packages/format.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/packages/format.ts apps/web/src/lib/packages/format.test.ts
git commit -m "feat(packages): add groupByCode helper for tier grouping"
```

---

### Task 4: Create-form fields + `createPackageAction` new columns

**Files:**
- Modify: `apps/web/src/components/admin/package-create-form.tsx`
- Modify: `apps/web/src/lib/packages/actions.ts:17-48` (`createPackageAction`)

**Interfaces:**
- Consumes: `PackageState` (unchanged).
- Produces: packages created with `code`, `tierLabel`, `originalPrice`.

- [ ] **Step 1: Add the three inputs to the create form**

In `apps/web/src/components/admin/package-create-form.tsx`, replace the current field block (lines 18–22) with:

```tsx
      <input name="name" placeholder={t("Package name (e.g. Birthday Backdrop)")} className={field} required />
      <input name="category" placeholder={t("Category (e.g. Backdrop, Booth)")} className={field} />
      <input name="code" placeholder={t("Package code (e.g. CNW021)")} className={field} />
      <input name="tierLabel" placeholder={t("Tier (e.g. Basic Backdrop)")} className={field} />
      <input name="price" type="number" step="0.01" placeholder={t("Price (RM)")} className={field} />
      <input name="originalPrice" type="number" step="0.01" placeholder={t("Original price (was)")} className={field} />
      <input name="images" type="file" accept="image/*" multiple className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white sm:col-span-2" />
      <textarea name="description" rows={3} placeholder={t("What's included… (separate items with •)")} className={`${field} sm:col-span-2`} />
```

- [ ] **Step 2: Read + persist the new fields in `createPackageAction`**

In `apps/web/src/lib/packages/actions.ts`, inside `createPackageAction`, after the existing `description` line (line 30), add:

```ts
  const code = String(formData.get("code") ?? "").trim() || null;
  const tierLabel = String(formData.get("tierLabel") ?? "").trim() || null;
  const opRaw = String(formData.get("originalPrice") ?? "").trim();
  const opNum = Number(opRaw);
  const originalPrice = opRaw !== "" && Number.isFinite(opNum) ? opNum : null;
```

Then change the `prisma.package.create` call (lines 43–45) to:

```ts
  await prisma.package.create({
    data: {
      companyId,
      name,
      code,
      tierLabel,
      category,
      description,
      price: Number.isFinite(price) ? price : 0,
      originalPrice,
      imageUrls,
    },
  });
```

- [ ] **Step 3: Typecheck**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/admin/package-create-form.tsx apps/web/src/lib/packages/actions.ts
git commit -m "feat(packages): create form captures code, tier, was-price"
```

---

### Task 5: `updatePackageAction` + Edit route + edit form + admin Edit link

**Files:**
- Modify: `apps/web/src/lib/packages/actions.ts` (add `updatePackageAction`)
- Create: `apps/web/src/components/admin/package-edit-form.tsx`
- Create: `apps/web/src/app/admin/packages/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/admin/packages/page.tsx` (add Edit link + import)

**Interfaces:**
- Consumes: `PackageState`; `canManage`, `requireSalesRole`, `isSuperAdmin` (already imported in actions.ts).
- Produces: `updatePackageAction(packageId: string, _prev: PackageState, formData: FormData): Promise<PackageState>` (redirects to `/admin/packages` on success).

- [ ] **Step 1: Add `updatePackageAction`**

In `apps/web/src/lib/packages/actions.ts`, add these imports at the top if missing — `redirect` from `next/navigation`:

```ts
import { redirect } from "next/navigation";
```

Then append this action:

```ts
/** Edit an existing package's fields (not its images — use addPackageImagesAction). */
export async function updatePackageAction(
  packageId: string,
  _prev: PackageState,
  formData: FormData,
): Promise<PackageState> {
  const user = await requireSalesRole();
  if (!canManage(user)) return { error: "You don't have permission." };
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) return { error: "Not found." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Package name is required." };
  const price = Number(formData.get("price") ?? 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const code = String(formData.get("code") ?? "").trim() || null;
  const tierLabel = String(formData.get("tierLabel") ?? "").trim() || null;
  const opRaw = String(formData.get("originalPrice") ?? "").trim();
  const opNum = Number(opRaw);
  const originalPrice = opRaw !== "" && Number.isFinite(opNum) ? opNum : null;

  await prisma.package.update({
    where: { id: packageId },
    data: {
      name,
      code,
      tierLabel,
      category,
      description,
      price: Number.isFinite(price) ? price : 0,
      originalPrice,
    },
  });
  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}
```

- [ ] **Step 2: Create the edit form component**

Create `apps/web/src/components/admin/package-edit-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { updatePackageAction, type PackageState } from "@/lib/packages/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: PackageState = { error: "" };

type Initial = {
  id: string;
  name: string;
  code: string | null;
  tierLabel: string | null;
  category: string | null;
  price: number;
  originalPrice: number | null;
  description: string | null;
};

export function PackageEditForm({ pkg }: { pkg: Initial }) {
  const [state, action, pending] = useActionState(updatePackageAction.bind(null, pkg.id), initial);
  const t = makeT(useBoLang());
  const field =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <input name="name" defaultValue={pkg.name} placeholder={t("Package name (e.g. Birthday Backdrop)")} className={field} required />
      <input name="category" defaultValue={pkg.category ?? ""} placeholder={t("Category (e.g. Backdrop, Booth)")} className={field} />
      <input name="code" defaultValue={pkg.code ?? ""} placeholder={t("Package code (e.g. CNW021)")} className={field} />
      <input name="tierLabel" defaultValue={pkg.tierLabel ?? ""} placeholder={t("Tier (e.g. Basic Backdrop)")} className={field} />
      <input name="price" type="number" step="0.01" defaultValue={pkg.price} placeholder={t("Price (RM)")} className={field} />
      <input name="originalPrice" type="number" step="0.01" defaultValue={pkg.originalPrice ?? ""} placeholder={t("Original price (was)")} className={field} />
      <textarea name="description" rows={4} defaultValue={pkg.description ?? ""} placeholder={t("What's included… (separate items with •)")} className={`${field} sm:col-span-2`} />
      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {pending ? t("Saving…") : t("Save changes")}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create the edit route**

Create `apps/web/src/app/admin/packages/[id]/edit/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PackageEditForm } from "@/components/admin/package-edit-form";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = makeT(await getBoLang());
  const user = await requireUser();
  const canManage = isSuperAdmin(user) || user.role === "COMPANY_ADMIN" || user.role === "SALES";
  if (!canManage) redirect("/admin/packages");

  const pkg = await prisma.package.findUnique({ where: { id } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) notFound();

  return (
    <section className="max-w-2xl">
      <Link href="/admin/packages" className="text-sm text-slate-500 hover:text-slate-800">← {t("Packages")}</Link>
      <h1 className="mt-2 text-2xl font-semibold">{t("Edit")}</h1>
      <div className="mt-5">
        <PackageEditForm
          pkg={{
            id: pkg.id,
            name: pkg.name,
            code: pkg.code,
            tierLabel: pkg.tierLabel,
            category: pkg.category,
            price: Number(pkg.price),
            originalPrice: pkg.originalPrice == null ? null : Number(pkg.originalPrice),
            description: pkg.description,
          }}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add an Edit link to each admin card**

In `apps/web/src/app/admin/packages/page.tsx`: add `import Link from "next/link";` at the top. Then inside the `canManage` action row (after the `addPackageImagesAction` form, before the toggle form — around line 84), add:

```tsx
                      <Link href={`/admin/packages/${p.id}/edit`} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">{t("Edit")}</Link>
```

- [ ] **Step 5: Typecheck**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/packages/actions.ts apps/web/src/components/admin/package-edit-form.tsx "apps/web/src/app/admin/packages/[id]/edit/page.tsx" apps/web/src/app/admin/packages/page.tsx
git commit -m "feat(packages): add Edit screen + updatePackageAction"
```

---

### Task 6: Admin card — show code/tier/was-price + bulleted inclusions

**Files:**
- Modify: `apps/web/src/app/admin/packages/page.tsx:61-69`

**Interfaces:**
- Consumes: `parseInclusions` (Task 2).

- [ ] **Step 1: Import the parser**

In `apps/web/src/app/admin/packages/page.tsx`, add near the top imports:

```ts
import { parseInclusions } from "@/lib/packages/format";
```

- [ ] **Step 2: Replace the card's name/price/description block**

Replace lines 62–69 (the `<div className="flex items-start justify-between gap-2">…` through the description `<p>`) with:

```tsx
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {p.code ? <span className="mr-1 text-slate-400">{p.code}</span> : null}
                        {p.name}
                      </p>
                      {p.tierLabel ? <p className="text-xs font-medium text-slate-500">{p.tierLabel}</p> : null}
                      {p.category ? <p className="text-xs text-slate-400">{p.category}</p> : null}
                    </div>
                    <div className="text-right">
                      {p.originalPrice != null && Number(p.originalPrice) > 0 ? (
                        <p className="text-xs text-slate-400 line-through">RM {money(Number(p.originalPrice))}</p>
                      ) : null}
                      <p className="font-semibold text-accent">RM {money(Number(p.price))}</p>
                    </div>
                  </div>
                  {(() => {
                    const items = parseInclusions(p.description);
                    if (items.length === 0) return null;
                    if (items.length === 1 && !(p.description ?? "").includes("•")) {
                      return <p className="mt-2 text-sm text-slate-600">{items[0]}</p>;
                    }
                    return (
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                        {items.map((it, i) => <li key={i}>{it}</li>)}
                      </ul>
                    );
                  })()}
```

- [ ] **Step 3: Typecheck**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/packages/page.tsx
git commit -m "feat(packages): admin card shows code/tier/was-price + bullet inclusions"
```

---

### Task 7: Public page — group by code, tier columns, strikethrough, bullets

**Files:**
- Modify: `apps/web/src/app/[locale]/packages/page.tsx`

**Interfaces:**
- Consumes: `parseInclusions`, `groupByCode`, `CodeBlock` (Tasks 2–3).

- [ ] **Step 1: Import helpers and extend the row type**

In `apps/web/src/app/[locale]/packages/page.tsx`:

Add imports near the top:

```ts
import { parseInclusions, groupByCode } from "@/lib/packages/format";
```

Extend the `PkgRow` type (lines 83–90) to include the new fields:

```ts
type PkgRow = {
  id: string;
  name: string;
  code: string | null;
  tierLabel: string | null;
  category: string | null;
  price: unknown;
  originalPrice: unknown;
  description: string | null;
  imageUrls: unknown;
};
```

- [ ] **Step 2: Add a shared inclusions sub-component and a tier-card renderer**

Add these helper components at the bottom of the file (below `groupByCategory`):

```tsx
function Inclusions({ description }: { description: string | null }) {
  const items = parseInclusions(description);
  if (items.length === 0) return null;
  if (items.length === 1 && !(description ?? "").includes("•")) {
    return <p className="mt-2 text-sm leading-relaxed text-white/55">{items[0]}</p>;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-white/55">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function Price({ price, originalPrice }: { price: unknown; originalPrice: unknown }) {
  const p = Number(price);
  const op = originalPrice == null ? 0 : Number(originalPrice);
  if (p <= 0) return <p className="whitespace-nowrap text-xs uppercase tracking-wide text-sky-300/70">Included</p>;
  return (
    <p className="whitespace-nowrap font-semibold text-sky-300">
      {op > p ? <span className="mr-1 text-xs font-normal text-white/40 line-through">RM {money(op)}</span> : null}
      RM {money(p)}
    </p>
  );
}

function TierCard({ p }: { p: PkgRow }) {
  const imgs = Array.isArray(p.imageUrls) ? (p.imageUrls as string[]) : [];
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      {imgs[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgs[0]} alt={p.tierLabel ?? p.name} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-white/[0.08] to-transparent" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-base font-medium">{p.tierLabel ?? p.name}</h4>
          <Price price={p.price} originalPrice={p.originalPrice} />
        </div>
        <Inclusions description={p.description} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the card grid inside each category section**

Replace the inner grid (lines 44–69, the `<div className="mt-6 grid …">…</div>` that maps `group.items`) with:

```tsx
            <div className="mt-6 space-y-8">
              {groupByCode(group.items as PkgRow[]).map((block) =>
                block.kind === "single" ? (
                  <div key={block.pkg.id} className={`card-glow overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]`}>
                    {(() => {
                      const imgs = Array.isArray(block.pkg.imageUrls) ? (block.pkg.imageUrls as string[]) : [];
                      return imgs[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgs[0]} alt={block.pkg.name} className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <div className="aspect-[4/3] w-full bg-gradient-to-br from-white/[0.08] to-transparent" />
                      );
                    })()}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-medium">{block.pkg.name}</h3>
                        <Price price={block.pkg.price} originalPrice={block.pkg.originalPrice} />
                      </div>
                      <Inclusions description={block.pkg.description} />
                    </div>
                  </div>
                ) : (
                  <div key={block.code} className="card-glow rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-lg font-medium">{block.tiers[0]?.name ?? group.category}</h3>
                      <span className="text-xs uppercase tracking-wide text-white/40">{block.code}</span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {block.tiers.map((tp) => <TierCard key={tp.id} p={tp} />)}
                    </div>
                  </div>
                ),
              )}
            </div>
```

Also remove the now-unused `i` index and `card-glow reveal reveal-${(i % 4) + 1}` reveal classes from the old map (they're gone with the replacement — the `reveal` animation is dropped for grouped cards; acceptable, keeps markup simple).

- [ ] **Step 4: Typecheck + build**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no errors.
Run (from `apps/web`): `npm run build`
Expected: build completes (route `/[locale]/packages` compiles).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/[locale]/packages/page.tsx"
git commit -m "feat(packages): public page groups tiers by code with strikethrough + bullets"
```

---

### Task 8: i18n — Chinese keys for new BO strings

**Files:**
- Modify: `apps/web/src/lib/i18n/t.ts` (the `ZH` dictionary)

**Interfaces:**
- Consumes: nothing. Produces: ZH translations for the new keys used in Tasks 4–6.

- [ ] **Step 1: Add ZH entries**

In `apps/web/src/lib/i18n/t.ts`, add these keys to the `ZH` object (place them near the existing package keys around line 258–264):

```ts
  "Package code (e.g. CNW021)": "配套编号（例如 CNW021）",
  "Tier (e.g. Basic Backdrop)": "级别（例如 基础背景）",
  "Original price (was)": "原价（划线价）",
  "What's included… (separate items with •)": "包含内容…（用 • 分隔）",
  "Edit": "编辑",
  "Save changes": "保存更改",
  "Saving…": "保存中…",
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/i18n/t.ts
git commit -m "feat(i18n): ZH keys for package code/tier/was-price/edit"
```

---

### Task 9: Deploy — prod schema ALTER + web build

**Files:** none (ops task).

**Interfaces:** Consumes all prior code. Produces the live columns + deployed web.

- [ ] **Step 1: Run the full local check before deploying**

Run (from `apps/web`): `npm run test && npx tsc --noEmit && npm run build`
Expected: tests pass, no type errors, build completes.

- [ ] **Step 2: Push code**

```bash
git push origin main
```

- [ ] **Step 3: Apply the schema ALTER on the prod database**

SSH to the VPS. Apply the additive columns (adjust the psql invocation to match how prod psql is reached — e.g. `docker compose exec postgres psql -U eventapp -d eventapp`):

```sql
ALTER TABLE "Package"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "tierLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(12,2);
```

Verify: `\d "Package"` shows the three new columns. (Nullable columns → instant, no lock/table-rewrite.)

- [ ] **Step 4: Pull + build + deploy web on the VPS**

On the VPS: `git pull`, then start the docker build detached, logging to `build.log`. Poll `build.log` until it prints exactly `naming to docker.io/library/event-platform-web` (ignore the SWC musl warning). Then `docker compose up -d web`.

- [ ] **Step 5: Health check**

Verify the site returns 200 (e.g. `curl -sk -o /dev/null -w "%{http_code}" https://partyeventilicious.com/`) and load `/admin/packages` — the create form now shows Code / Tier / Original price fields, and an Edit link appears on each card.

---

### Task 10: Load Tea Ceremony (crop + transcribe + REVIEW GATE + insert)

**Files:** none in-repo (data + temp scripts in scratchpad).

**Interfaces:** Consumes the deployed columns. Produces ~27 designs × 2 tiers of live packages under `category = "Tea Ceremony"`.

- [ ] **Step 1: Confirm the target company**

Get the exact `companyId` for Party Eventilicious (KL) from prod (e.g. `SELECT id, name FROM "Company";`). Store as `$CID`. Confirm with Brendan before proceeding.

- [ ] **Step 2: Render + crop each design page into two tier images**

Ensure ImageMagick is available (`magick -version`; `brew install imagemagick` if missing). For each design page N in 2..28 of `2026 TEA CEREMONY PACKAGE.pdf`:

```bash
SP=/private/tmp/.../scratchpad   # this session's scratchpad
pdftoppm -png -r 150 -f N -l N "2026 TEA CEREMONY PACKAGE.pdf" "$SP/page"   # → page-NN.png, 1800×1800
magick "$SP/page-NN.png" -crop 50%x100% +repage "$SP/cnwXXX-%d.png"          # -0 = Basic (left), -1 = Full (right)
```

(Read each rendered page to get its real code `CNWxxx` for the output filename.)

- [ ] **Step 3: Transcribe into a review table**

By reading each rendered page, build a JSON array `tea-packages.json` in the scratchpad — one object per tier:

```json
[
  { "code": "CNW021", "tierLabel": "Basic Backdrop", "price": 1288, "originalPrice": 1888,
    "description": "• White Pearl Decoration • 2ft x 6ft Layering • LED \"XI\" • 4ft x 8ft Backdrop • 3ft x 5ft Scroll • 2ft x 6ft Layering • Flower Set • White Carpet",
    "image": "cnw021-0.png" },
  { "code": "CNW021", "tierLabel": "Full Backdrop", "price": 2888, "originalPrice": 3288,
    "description": "• 2ft x 7ft Layering • 8ft x 8ft Backdrop • Paper Flower • 4ft x 8ft Layering • 3D Layering • Flower Set • 2 x Wedding Chairs • White Carpet",
    "image": "cnw021-1.png" }
]
```

- [ ] **Step 4: REVIEW GATE — get Brendan's sign-off**

Present the full table (all codes, both prices per tier, inclusions) to Brendan. Do **not** proceed to insert until prices are confirmed. (Standing rule: no guessed prices on the live DB.)

- [ ] **Step 5: Copy images into the web container's upload dir**

For each image, copy into `UPLOAD_DIR/$CID/` inside the web container (mirror the earlier company-details load: `docker cp` into the container, or write directly if the upload dir is a bind mount). The public URL is `/api/uploads/$CID/<filename>`.

- [ ] **Step 6: Insert the packages**

Run a one-off node script inside the web container that reads `tea-packages.json` and, for each row, calls `prisma.package.create({ data: { companyId: CID, name: <code + " Tea Ceremony">, code, tierLabel, category: "Tea Ceremony", description, price, originalPrice, imageUrls: ["/api/uploads/CID/<image>"] } })`.

(Use the `name` = tier label if you prefer the card heading to read "Basic Backdrop"; the public design block already shows the code separately. Pick one and keep it consistent across all rows.)

- [ ] **Step 7: Verify on the live site**

- Open `/en/packages` — Tea Ceremony section shows one grouped card per code with Basic + Full columns, strikethrough prices, bulleted inclusions.
- Spot-check 3 designs' prices against the PDF.
- Confirm each tier image resolves 200 (network tab / `curl -sk -o /dev/null -w "%{http_code}" https://partyeventilicious.com/api/uploads/$CID/cnw021-0.png`).

---

### Task 11: Load Wedding Decoration (pdftotext + REVIEW GATE + insert)

**Files:** none in-repo.

**Interfaces:** Consumes deployed columns. Produces 6 single-tier packages under `category = "Wedding Decoration"`.

- [ ] **Step 1: Extract text**

```bash
pdftotext -f 1 -l 7 "Wedding Decoration Package.pdf" - > "$SP/wedding.txt"
```

Parse Packages A–F: name, price, inclusion bullets, and upgrade notes ("*RM350 upgrade to 10ft height", welcome-stand "UPGRADE RM150").

- [ ] **Step 2: Render each detail page image (pages 2–7)**

```bash
pdftoppm -png -r 150 -f 2 -l 7 "Wedding Decoration Package.pdf" "$SP/wed"   # wed-2..wed-7 → Packages A..F
```

- [ ] **Step 3: Build the review JSON**

One object per package (single tier → `tierLabel: null`), appending upgrades as inclusion lines:

```json
[
  { "code": "Package B", "tierLabel": null, "price": 2788, "originalPrice": null,
    "description": "• 16ft(W) x 8ft(H) Backdrop • Flower Assortment • Backdrop Carpet • A1 Size Welcome Board with easel stand • Album Table & Registration Table • XHS Style Photo Exhibition • Upgrade to 10ft height: +RM350 • Welcome stand upgrade: +RM150",
    "image": "wed-3.png" }
]
```

(Package F: store the "starting from" number as `price` and note "Price starting from" in the description.)

- [ ] **Step 4: REVIEW GATE**

Present to Brendan; confirm prices and upgrade wording before inserting.

- [ ] **Step 5: Copy images + insert**

Same path as Task 10 Steps 5–6, with `category = "Wedding Decoration"`, `name` = the package label (e.g. "Package B"), `code` = the same label so a single-tier design block still renders cleanly (or leave `code = null` to render each as a standalone card — decide with Brendan; standalone is fine since each Wedding package is one tier).

- [ ] **Step 6: Verify**

`/en/packages` shows a Wedding Decoration section with all 6 packages, correct prices/upgrades, and images resolving 200.

---

## Self-Review

**Spec coverage:**
- Schema (code/tierLabel/originalPrice) → Task 1. ✅
- `•` inclusions parser → Task 2; grouping → Task 3. ✅
- Create-form fields + action → Task 4. ✅
- Edit screen + updatePackageAction → Task 5. ✅
- Admin card display → Task 6. ✅
- Public grouping/tiers/strikethrough/bullets → Task 7. ✅
- i18n → Task 8. ✅
- Prod ALTER + deploy → Task 9. ✅
- Tea load (crop/transcribe/review/insert) → Task 10; Wedding load → Task 11. ✅

**Placeholder scan:** No "TBD"/"handle edge cases". The two remaining execution-time confirmations (exact `companyId`; Wedding `code` vs standalone) are explicit decisions flagged for Brendan, not vague code. Data-load tasks are procedural by nature (no unit test) — verification is price spot-checks + image-200 checks.

**Type consistency:** `parseInclusions(string|null|undefined): string[]` used identically in Tasks 2/6/7. `groupByCode<T extends {code, price}>` + `CodeBlock<T>` used in Task 7. `updatePackageAction(id, prev, formData)` bound with `.bind(null, id)` in the edit form matches `useActionState`. `originalPrice` parsed the same way in create (Task 4) and update (Task 5). New `PkgRow` fields (Task 7) match the schema (Task 1).
