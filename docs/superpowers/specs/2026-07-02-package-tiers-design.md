# Package tiers, codes & richer display — design

- **Date:** 2026-07-02
- **Status:** Approved (direction) — implementation plan to follow
- **Author:** Claude (with Brendan)

## Context

The client (Party Eventilicious) has two existing printed package catalogues we need to load into the live site:

- **`2026 TEA CEREMONY PACKAGE.pdf`** — 28 pages, one design per page (cover on p1). Each design has a **package code** (e.g. `CNW021`, `CNW001`), and **two tiers** — *Basic Backdrop Package* and *Full Backdrop Package* — each with its own **price**, a struck-through **original price**, an **itemised inclusion list** (with dimensions), and a **render image**. ~27 designs → ~54 tier rows. The PDF is fully flattened (each page is a single 1800×1800 raster, **no extractable text**), so text is transcribed visually and images are cropped from the page.
- **`Wedding Decoration Package.pdf`** — 8 pages. Page 1 is an overview table of **Packages A–F** (single price each, increasing inclusions); pages 2–7 are per-package detail renders; page 8 back cover. Package F is "price starting from". Some packages carry **upgrade add-ons** ("+RM350 to 10ft height", "welcome-stand upgrade +RM150"). This PDF **has real text** (`pdftotext` extracts inclusions/prices/upgrades cleanly).

The current Packages feature is a flat form — `name · category · price · images · one free-text "What's included"` — with **no edit screen**, and no notion of a package code, tiers, or an original/strikethrough price. Both admin and public render the description as a single `<p>`.

## Goals

1. Capture package **code**, **tier label**, and **original ("was") price** — enough to represent both catalogues faithfully.
2. Group a design's tiers into a single card on the public site (code header, Basic/Full columns, strikethrough price, bulleted inclusions), mirroring the PDF.
3. Add the missing **Edit** screen for packages.
4. Load both catalogues into production, with a **human review gate on all prices** before anything is written to the live DB.

## Non-goals

- No relational child-table for tiers (a JSON blob or child table is deliberately avoided — see Decisions). 
- No AI/OCR pipeline — tea text is transcribed by reading the rendered pages; wedding text comes from `pdftotext`.
- No change to the quotation "add from package" flow — each tier stays a first-class `Package` row, so it remains individually quotable exactly as today.
- No image editing beyond a straight left/right crop of the tea pages.

## Decisions

### 1. Tiers → "group by shared code" (3 nullable columns), NOT a child table

Each tier remains its own `Package` row. A new nullable `code` column links a design's tiers; the public site groups rows sharing a `code` into one card. Rationale:

- **Smallest safe change on a live DB:** three additive nullable columns vs. a new table + relations + backfill.
- **Reuses everything:** create / add-images / toggle / delete actions and the quotation `•`-split integration work unchanged — a tier is just a `Package`.
- **Identical customer-facing result** to real tiers (one card, two columns).
- **Backward compatible:** existing packages have `code = null` and render as standalone cards exactly as now.
- **Upgrade path (not built now):** if single-form editing of both tiers is ever wanted, promote to a `PackageTier` child table.

### 2. Images → crop from the PDF (forced by the flattened tea PDF)

Clean render-only extraction is impossible (labels/prices are baked into one flat raster). Each tea page splits **left = Basic, right = Full**, giving a self-contained mini-poster per tier (dimension labels included — on-brand). Wedding tier image = its detail-page render.

### 3. Scope → Tea Ceremony first, Wedding as a fast follow

Tea is the bulk of the value and the harder case; Wedding's text extracts cleanly and can follow quickly once the model/UX exists.

## Data model

Add three nullable columns to `Package` (`packages/db/prisma/schema.prisma`):

```prisma
model Package {
  id            String   @id @default(cuid())
  companyId     String
  name          String
  code          String?  // design code, e.g. "CNW021" / "Package A" — groups a design's tiers
  tierLabel     String?  // "Basic Backdrop" / "Full Backdrop"; null for one-off packages
  category      String?  // collection, e.g. "Tea Ceremony", "Wedding Decoration"
  description   String?  // inclusions, "•"-separated (existing convention the quote importer already parses)
  price         Decimal  @default(0) @db.Decimal(12, 2)
  originalPrice Decimal? @db.Decimal(12, 2) // "was" price for the strikethrough; null = no discount shown
  imageUrls     Json     @default("[]")
  active        Boolean  @default(true)
  sortOrder     Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
}
```

**Prod application** (matches the existing manual-patch workflow — no migrations folder exists):

```sql
ALTER TABLE "Package"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "tierLabel" TEXT,
  ADD COLUMN "originalPrice" DECIMAL(12,2);
```

Adding nullable columns is instant on Postgres (no table rewrite, no blocking lock). `prisma generate` (run during the docker build) regenerates the client. No index added — the public/admin pages already `findMany` all of a company's packages and group in memory; `code` grouping is in-app.

## Back-office changes

**`components/admin/package-create-form.tsx`** — add three inputs: `code`, `tierLabel`, `price (was)` → `originalPrice`. Keep the `•` convention for the inclusions textarea; add a one-line hint ("Separate inclusions with •").

**`lib/packages/actions.ts`**
- `createPackageAction`: read `code`, `tierLabel`, `originalPrice` (parse to number or null); include in `prisma.package.create`.
- Add **`updatePackageAction(packageId, prev, formData)`**: same tenancy guard as the others (`!isSuperAdmin(user) && user.companyId !== pkg.companyId` → return), validates + updates `name/code/tierLabel/category/description/price/originalPrice`, `revalidatePath`, redirect back to `/admin/packages`.

**Edit screen** — new route `app/admin/packages/[id]/edit/page.tsx` + a `PackageEditForm` client component (mirror of the create form, prefilled, wired to `updatePackageAction` via `useActionState`). Add an "Edit" link to each admin card in `app/admin/packages/page.tsx`.

**Admin card** (`app/admin/packages/page.tsx`) — show `code`/`tierLabel` next to name; show `~~was~~ now` when `originalPrice` set; render inclusions as a bulleted list (see shared helper below).

## Public frontend changes

**`app/[locale]/packages/page.tsx`**
- Select the new columns (findMany already returns the whole row).
- Within each `category` section, sub-group rows by non-null `code` (helper `groupByCode`): rows sharing a code → one **design block** (bordered container, `code` as a small header) containing a responsive 2-col grid of **tier sub-cards** (`sm:grid-cols-2`, stack on mobile — no client JS). Rows with `code = null` render as today's standalone single card.
- Each tier sub-card: tier image, `tierLabel`, price with strikethrough original (`<span class="line-through opacity-60">RM {originalPrice}</span>` then `RM {price}`), bulleted inclusions.

**Shared inclusions renderer** — split `description` on `•`, trim, drop empties. If it yields >1 item, render `<ul>`; otherwise render the single string as `<p>` (preserves current look for legacy descriptions). Used by both admin and public.

## i18n

Add ZH keys to `lib/i18n/t.ts` for the new BO strings: `"Package code (e.g. CNW021)"`, `"Tier (e.g. Basic Backdrop)"`, `"Original price (was)"`, `"Separate inclusions with •"`, `"Edit"`, `"Save changes"`, `"Saving…"`, `"Package updated."`. Public page strings stay hardcoded English (consistent with current behaviour).

## Data-loading procedure

**Target company:** Party Eventilicious (KL) — the branch selected in the BO screenshot where `CNW021` was already partially added. **Confirm at execution.**

**Tea Ceremony:**
1. `pdftoppm` render each design page (2–28) at ~150 dpi; crop each into left/right halves (e.g. `sips`/ImageMagick) → two tier images per design.
2. Transcribe from each rendered page into a review table: `code`, tier (`Basic`/`Full`), `price`, `originalPrice`, inclusions (`•`-joined).
3. **Review gate:** present the full table (codes + both prices + inclusions per design) for Brendan to verify — prices are not guessed onto the live site.
4. On approval: copy cropped images into the web container's `UPLOAD_DIR/<companyId>/` and insert `Package` rows (via a node script `exec`'d in the container, as with the earlier company-details load) with `category = "Tea Ceremony"`, the transcribed fields, and `imageUrls = ["/api/uploads/<companyId>/<file>"]`.

**Wedding Decoration:**
1. `pdftotext` pages 1–7 → parse A–F inclusions, prices, and upgrade notes.
2. Single tier each (`tierLabel = null`); append upgrades as inclusion lines ("• Upgrade to 10ft height: +RM350"). Package F price is "starting from" — store the number, note it in inclusions.
3. Same review gate → same insert path; `category = "Wedding Decoration"`, tier image = detail-page render.

## Rollout

1. Schema: edit `schema.prisma`; apply the `ALTER TABLE` on prod.
2. Code: commit form/actions/edit/public/i18n changes; deploy web (commit+push → ssh git pull → detached docker build, poll for `naming to docker.io/library/event-platform-web` → `up -d web` → health 200).
3. Data: run the reviewed Tea load, verify on the live site, then the Wedding load.

## Verification

- `pnpm --filter web build` (or the repo's build) passes; `prisma validate` passes.
- BO: create a package with code/tier/was-price; edit it; both reflect on the admin card.
- Public: a coded design renders as one grouped card with two tier columns, strikethrough price, and bulleted inclusions; a legacy uncoded package still renders as a single card unchanged.
- Quotation "add from package" still works for a tier row (inclusions split on `•`).
- After load: spot-check 3 tea designs' prices against the PDF; confirm images resolve (200) on the live site.

## Open questions

- **Target company** — default Party Eventilicious (KL); confirm. Do any packages also belong to JB (Southern) or Le's? (Per-company packages; would need a second load.)
- **Tier display** — 2-column within one card (this design) vs. a Basic/Full toggle (needs client JS). Columns chosen for simplicity; revisit if mobile feels cramped.
