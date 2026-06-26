# Testing Guide — Event & Decoration Platform

> A manual, click-by-click test plan covering every module (back office + public frontend). Written for a non-developer to execute. Generated 2026-06-25.

## Before you start

1. **App running:** `npm run dev` → http://localhost:3000 (health: `/api/health` should return `{"status":"ok"}`).
2. **Worker (optional, for email/reminder tests):** `npm run worker:dev`.
3. **Seeded logins** (password `ChangeMe123!` for both):
   - Super-admin: `owner@platform.local`
   - Company admin: `admin@bloomco.example`
4. Back office: `/admin` · Public site: `/en` (also `/ms`, `/zh`).
5. **Priorities:** P0 = must pass before shipping · P1 = important · P2 = nice-to-have.
6. Tick each case: ⬜ pass / ⬜ fail (note what you saw).

> **Updated 2026-06-26:** the 64 confirmed bugs from `BUG_AUDIT.md` have been fixed. **Part A below is the regression checklist for those fixes** — run it first to confirm the system is secure. The per-module tests (Part B) still apply for general coverage; where a module's old "Known issue" note appears, the secure behavior is now what Part A describes. Items marked **✅ auto-verified** were checked automatically against the running app (see `apps/web/e2e/`).

---

# Part A — Fix Verification & Security Regression

Run these to confirm the security/correctness fixes hold. Each lists the **expected behavior AFTER the fix**.

**Legend:** ✅ **VERIFIED** = I tested this automatically against the running app and it passed. 🙋 **NEEDS YOU** = needs a manual UI flow, two accounts, an external service (SMTP/OpenAI), or a real custom domain — please run it and tick it.

### ✅ Verified — all 30 fixes (2026-06-26)
The **standing regression suite** (`apps/web/e2e/`, 18 Playwright tests + `npm run test -w web`, 16 unit tests) is re-runnable anytime with the dev server up: `cd apps/web && npx playwright test`. Rows marked ³ were verified by a **one-off scripted run** (crafted request + DB assert) and aren't in the standing suite because they depend on seeded or manually-created data; ⁴ are quick one-line/command checks.

| ID | What it proves | Result |
|---|---|---|
| FV-01 | Login locks out after repeated wrong passwords | ✅ pass |
| FV-02 | Disabling a user kills their session immediately (active→200, disabled→redirect to login) | ✅ pass¹ |
| FV-07 | Cross-tenant FK: a Bloom planner can't attach 9Degree's location/staff (own data still works) | ✅ pass² |
| FV-08 | Quote PIN gate locks out after repeated wrong codes | ✅ pass |
| FV-09 | A REJECTED quote exposes no Accept control | ✅ pass |
| FV-10 | Double-clicking Accept → no 5xx, exactly **one** booking, status ACCEPTED | ✅ pass (+DB) |
| FV-11 | Payment above the outstanding balance is rejected | ✅ pass |
| FV-12 | No payment form before a quote is accepted | ✅ pass |
| FV-13 | An expired quote cannot actually be accepted (no booking, stays SENT) | ✅ pass (+DB) |
| FV-14 | A quote that became ACCEPTED can no longer receive change requests | ✅ pass³ |
| FV-15 | Double-clicking Confirm-payment issues exactly **one** invoice, deposit counted once | ✅ pass³ (+DB) |
| FV-16 | The confirm-payment invoice total is rounded to 5 sen (1234.57 → 1234.55) | ✅ pass³ (+DB) |
| FV-17 | A zero-total manual invoice is **not** auto-marked PAID | ✅ pass³ (+DB) |
| FV-18 | Payment-proof file → **403** when logged out | ✅ pass |
| FV-19 | Public portfolio image still loads (200) + `nosniff` header | ✅ pass |
| FV-20 | `saveUpload` rejects blank / disallowed Content-Type; stored ext from verified MIME | ✅ pass (unit) |
| FV-21 | Email subject is HTML-escaped (`<b>` → `&lt;b&gt;`) | ✅ pass⁴ |
| FV-22 | Two concurrent workers, 20 queued emails → exactly 20 delivered, 0 duplicates | ✅ pass⁵ |
| FV-23 | A REJECTED expense cannot be re-approved | ✅ pass³ (+DB) |
| FV-24 | A petty-cash spend larger than the float cannot be approved (stays PENDING) | ✅ pass³ (+DB) |
| FV-25 | AI off → refused with no OpenAI call; AI on + dead key → graceful error, no crash | ✅ pass³ |
| FV-26 | AI material costs clamped (negative→0, NaN qty→1, >10M rejected) | ✅ pass (unit) |
| FV-27 | Bare domain with a company's custom host → company's default locale (`/zh`), not `/en` | ✅ pass⁴ |
| FV-28 | `<html lang>` = ms / zh on those locales | ✅ pass |
| FV-29 | Packages nav shows Pakej / 配套 | ✅ pass |
| FV-30 | Unsigned WhatsApp webhook → 403 | ✅ pass |
| — | Protected `/admin` redirects to login · unknown quote token → 404 · login + wrong-password | ✅ pass |

¹ FV-02 — one-off run: mint a valid cookie → 200, disable the user in the DB → next request 307s to login.
² FV-07 — one-off run against your real data (deon = Bloom planner, john = 9Degree sales): injected 9Degree's location/staff IDs → server dropped both; deon's own Bloom location was accepted.
³ Verified 2026-06-26 by a one-off scripted run (crafted request as the relevant user + DB assert). FV-14/FV-23 used a "flip the row's state mid-flight, then submit" trick to exercise the server guard the UI hides. FV-25 used your 9Degree OpenAI key (no credit).
⁴ FV-21 — `renderEmail('invoice_issued','<b>hi</b>')` returns `&lt;b&gt;hi&lt;/b&gt;`. FV-27 — `curl -H "Host: 9degree.test"` (after setting that company custom domain + ZH default) → `307 → /zh`, while `Host: localhost` → `/en`. (9Degree's real config was restored afterward.)
⁵ FV-22 — verified 2026-06-26 with Mailpit + **two workers started simultaneously** against 20 seeded queued emails: each worker claimed 10 (the atomic `queued→sending` claim split them with no overlap), Mailpit received exactly 20 with 0 duplicates, no row stuck at `sending`. Test data removed and the pre-existing queued email restored afterward.

The unit suite (`npm run test -w web`, 16 tests) covers the money, rate-limit, upload-MIME and AI-cost logic: `calc.test.ts`, `rate-limit.test.ts`, `storage.test.ts` (FV-20), `ai/schema.test.ts` (FV-26).

**Also verified manually by you (2026-06-26):** FV-03 (login enumeration), FV-04 (custom domains are super-admin-only), FV-05 (duplicate domain rejected), FV-06 (AI-key probe blocked for non-admins). → **🎉 30 of 30 fixes verified — none remaining.**

### 🙋 Needs you (0)
All 30 confirmed fixes have been verified. The repeatable checks are: the standing Playwright suite (`cd apps/web && npx playwright test`), the unit suite (`npm run test -w web`), and the one-off command/scripted checks documented in the footnotes above and "How to test the remaining 5" below (useful if you ever want to re-run them).

## How to test the remaining 5 (step by step)

> Most of these don't need a real customer flow — a small unit test or a one-line command exercises the exact fix. Run everything from the project root unless noted, with the dev server up and `DATABASE_URL` pointing at your local DB. (Claude can run any of these for you — just ask.)

### FV-20 — Upload rejects a blank/forged Content-Type
*Protects against: uploading an HTML/SVG file by sending an empty file Content-Type.* A browser always sends a Content-Type, so this is tested with a unit test that calls `saveUpload` directly.
1. Create `apps/web/src/lib/storage.test.ts`:
   ```ts
   // @vitest-environment node
   import { describe, it, expect } from "vitest";
   import { saveUpload } from "./storage";
   describe("FV-20 saveUpload MIME guard", () => {
     it("rejects a blank Content-Type", async () => {
       expect(await saveUpload("fvtest", new File([new Uint8Array([1])], "evil.png", { type: "" }))).toBeNull();
     });
     it("rejects a disallowed type (svg)", async () => {
       expect(await saveUpload("fvtest", new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).toBeNull();
     });
     it("accepts a real image and forces a safe extension from the verified type", async () => {
       const r = await saveUpload("fvtest", new File([new Uint8Array([1])], "weird.html", { type: "image/png" }));
       expect(r?.url).toMatch(/\.png$/); // extension is png, not "html"
     });
   });
   ```
2. Run `npm run test -w web` → 3 pass.
3. Clean up the one file the accept-case wrote: `rm -rf apps/web/uploads/fvtest`.
- (The serving-side `nosniff` header is already covered by FV-19.)

### FV-26 — AI cost values are clamped before becoming quote lines
*Protects against: a hallucinated/injected negative / NaN / absurd cost.* Tested against the Zod schema directly (no OpenAI needed).
1. Create `apps/web/src/lib/ai/schema.test.ts`:
   ```ts
   import { describe, it, expect } from "vitest";
   import { AiMaterial } from "./schema";
   describe("FV-26 AiMaterial bounds", () => {
     it("clamps a negative cost to 0", () => expect(AiMaterial.parse({ name: "x", estCost: -9999, quantity: 1 }).estCost).toBe(0));
     it("defaults a NaN quantity to 1", () => expect(AiMaterial.parse({ name: "x", quantity: "abc", estCost: 10 }).quantity).toBe(1));
     it("rejects an absurd cost (>10M → 0)", () => expect(AiMaterial.parse({ name: "x", estCost: 1e308, quantity: 1 }).estCost).toBeLessThanOrEqual(10_000_000));
   });
   ```
2. Run `npm run test -w web` → 3 pass.

### FV-21 — Email subject is HTML-escaped
*Protects against: markup in a booking title / company name rendering as live HTML in the recipient's inbox.*
**Quick check (no SMTP):**
1. Run: `npx tsx -e "const {renderEmail}=require('./apps/worker/src/templates.ts'); console.log(renderEmail('invoice_issued','<b>hi</b> & <img src=x>'))"`
2. Expected: the `<h2>` contains `&lt;b&gt;hi&lt;/b&gt; &amp; &lt;img src=x&gt;` — escaped, **not** a real `<b>`/`<img>`.

**Full end-to-end (with a local mail catcher):**
1. `docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit`
2. In `.env`: `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_FROM="Test <no-reply@test.local>"` (leave USER/PASS blank).
3. Planning → **New event**: title `<b>XSS</b> Gala`, event date ~3 days out, attach a customer that has an email, balance due > 0.
4. Run the worker: `DATABASE_URL=postgresql://eventapp:eventapp@localhost:5432/eventapp?schema=public npm run worker:dev`
5. Within ~15s open Mailpit at **http://localhost:8025** → the email heading shows the literal text `<b>XSS</b>`, not bold. ✅

### FV-22 — Queued emails are never sent twice
*Protects against: an overlapping worker tick / a second worker re-sending the same email.* Enforced by an atomic claim (`UPDATE EmailLog SET status='sending' WHERE id=? AND status='queued'`) before each send.
1. With Mailpit running and a few emails queued (from FV-21 step 3, or any payment-proof / reminder), start **two** workers in two terminals: `npm run worker:dev` (×2).
2. In Mailpit (http://localhost:8025) confirm each email arrives **exactly once**.
3. Confirm no row is stuck mid-send: `docker exec eventpg psql -U eventapp -d eventapp -c 'SELECT status, count(*) FROM "EmailLog" GROUP BY status;'` → only `sent`/`failed`/`skipped`/`queued`, never a lingering `sending`.

### FV-27 — Bare domain redirects to the company's default language
*Protects against: a Malay/Chinese-first company's visitors being forced to English.* Only happens when a real host matches a company's custom domain — simulate it locally with a spoofed `Host` header.
1. Give a company a custom domain + non-English default. Quickest via DB:
   ```bash
   docker exec eventpg psql -U eventapp -d eventapp -c $'UPDATE "Company" SET "defaultLanguage"=\'ZH\', "customDomains"=ARRAY[\'9degree.test\'] WHERE name=\'9Degree\';'
   ```
   (or as super-admin: Companies → 9Degree → Default language = 中文, Custom domains = `9degree.test`.)
2. Curl the bare path with that Host:
   ```bash
   curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: 9degree.test" http://localhost:3000/
   ```
3. Expected: `307 http://9degree.test/zh` — redirected to **/zh** (the company default), not `/en`.
   Control: `-H "Host: localhost"` → redirects to `/en` (no company match).
4. Revert: `docker exec eventpg psql -U eventapp -d eventapp -c $'UPDATE "Company" SET "customDomains"=ARRAY[]::text[] WHERE name=\'9Degree\';'`

---

### Auth & session
- **`FV-01` Login lockout** *(P0)* ✅ **VERIFIED** — On `/login`, submit a wrong password for the same email **11 times**. Expected: after ~10 tries the error changes to **"Too many attempts. Please wait a few minutes and try again."** (lockout is per IP+email for 15 min).
- **`FV-02` Disabled user is cut off immediately** *(P0)* ✅ **VERIFIED** — Log in as a test staff user in browser A. As an admin in browser B, set that user's status to **Disabled** (Staff page). Back in browser A, click any back-office link. Expected: browser A is bounced to `/login` (session no longer valid) — **not** still working for up to 7 days.
- **`FV-03` No account enumeration** *(P1)* ✅ **VERIFIED** — Submit a wrong password for a **real** email and for a **fake** email. Expected: identical generic error "Invalid email or password." and similar response time (both run a bcrypt comparison).

### RBAC & multi-tenant isolation
- **`FV-04` Custom domains are super-admin-only** *(P0)* ✅ **VERIFIED** — As a **COMPANY_ADMIN**, edit your company and put a value in **Custom domains**, save. Expected: the field is ignored (domains unchanged). Only the **super-admin** can change custom domains.
- **`FV-05` Duplicate domain rejected** *(P1)* ✅ **VERIFIED** — As super-admin, add a custom domain to Company A, then try to add the **same** domain to Company B. Expected: red error "…is already claimed by another company."
- **`FV-06` Cross-company AI-key probe blocked** *(P1)* ✅ **VERIFIED** — A SALES/PLANNER user must not be able to run the "Test AI key" action. Expected: only COMPANY_ADMIN/super-admin can; the platform `OPENAI_API_KEY` is never testable by a tenant.
- **`FV-07` Cross-tenant FK injection blocked** *(P1, technical)* ✅ **VERIFIED** — A planner of Company A cannot attach Company B's saved location, staff member, or booking to their own records (server re-checks ownership). Verified 2026-06-26: as the Bloom planner, injecting 9Degree's location ID into an event was dropped (`booking.locationId` stayed null), adding 9Degree's staff as crew was dropped, while the Bloom planner's *own* location was accepted. Dropdowns only ever show your own company's data; the protection holds even against a hand-crafted request.

### Public quote flow
- **`FV-08` Quote PIN lockout** *(P0)* ✅ **VERIFIED** — On a PIN-gated proposal `/q/{token}`, enter a wrong 6-digit code **9 times**. Expected: after 8 wrong tries → **"Too many attempts. Try again in N minute(s)."**
- **`FV-09` Can't accept a dead quote** *(P0)* ✅ **VERIFIED** — Open the public link of a **REJECTED** or **EXPIRED** quote and attempt to accept (even by replaying the request). Expected: nothing happens — status only flips from **SENT**.
- **`FV-10` Double-click Accept is safe** *(P0)* ✅ **VERIFIED** — On a SENT quote, click **Accept** then immediately again. Expected: exactly **one** booking is created, no 500 error, button shows "Processing…" while in flight.
- **`FV-11` Overpayment rejected** *(P0)* ✅ **VERIFIED** — On the payment-proof form, enter an amount **larger than the outstanding balance**. Expected: red error "Amount exceeds the outstanding balance (RM …)."
- **`FV-12` Payment requires acceptance** *(P1)* ✅ **VERIFIED** — Payment proof can only be submitted on an **ACCEPTED** quote; a non-accepted quote returns "This proposal is not open for payment."
- **`FV-13` Expired quote can't be accepted** *(P1)* ✅ **VERIFIED** — A quote whose `validUntil` is in the past cannot be accepted even if still SENT.
- **`FV-14` Can't change an accepted quote** *(P1)* ✅ **VERIFIED** — "Request changes" on an already-accepted/rejected quote returns "This proposal can no longer be changed."

### Payment → invoice
- **`FV-15` Double-confirm yields one invoice** *(P0)* ✅ **VERIFIED** — In the back office, confirm the same pending payment twice quickly (double-click). Expected: **one** invoice is issued and the deposit is counted **once** (no duplicate invoice, no double-counted balance).
- **`FV-16` Consistent rounding** *(P1)* ✅ **VERIFIED** — The invoice total produced by **Confirm payment** matches the one produced via **Create invoice from quotation** (both rounded to 5 sen).
- **`FV-17` Zero-total invoice isn't auto-PAID** *(P1)* ✅ **VERIFIED** — Create a manual invoice with no line items (total 0). Expected: status stays **ISSUED**, not **PAID**.

### File uploads
- **`FV-18` Payment proofs are private** *(P0)* ✅ **VERIFIED** — Copy a payment-proof image URL (`/api/uploads/…`) from the back office, then open it in a **logged-out** browser (or as a different company). Expected: **403 Forbidden**.
- **`FV-19` Public images still load** *(P0)* ✅ **VERIFIED** — Portfolio images on the public site and the DuitNow QR on a proposal still load normally (these are intentionally public). No regression.
- **`FV-20` MIME bypass blocked** *(P1, technical)* ✅ **VERIFIED** (unit) — An upload with a blank/forged Content-Type is rejected; stored files get a safe extension derived from the verified type; the serve route sends `X-Content-Type-Options: nosniff`.

### Worker / email
- **`FV-21` Email subject is escaped** *(P1)* ✅ **VERIFIED** — `renderEmail('invoice_issued','<b>hi</b>')` returns the escaped `&lt;b&gt;hi&lt;/b&gt;`. (Full e2e: create a booking whose title contains HTML, trigger a reminder/invoice email with the worker + a mail catcher — the email shows the literal text, markup not rendered.)
- **`FV-22` No duplicate sends** *(P1, technical)* ✅ **VERIFIED** — Queued emails are atomically claimed before sending, so an overlapping worker tick can't send the same email twice. Verified with Mailpit + two simultaneous workers on 20 queued emails → exactly 20 delivered, 0 duplicates (each worker claimed 10).

### Expenses & petty cash
- **`FV-23` Expense state machine** *(P1)* ✅ **VERIFIED** — A **REJECTED** expense cannot be re-approved; a **SUBMITTED** expense cannot jump straight to **REIMBURSED** (only APPROVED → REIMBURSED).
- **`FV-24` Petty-cash can't go negative** *(P1)* ✅ **VERIFIED** — Try to approve a SPEND larger than the current float balance. Expected: it stays **PENDING** (approval is refused).

### AI
- **`FV-25` Disabled AI is enforced** *(P1)* ✅ **VERIFIED** — Turn **AI off** for a company, then use "Generate with AI" / "Extract receipt". Expected: "AI features are disabled for this company." — no OpenAI call is made. (Also verified: with AI on but a dead key, it errors gracefully instead of crashing.)
- **`FV-26` Bad AI costs rejected** *(P2, technical)* ✅ **VERIFIED** (unit) — AI-drafted materials with negative/NaN/huge costs are clamped or rejected before becoming quote lines (`ai/schema.test.ts`).

### i18n
- **`FV-27` Tenant default language** *(P2)* ✅ **VERIFIED** — Simulated locally with a spoofed Host header: a company with `customDomains=[9degree.test]` + default ZH → `curl -H "Host: 9degree.test" /` returns `307 → /zh` (control `Host: localhost` → `/en`).
- **`FV-28` `<html lang>` per locale** *(P2)* ✅ **VERIFIED** — On `/ms` and `/zh`, DevTools shows `<html lang="ms">` / `lang="zh">`.
- **`FV-29` Packages nav translated** *(P2)* ✅ **VERIFIED** — The "Packages" menu item shows **Pakej** (MS) / **配套** (ZH).

### WhatsApp
- **`FV-30` Unsigned webhook rejected** *(P0)* ✅ **VERIFIED** — A `POST /api/whatsapp/webhook` without a valid `X-Hub-Signature-256` returns **403** and writes nothing. (Requires `WHATSAPP_APP_SECRET` to be set; without it the webhook fails closed.)

---

# Part B — Per-module coverage

## Modules

1. [Authentication & Session](#1-authentication-session)
2. [RBAC & Multi-Tenant Isolation](#2-rbac-multi-tenant-isolation)
3. [Public 3D marketing site + i18n (home/services/portfolio/about/contact across EN/BM/ZH; reduced-motion 3D fallback; tenant-by-domain vs localhost fallback)](#3-public-3d-marketing-site-i18n-home-services-portfolio-about-contact-across-en-bm-zh-reduced-motion-3d-fallback-tenant-by-domain-vs-localhost-fallback)
4. [Enquiry form to Lead (multi-step contact form, reference image upload, validation, thank-you, lead in Back Office)](#4-enquiry-form-to-lead-multi-step-contact-form-reference-image-upload-validation-thank-you-lead-in-back-office)
5. [Quotations (create from lead, line items, costPrice/profit%/SST/deposit, totals, mark sent)](#5-quotations-create-from-lead-line-items-costprice-profit-sst-deposit-totals-mark-sent)
6. [Quotations — AI Generation (Generate with AI, OpenAI key tester, draft to editable lines)](#6-quotations-ai-generation-generate-with-ai-openai-key-tester-draft-to-editable-lines)
7. [Confirm payment to Booking + Invoice issuance (per-company numbering, SST snapshot, balance due, planning)](#7-confirm-payment-to-booking-invoice-issuance-per-company-numbering-sst-snapshot-balance-due-planning)
8. [Invoices (list, detail, edit, PDF/print document, void)](#8-invoices-list-detail-edit-pdf-print-document-void)
9. [Bookings (list, detail, status transitions, suppliers)](#9-bookings-list-detail-status-transitions-suppliers)
10. [Planning dashboard (event detail, checklist, suppliers, run-sheet, budget, inventory allocation)](#10-planning-dashboard-event-detail-checklist-suppliers-run-sheet-budget-inventory-allocation)
11. [Locations](#11-locations)
12. [Expenses & Petty Cash](#12-expenses-petty-cash)
13. [Finance P&L + Group reports (per-company P&L, super-admin consolidated reports, CSV export)](#13-finance-p-l-group-reports-per-company-p-l-super-admin-consolidated-reports-csv-export)
14. [Companies management (create/edit company: branding, SST, bank/DuitNow, profit%, prefixes, AI key, custom domains, domain binding)](#14-companies-management-create-edit-company-branding-sst-bank-duitnow-profit-prefixes-ai-key-custom-domains-domain-binding)
15. [Users / Staff management (create user, roles, status, company scoping)](#15-users-staff-management-create-user-roles-status-company-scoping)
16. [Portfolio management (upload portfolio images, ordering, display on public site)](#16-portfolio-management-upload-portfolio-images-ordering-display-on-public-site)
17. [WhatsApp (inbound webhook, conversation view, reply, bot)](#17-whatsapp-inbound-webhook-conversation-view-reply-bot)
18. [Background worker (queued email processing, balance reminder dedup, status sweep, SMTP-not-configured skip)](#18-background-worker-queued-email-processing-balance-reminder-dedup-status-sweep-smtp-not-configured-skip)
19. [Cross-cutting (file uploads, error states, security headers, health endpoint, back-office language toggle)](#19-cross-cutting-file-uploads-error-states-security-headers-health-endpoint-back-office-language-toggle)

---

## 1. Authentication & Session

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the database seeded. Use a desktop Chrome (or any modern browser). Seeded logins (password for both is ChangeMe123!): owner@platform.local = super-admin (group owner, no company); admin@bloomco.example = company admin for "Bloom & Co Events". Note there is NO seeded SALES or PLANNER login, so PLANNER-specific behaviour can only be tested if a planner account is created via the Staff page first (see TC-AUTH-13, optional). Before each test that needs you logged OUT, click "Log out" in the top-right of the back office, or clear cookies. Tip: to inspect the session cookie, open the browser DevTools (F12) > Application/Storage > Cookies > http://localhost:3000 and look for "ep_session".

#### `TC-AUTH-01` Super-admin logs in successfully and lands on the back office  
*Type: happy · Priority: P0*

**Steps:**
1. Make sure you are logged out (if you see a back-office sidebar, click 'Log out' top-right). 2. Go to http://localhost:3000/login. 3. In the 'Email' field type owner@platform.local. 4. In the 'Password' field type ChangeMe123! 5. Click the 'Sign in' button.

**Expected:** The button briefly shows 'Signing in…', then you are redirected to http://localhost:3000/admin. The back office loads: a dark blue left sidebar with Overview/Sales/Delivery/Marketing/Admin groups, and in the top-right a 'Log out' button. Because this is the group owner, the top-left of the header shows a company picker (Company Switcher), not just a name. No error message appears.

#### `TC-AUTH-02` Company admin logs in successfully and lands on the back office  
*Type: happy · Priority: P0*

**Steps:**
1. Ensure you are logged out. 2. Go to http://localhost:3000/login. 3. Email: admin@bloomco.example 4. Password: ChangeMe123! 5. Click 'Sign in'.

**Expected:** You are redirected to http://localhost:3000/admin. The back office loads. In the top-left of the header you see the user name 'Bloom Admin' (a plain name, NOT a company switcher, because this is a company-scoped user). The 'Log out' button is in the top-right.

#### `TC-AUTH-03` Login is case-insensitive on the email address  
*Type: edge · Priority: P1*

**Steps:**
1. Ensure you are logged out. 2. Go to http://localhost:3000/login. 3. Email: OWNER@PLATFORM.LOCAL (all upper case). 4. Password: ChangeMe123! 5. Click 'Sign in'.

**Expected:** Login succeeds and you land on http://localhost:3000/admin, exactly as with lower-case email. The email is normalised to lower case before lookup, so casing does not matter.

#### `TC-AUTH-04` Wrong password is rejected with a generic message  
*Type: negative · Priority: P0*

**Steps:**
1. Ensure you are logged out. 2. Go to http://localhost:3000/login. 3. Email: owner@platform.local 4. Password: wrongpassword 5. Click 'Sign in'.

**Expected:** You stay on the /login page. A red error message appears: 'Invalid email or password.' You are NOT taken to /admin. No session cookie is created (you remain logged out).

#### `TC-AUTH-05` Unknown email returns the SAME generic message as a wrong password (no account enumeration)  
*Type: security · Priority: P0*

**Steps:**
1. Ensure you are logged out. 2. Go to http://localhost:3000/login. 3. Email: nobody@nowhere.example 4. Password: ChangeMe123! 5. Click 'Sign in'. 6. Note the exact wording of the error. 7. Compare it to the error you got in TC-AUTH-04 for a real account with a wrong password.

**Expected:** The error reads 'Invalid email or password.' — identical to the wrong-password case in TC-AUTH-04. The system must NOT reveal whether the email exists (e.g. it must NOT say 'no such user' or 'user not found'). You remain on /login, logged out.

#### `TC-AUTH-06` Malformed email is rejected at validation (different message)  
*Type: negative · Priority: P1*

**Steps:**
1. Ensure you are logged out. 2. Go to http://localhost:3000/login. 3. If the browser blocks submission because of the email field, temporarily it is fine — but try Email: not-an-email (no @ sign). 4. Password: ChangeMe123! 5. Click 'Sign in'. (If the browser's own 'please enter an email address' bubble blocks you, that is the HTML required/email validation — note it and then test the server message by entering something like 'a@b' that passes the browser but may fail server validation.)

**Expected:** Either the browser blocks the submit with its built-in email-format prompt, OR the server returns the red message 'Enter a valid email and password.' (note this is a DIFFERENT message from the credential error). You stay on /login, logged out.

#### `TC-AUTH-07` Empty fields cannot be submitted  
*Type: edge · Priority: P1*

**Steps:**
1. Ensure you are logged out. 2. Go to http://localhost:3000/login. 3. Leave both Email and Password blank. 4. Click 'Sign in'.

**Expected:** The form does not submit. The browser shows its built-in 'Please fill out this field' prompt on the Email field (both Email and Password are marked required). No request to log in is sent and no error from the server appears; you remain on /login.

#### `TC-AUTH-08` Protected pages redirect to login when not signed in (and remember where you were heading)  
*Type: security · Priority: P0*

**Steps:**
1. Ensure you are fully logged out (clear cookies, or click 'Log out'). 2. In the address bar go directly to http://localhost:3000/admin/leads 3. Observe the page and the URL.

**Expected:** You are redirected to the login page. The URL becomes http://localhost:3000/login?next=/admin/leads (the page you wanted is captured in the 'next' parameter). The login form is shown. You cannot see any lead data while logged out.

#### `TC-AUTH-09` After logging in from a deep link, you are returned to that page  
*Type: happy · Priority: P1*

**Steps:**
1. Ensure you are logged out. 2. Go directly to http://localhost:3000/admin/invoices — you will be bounced to /login?next=/admin/invoices 3. On that login form enter admin@bloomco.example / ChangeMe123! 4. Click 'Sign in'.

**Expected:** After login you are taken to http://localhost:3000/admin/invoices (the originally requested page), not the default /admin dashboard, because a safe relative 'next' target is honoured for non-planner users.

#### `TC-AUTH-10` Open-redirect protection: a malicious 'next' target is ignored  
*Type: security · Priority: P0*

**Steps:**
1. Ensure you are logged out. 2. Manually craft and open this URL in the address bar: http://localhost:3000/login?next=https://evil.example.com 3. Enter owner@platform.local / ChangeMe123! 4. Click 'Sign in'. 5. Also repeat once with the URL http://localhost:3000/login?next=//evil.example.com

**Expected:** In BOTH cases you are NOT sent to evil.example.com. Because the 'next' value is not a safe relative path (it does not start with a single '/'), it is rejected and you land on the normal default http://localhost:3000/admin instead. No external navigation happens.

#### `TC-AUTH-11` Logout clears the session and blocks back-button access  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example / ChangeMe123! (you are now on /admin). 2. Click 'Log out' in the top-right of the header. 3. Observe where you land. 4. Now click the browser's Back button. 5. Also try typing http://localhost:3000/admin directly in the address bar.

**Expected:** Clicking 'Log out' returns you to http://localhost:3000/login. After logout, pressing Back or navigating to /admin redirects you to /login (now with ?next=/admin) — you can NOT get back into the back office. The session cookie 'ep_session' has been deleted (verify in DevTools > Application > Cookies if desired).

#### `TC-AUTH-12` Session cookie is HttpOnly, Lax, and set for ~7 days  
*Type: security · Priority: P1*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123! 2. Open DevTools (F12) > Application (Chrome) or Storage (Firefox) > Cookies > http://localhost:3000 3. Find the cookie named 'ep_session' and inspect its attributes (HttpOnly, SameSite, Expires/Max-Age).

**Expected:** A cookie named 'ep_session' exists. Its 'HttpOnly' flag is checked/true (not readable by page JavaScript). 'SameSite' is 'Lax'. Its Expires/Max-Age is roughly 7 days from now. (On plain http://localhost the 'Secure' flag is typically off in dev; that is expected.)

#### `TC-AUTH-13` A tampered or garbage session cookie is rejected and forces re-login  
*Type: security · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example so you have a valid session and are on /admin. 2. Open DevTools > Application > Cookies > http://localhost:3000 3. Edit the value of the 'ep_session' cookie — change a few characters in the middle (corrupting the signed token) and save. 4. Reload http://localhost:3000/admin (or navigate to /admin/leads).

**Expected:** The corrupted token fails signature verification, so you are treated as logged out and redirected to /login (with a ?next parameter for the page you tried). You cannot reach the back office with a tampered cookie. Restoring a valid login requires signing in again.

#### `TC-AUTH-14` Super-admin only: Companies and Group reports pages are blocked for a company admin  
*Type: security · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example (company admin) / ChangeMe123! 2. Confirm the left sidebar Admin group does NOT show a 'Companies' or 'Group reports' link (it should show 'Staff', 'Finance (P&L)' and a 'Settings' link). 3. Now force the issue: type http://localhost:3000/admin/companies directly into the address bar. 4. Then type http://localhost:3000/admin/reports directly.

**Expected:** Neither super-admin-only page opens for the company admin. In both cases you are silently redirected back to http://localhost:3000/admin (the dashboard). You never see the group company list or the cross-company group report. (For comparison, logging in as owner@platform.local CAN open both pages.)

#### `TC-AUTH-15` Cross-company access blocked: company admin cannot open another company's settings  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local (super-admin) and go to http://localhost:3000/admin/companies — note the ID in the URL of the existing 'Bloom & Co Events' company (click into it; the URL is /admin/companies/<some-id>). If a second company exists, note its ID instead. 2. Log out. 3. Log in as admin@bloomco.example (the Bloom company admin). 4. The 'Settings' link in the sidebar opens this admin's OWN company and should work. 5. Now in the address bar manually change the company id to a different/invented one, e.g. http://localhost:3000/admin/companies/some-other-id

**Expected:** Step 4 (own company settings) loads the company edit form. Step 5 (a company id that is NOT this admin's own company) is denied: you are redirected to http://localhost:3000/admin. A company admin may only edit their own company; they cannot reach another tenant's settings by guessing the URL.

#### `TC-AUTH-16` Super-admin with no company selected sees a 'pick a company' prompt on company-scoped data  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123! 2. Make sure the Company Switcher in the top-left header is set to the group/all view (no specific company chosen). 3. Navigate to a company-scoped data page such as http://localhost:3000/admin/leads.

**Expected:** Because the super-admin has no active company selected, the page shows a highlighted notice: 'Pick a company from the switcher above to view its data.' rather than mixing data from all companies. Choosing 'Bloom & Co Events' in the switcher then loads that company's data.

#### `TC-AUTH-17` Visiting /login while already signed in still shows the form (no auto-bounce)  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as owner@platform.local so you have an active session. 2. Without logging out, type http://localhost:3000/login in the address bar and load it.

**Expected:** The login form is displayed (the app does not auto-redirect an already-authenticated user away from /login). Logging in again with valid credentials simply re-establishes the session and lands you on /admin. This documents current behaviour — note it if the owner expects an automatic bounce to /admin.

---

## 2. RBAC & Multi-Tenant Isolation

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the database seeded. Seeded logins (password ChangeMe123! for all): owner@platform.local = SUPER_ADMIN (group owner, no company); admin@bloomco.example = COMPANY_ADMIN of "Bloom & Co Events". IMPORTANT: the seed contains only ONE company and NO sales/planner users, so several cases below first build the missing fixtures. Recommended setup order before running the negative/isolation cases: (1) run RBAC-15 to create a second company "Test Decor Co", then (2) run RBAC-14 to create one SALES user (sales@bloomco.example), one PLANNER user (planner@bloomco.example), and one COMPANY_ADMIN for the second company (admin@testdecor.example). Use a normal browser, and a second private/incognito window when a case asks you to be logged in as two different people at once. To "log out" use the "Log out" button in the top-right header of the back office; to fully clear a session you can also delete cookies for localhost. Always start each login case from a logged-out state (visit http://localhost:3000/login). Take note that URLs of records (e.g. a quotation id) are needed for cross-company cases — copy them from the address bar while viewing a record as someone allowed to see it.

#### `RBAC-01` Unauthenticated user is bounced from the back office to login  
*Type: security · Priority: P0*

**Steps:**
1. Make sure you are logged out (click Log out, or open a fresh private window).
2. In the address bar, go directly to http://localhost:3000/admin
3. Observe where the browser lands.
4. Repeat with http://localhost:3000/admin/companies and http://localhost:3000/planning

**Expected:** Each attempt redirects to the login page (URL becomes http://localhost:3000/login?next=/admin etc., with a 'next' value matching the page you tried). No admin or planning content is ever shown before the redirect.

#### `RBAC-02` Super-admin logs in and lands on the group dashboard with a company switcher  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/login
2. Enter Email: owner@platform.local and Password: ChangeMe123! then click Sign in.
3. Observe the landing page and the top-left of the header.
4. Look at the left sidebar navigation groups.

**Expected:** Lands on http://localhost:3000/admin (Dashboard). Top-left header shows a 'Active company' dropdown (the company switcher). Because no company is selected yet, the dashboard heading area shows 'Viewing all companies'. The sidebar Admin group shows Staff, Finance (P&L), Companies, and Group reports.

#### `RBAC-03` Company-admin logs in, sees only their own company, and has NO company switcher  
*Type: happy · Priority: P0*

**Steps:**
1. Log out of any prior session, go to http://localhost:3000/login
2. Enter Email: admin@bloomco.example and Password: ChangeMe123! and click Sign in.
3. Observe the top-left header.
4. Look at the sidebar Admin group.
5. Open the Dashboard heading text.

**Expected:** Lands on /admin. The top-left header shows the user's name ('Bloom Admin'), NOT a company switcher dropdown. The Admin nav shows Staff, Finance (P&L), and 'Settings' (linking to their own company) — but NO 'Companies' list and NO 'Group reports'. Dashboard shows 'Active company: Bloom & Co Events' (never 'all companies').

#### `RBAC-04` Super-admin company switcher scopes all data to the selected company  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as owner@platform.local.
2. In the top-left 'Active company' dropdown, choose 'Bloom & Co Events'.
3. Note the Dashboard now reads 'Active company: Bloom & Co Events' and the KPI numbers.
4. Visit http://localhost:3000/admin/quotations and http://localhost:3000/admin/leads — confirm rows appear.
5. (After RBAC-15 has created a second company) switch the dropdown to 'Test Decor Co' and revisit the Dashboard and Quotations.

**Expected:** Selecting a company reloads the views scoped to that company. With Bloom selected, Bloom's leads/quotations/KPIs are shown. After switching to Test Decor Co (which has no data), the dashboard counters drop to 0 and the quotations/leads lists are empty — proving each company's data is isolated. The selection persists across page navigations.

#### `RBAC-05` Super-admin with NO company selected sees the group-wide rollup but is blocked from company-scoped lists  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local in a fresh window so no company is pre-selected (the 'Active company' dropdown reads 'Select company…').
2. Open the Dashboard (/admin).
3. Visit http://localhost:3000/admin/quotations
4. Visit http://localhost:3000/planning
5. Visit http://localhost:3000/admin/finance

**Expected:** Dashboard shows the consolidated 'Viewing all companies' rollup (totals across companies). Quotations and Planning pages show a 'Select a company from the switcher' notice instead of a list. Finance shows 'Pick a company from the switcher above to view its data.' No cross-company list leaks while in group mode for these company-scoped screens.

#### `RBAC-06` PLANNER is denied the back office and forced into the planning dashboard  
*Type: security · Priority: P0*

**Steps:**
1. Ensure a PLANNER user exists (created in RBAC-14, e.g. planner@bloomco.example / ChangeMe123!).
2. Log out, go to http://localhost:3000/login and sign in as planner@bloomco.example.
3. Observe the landing page.
4. Manually type http://localhost:3000/admin into the address bar.
5. Manually type http://localhost:3000/admin/companies and http://localhost:3000/admin/finance.

**Expected:** Login lands the planner on http://localhost:3000/planning (not /admin). Any attempt to open /admin or any /admin/* page immediately redirects back to /planning. The planner's sidebar shows only the 'Delivery' group (Planning, Locations, Expenses, Petty Cash) — no Sales, Marketing, Companies, Finance, or Staff links.

#### `RBAC-07` SALES user cannot reach Staff, Finance, Companies, or Group reports  
*Type: security · Priority: P0*

**Steps:**
1. Ensure a SALES user exists (created in RBAC-14, e.g. sales@bloomco.example / ChangeMe123!).
2. Log in as sales@bloomco.example.
3. Inspect the sidebar Admin group.
4. Manually visit http://localhost:3000/admin/users
5. Manually visit http://localhost:3000/admin/finance
6. Manually visit http://localhost:3000/admin/companies
7. Manually visit http://localhost:3000/admin/reports

**Expected:** Sidebar Admin group shows only 'Staff' is NOT actionable for sales (the Staff link may appear, but the page denies access). /admin/users shows 'You don't have access to staff management.' /admin/finance shows the same access-denied message. /admin/companies and /admin/reports redirect the sales user back to /admin (super-admin-only pages). Sales can still see Leads, Quotations, Bookings, Invoices for their own company.

#### `RBAC-08` Company-admin cannot open another company's Settings page (cross-company access denied)  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, open http://localhost:3000/admin/companies and copy the company id from the URL of the SECOND company 'Test Decor Co' (e.g. /admin/companies/<OTHER_ID>). Created via RBAC-15.
2. Log out and log in as admin@bloomco.example (admin of Bloom & Co only).
3. In the address bar, go directly to http://localhost:3000/admin/companies/<OTHER_ID> (the other company's settings).
4. Also try to open the companies list at http://localhost:3000/admin/companies.

**Expected:** Opening the other company's settings page redirects to /admin (access denied — the page only allows super-admin or the matching company's admin). The /admin/companies list page also redirects to /admin for the company-admin (super-admin only). The company-admin can ONLY reach their own company's Settings via the sidebar 'Settings' link.

#### `RBAC-09` Direct-link to another company's quotation is blocked for a company-scoped user  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, select 'Bloom & Co Events', open http://localhost:3000/admin/quotations, open any quotation and copy its URL (http://localhost:3000/admin/quotations/<BLOOM_QUOTE_ID>).
2. Create or note a quotation belonging to the second company 'Test Decor Co' (open it while Test Decor Co is selected and copy http://localhost:3000/admin/quotations/<OTHER_QUOTE_ID>). If Test Decor Co has no quotation yet, create one via the 'New quotation' control while that company is active.
3. Log out and log in as admin@bloomco.example.
4. Paste the other company's quotation URL http://localhost:3000/admin/quotations/<OTHER_QUOTE_ID> into the address bar.

**Expected:** The Bloom company-admin is redirected to /admin/quotations (cannot view a quotation that belongs to a different company), even with the exact id/URL. Their own company's quotation (BLOOM_QUOTE_ID) opens normally. This proves per-record tenant isolation, not just list filtering.

#### `RBAC-10` Direct-link to another company's booking and planning board is blocked  
*Type: security · Priority: P1*

**Steps:**
1. As owner@platform.local with Test Decor Co selected, create or open a booking belonging to Test Decor Co and copy both URLs: http://localhost:3000/admin/bookings/<OTHER_BOOKING_ID> and http://localhost:3000/planning/<OTHER_BOOKING_ID>.
2. Log out and log in as admin@bloomco.example.
3. Paste http://localhost:3000/admin/bookings/<OTHER_BOOKING_ID> into the address bar.
4. Paste http://localhost:3000/planning/<OTHER_BOOKING_ID> into the address bar.

**Expected:** The booking detail URL redirects the Bloom admin to /admin/bookings, and the planning board URL redirects to /planning. Neither the other company's booking details nor its planning board are shown. (If you instead use a completely made-up id, the page shows a 'not found' state.)

#### `RBAC-11` Company-admin can create staff only for their own company and cannot grant super-admin  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example.
2. Go to http://localhost:3000/admin/users.
3. In the 'Add staff' form, inspect the Role dropdown options.
4. Confirm there is NO 'company' selector in the form.
5. Create a staff member: Full name 'Test Sales', email a fresh address like sales2@bloomco.example, a temporary password of at least 8 chars, Role 'sales', then click Add staff.
6. In the staff table, inspect the Role dropdown on an existing row.

**Expected:** The Add-staff Role dropdown offers only company admin / sales / planner (NO super admin). There is no company selector (the new staff is silently assigned to Bloom & Co). The new staff member appears in the list. Existing rows' role dropdowns also exclude 'super admin' for the company-admin, and there is no 'Company' column (company-admins only see/manage their own company's staff).

#### `RBAC-12` A user cannot disable their own account (no self lock-out)  
*Type: security · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example.
2. Go to http://localhost:3000/admin/users.
3. Find your own row (marked '(you)').
4. Inspect the status dropdown on your own row and try to change it to 'disabled' and click Save.
5. Refresh the page and confirm your status.

**Expected:** The status dropdown on your own row is disabled (greyed out / not changeable). Even if you force a 'disabled' value, the save ignores the status change for your own account — you remain 'active' and stay logged in. (Role can still be changed on other rows, but you cannot lock yourself out.)

#### `RBAC-13` Disabled user cannot log in  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. On the row for the test sales user created in RBAC-11 (sales2@bloomco.example), set status to 'disabled' and click Save.
3. Log out.
4. Go to http://localhost:3000/login and try to sign in as sales2@bloomco.example with its password.

**Expected:** Login fails with 'Invalid email or password.' (disabled accounts are rejected at login even with the correct password). Re-enabling the user (set status back to 'active' as the admin) allows login again.

#### `RBAC-14` Super-admin creates SALES, PLANNER and a second-company COMPANY_ADMIN (fixture builder)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as owner@platform.local.
2. Go to http://localhost:3000/admin/users.
3. In the Add-staff form note that a company selector IS present (super-admin only) and the Role dropdown includes 'super admin'.
4. Create: name 'Bloom Sales', email sales@bloomco.example, password ChangeMe123!, Role 'sales', Company 'Bloom & Co Events'. Click Add staff.
5. Create: name 'Bloom Planner', email planner@bloomco.example, password ChangeMe123!, Role 'planner', Company 'Bloom & Co Events'.
6. (Requires RBAC-15 done) Create: name 'Decor Admin', email admin@testdecor.example, password ChangeMe123!, Role 'company admin', Company 'Test Decor Co'.
7. Confirm all three appear in the staff table with the right Company column values.

**Expected:** All three users are created successfully (green 'Staff member added.' confirmation each time). The staff list shows a 'Company' column (super-admin view) with each user mapped to the correct company. Selecting Role 'super admin' leaves the company selector ignored (super-admins are group-level / no company). These accounts are then usable by RBAC-06, 07, 08, 16.

#### `RBAC-15` Only super-admin can create a new company (fixture builder + permission check)  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local.
2. Go to http://localhost:3000/admin/companies and click '+ New company'.
3. Fill name 'Test Decor Co' (and any required fields), then save.
4. Confirm it appears in the companies list and copy its id from the URL.
5. Log out and log in as admin@bloomco.example, then in the address bar go to http://localhost:3000/admin/companies/new.

**Expected:** Super-admin successfully creates 'Test Decor Co' and is redirected to its settings page (with a 'Saved' confirmation); it now appears in the company switcher and companies list. When the Bloom company-admin tries to open /admin/companies/new, they are redirected to /admin (company creation is super-admin only).

#### `RBAC-16` Second-company admin sees only their own company's data, never Bloom's  
*Type: security · Priority: P0*

**Steps:**
1. Ensure admin@testdecor.example exists (RBAC-14) and Test Decor Co exists (RBAC-15).
2. Log out and log in as admin@testdecor.example.
3. Confirm there is no company switcher in the header and the Dashboard reads 'Active company: Test Decor Co'.
4. Visit http://localhost:3000/admin/quotations, /admin/leads, /admin/bookings, /admin/invoices and /admin/users.
5. Try the Bloom company id in the URL: http://localhost:3000/admin/companies/<BLOOM_ID> (the Bloom company id, copied earlier as super-admin).

**Expected:** No company switcher (only super-admins switch). All lists are scoped to Test Decor Co (empty if no data was created for it) and show ZERO Bloom records. The Staff page shows only Test Decor Co users. Opening Bloom's company settings URL redirects to /admin (denied). This is the core cross-tenant isolation proof from a second tenant's perspective.

#### `RBAC-17` Company switcher action is rejected for non-super-admins (tamper attempt)  
*Type: security · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example and confirm there is no switcher in the UI.
2. Open the browser DevTools > Application/Storage > Cookies for http://localhost:3000.
3. Manually add (or edit) a cookie named ep_active_company with a value equal to the OTHER company's id (Test Decor Co id copied earlier).
4. Reload http://localhost:3000/admin and visit /admin/quotations.

**Expected:** Setting the ep_active_company cookie has NO effect for a company-admin — their views remain scoped to their own company (Bloom & Co), because non-super-admins always resolve to their own companyId regardless of the cookie. They never see the other company's data, confirming the switcher cookie cannot be abused to cross tenants.

#### `RBAC-18` Login honours a safe ?next= deep link but rejects unsafe redirects; PLANNER deep links ignored  
*Type: security · Priority: P1*

**Steps:**
1. Log out. In the address bar go to http://localhost:3000/admin/finance (you'll be bounced to /login?next=/admin/finance).
2. Sign in as admin@bloomco.example and observe where you land.
3. Log out. Go to http://localhost:3000/login?next=https://evil.example/phish and sign in as admin@bloomco.example.
4. Log out. Go to http://localhost:3000/login?next=/admin/finance and sign in as planner@bloomco.example.

**Expected:** Step 2: after login you land on /admin/finance (the safe relative deep link is honoured). Step 3: the external/unsafe next target is ignored — you land on /admin instead of being redirected off-site. Step 4: the planner's next= is ignored and they are sent to /planning (planners are always routed to the planning dashboard). No open-redirect is possible.

#### `RBAC-19` Stale/invalid session cookie is treated as logged out  
*Type: security · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example and confirm you can see /admin.
2. Open DevTools > Application > Cookies for http://localhost:3000.
3. Edit the ep_session cookie value: change a few characters so the token is corrupted.
4. Reload http://localhost:3000/admin and try http://localhost:3000/admin/leads.

**Expected:** With a tampered/invalid session token the user is redirected to /login (the corrupted JWT fails verification and is treated as no session). No admin content is shown. Logging in again restores access.

---

## 3. Public 3D marketing site + i18n (home/services/portfolio/about/contact across EN/BM/ZH; reduced-motion 3D fallback; tenant-by-domain vs localhost fallback)

*Area: frontend*

**Prerequisites:** App running at http://localhost:3000 with seeded data (company "Bloom & Co Events", brand gold #c9a35b, custom domain bloomco.example). Use a desktop browser (Chrome/Safari/Edge) for most cases; one case uses a phone-sized window. No login is needed for the public marketing site — these pages are public. Logins (owner@platform.local / admin@bloomco.example, both ChangeMe123!) are only referenced by the back-office cross-company note. Tip: before each i18n case, click into the browser address bar so you can read the URL. To reset state between runs, open a fresh private/incognito window. The public site is intentionally dark-themed with a deep navy background.

#### `PUB-01` Root URL redirects to the default English homepage  
*Type: happy · Priority: P0*

**Steps:**
1. Open a fresh browser tab. 2. In the address bar type http://localhost:3000 and press Enter. 3. Wait for the page to finish loading. 4. Read the URL shown in the address bar.

**Expected:** The address bar changes to http://localhost:3000/en (the app redirects the bare root to the English locale). The homepage renders with a large hero headline 'We turn spaces into unforgettable moments', a 'Plan your event' button area, a stats band (500+, 10+, 100%, 5★), a Services section, a Showcase section, and a footer. No error or blank page.

#### `PUB-02` Homepage loads with company branding pulled from the seeded tenant  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en . 2. Look at the top navigation bar on the left. 3. Look at the primary buttons ('Plan your event' in the nav, and the hero call-to-action buttons). 4. Scroll to the very bottom footer and read the company name and copyright line.

**Expected:** The brand name shown is 'Bloom & Co Events' (the seeded company that the localhost fallback resolves to) in both the top-left of the nav and the footer. Primary buttons use the company brand colour (a gold tone, not the generic blue), confirming branding comes from the resolved tenant. The footer shows the current year and a rights/tagline line.

#### `PUB-03` Top navigation links route to every public page  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en . 2. In the top navigation, click 'Services' and confirm the page. 3. Click the browser Back button, then click 'Packages'. 4. Back, then click 'Portfolio'. 5. Back, then click 'About'. 6. Back, then click 'Contact'. 7. For each, read the URL and the page heading.

**Expected:** Services -> /en/services (heading is the Services title). Packages -> /en/packages (heading 'Our Packages'). Portfolio -> /en/portfolio (Showcase/portfolio heading). About -> /en/about (About heading + body paragraph). Contact -> /en/contact (heading is the form title with a multi-step enquiry form). Every link stays inside the /en locale prefix and loads without error.

#### `PUB-04` Language switcher changes the whole site to Bahasa Malaysia (BM)  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en . 2. In the top-right of the nav, find the language dropdown (shows 'EN'). 3. Click it and select 'BM'. 4. Wait for the page to reload. 5. Read the URL and the hero headline, then check the nav link labels.

**Expected:** URL becomes http://localhost:3000/ms . The hero headline becomes 'Kami mengubah ruang menjadi detik tidak terlupakan' and the nav labels switch to Malay ('Perkhidmatan', 'Portfolio', 'Tentang', 'Hubungi', and the enquire button 'Rancang majlis anda'). The page does not 404 and stays on the same page type (home).

#### `PUB-05` Language switcher changes the site to Chinese (中文) and stays on the same page  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en/services . 2. Open the language dropdown in the nav (shows 'EN'). 3. Select '中文'. 4. Read the URL and confirm which page you are on. 5. Confirm the Services heading and item text are in Chinese.

**Expected:** URL becomes http://localhost:3000/zh/services (the locale segment is swapped but you remain on the Services page, not bounced to the home page). The Services heading and content render in Chinese characters (e.g. nav shows 服务/作品/关于/联系). No English fallback text appears for the main headings.

#### `PUB-06` Language switch from a deep page preserves the current page and query string  
*Type: edge · Priority: P1*

**Steps:**
1. Open http://localhost:3000/en/contact/thank-you?ref=BLOOM-EVT-2026-0001 directly. 2. Confirm a success/thank-you page shows the reference 'BLOOM-EVT-2026-0001'. 3. Open the language dropdown and select 'BM'. 4. Read the new URL carefully, including everything after the ? mark.

**Expected:** URL becomes http://localhost:3000/ms/contact/thank-you?ref=BLOOM-EVT-2026-0001 — the deep path (/contact/thank-you) AND the query string (?ref=...) are both preserved, only the locale prefix changed. The reference number BLOOM-EVT-2026-0001 still displays on the page, now with Malay surrounding text.

#### `PUB-07` Invalid / unsupported locale in the URL returns Not Found  
*Type: negative · Priority: P1*

**Steps:**
1. In the address bar enter http://localhost:3000/de (German — an unsupported locale) and press Enter. 2. Observe the result. 3. Repeat with http://localhost:3000/fr/services . 4. Repeat with a junk value http://localhost:3000/xx .

**Expected:** Each unsupported-locale URL returns a 404 / 'Not Found' page (only en, ms, zh are valid). The app does not silently show English content under a wrong locale prefix and does not crash with a server error.

#### `PUB-08` 3D hero animation renders on the homepage with motion enabled  
*Type: happy · Priority: P1*

**Steps:**
1. Ensure your operating system / browser is NOT in reduced-motion mode (on macOS: System Settings > Accessibility > Display > 'Reduce motion' is OFF). 2. Open http://localhost:3000/en in a fresh tab. 3. Watch the hero area behind the headline for several seconds. 4. Move your mouse pointer slowly across the hero area.

**Expected:** Behind the headline a slowly rotating 3D ring/arch with small glowing orbs and a cloud of drifting particles is visible (rendered client-side after load). The scene reacts subtly to the mouse pointer position (parallax tilt). A background video and gradient also show. The headline and buttons remain readable on top.

#### `PUB-09` Reduced-motion accessibility fallback: 3D scene and animations are suppressed  
*Type: edge · Priority: P1*

**Steps:**
1. Turn ON the OS/browser reduced-motion setting (macOS: System Settings > Accessibility > Display > 'Reduce motion' ON; or in Chrome DevTools > Rendering panel, set 'Emulate CSS prefers-reduced-motion' to 'reduce'). 2. Open a fresh tab and go to http://localhost:3000/en . 3. Observe the hero area for several seconds and move the mouse over it. 4. Scroll down and watch the section/card reveals.

**Expected:** The animated 3D ring/particles do NOT render (the hero shows only the static gradient + background video). Content sections appear immediately fully visible rather than fade-up animating, and the gradient text stops cycling. The page is fully usable and all text/buttons are present — confirming the accessibility fallback works.

#### `PUB-10` Enquiry form happy path: complete all 4 steps and submit  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en/contact . 2. On Step 1 (Event): pick an Event Type, type a Venue, pick an Event Date and Time. 3. Click 'Next'. 4. On Step 2 (Vision): type a theme, pick a budget range, enter a guest count and purpose. 5. Click 'Next'. 6. On Step 3 (Details): optionally choose reference images, type a special request. 7. Click 'Next'. 8. On Step 4 (Contact): enter Name (e.g. 'Test User'), Phone (e.g. '+60 12-345 6789'), a valid Email (e.g. 'test@example.com'), and a preferred language. 9. Click 'Submit'.

**Expected:** The stepper advances 1->2->3->4 with each 'Next'. On submit the button shows a submitting state, then the browser navigates to /en/contact/thank-you?ref=<REFERENCE>. The thank-you page shows a green check, a success message, and a reference number formatted like BLOOM-EVT-2026-#### (e.g. BLOOM-EVT-2026-0002). A 'back to home' link returns to /en.

#### `PUB-11` Enquiry form validation: required Contact fields block submission  
*Type: negative · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en/contact . 2. Click 'Next' three times to advance directly to Step 4 (Contact) without filling earlier optional fields. 3. Leave Name, Phone, and Email all blank. 4. Click 'Submit'. 5. Then enter Name and Phone but type an invalid email like 'notanemail' and click 'Submit' again.

**Expected:** First submit: the form does not navigate to the thank-you page. The required fields (Name, Phone, Email — all marked required) prevent submission; the browser's built-in required-field prompts appear, or a red error message 'Please complete the required fields.' shows. Second submit with a malformed email: submission is still blocked (email must be a valid format). No lead is created until all required fields are valid.

#### `PUB-12` Enquiry form edge: optional Event/Vision/Details fields can all be skipped  
*Type: edge · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/ms/contact (Malay locale to also confirm submit works under a non-EN locale). 2. Do NOT touch Step 1, 2, or 3 — click 'Next' three times. 3. On Step 4 fill only Name, Phone, and a valid Email. 4. Submit.

**Expected:** Submission succeeds because only Name/Phone/Email are required (date, venue, theme, budget, guest count, images, special request are all optional). The browser navigates to /ms/contact/thank-you?ref=<REFERENCE> with the reference number shown and the surrounding text in Malay (locale is carried through from the URL, not reset to English).

#### `PUB-13` Stepper navigation: Back is disabled on step 1 and you can jump between steps  
*Type: edge · Priority: P2*

**Steps:**
1. Go to http://localhost:3000/en/contact . 2. On Step 1, look at the 'Back' button. 3. Click 'Next' to reach Step 2 and confirm 'Back' is now usable. 4. Click 'Back' to return to Step 1. 5. In the stepper at the top, click directly on the numbered step labels (e.g. step 3, then step 1) to jump around.

**Expected:** On Step 1 the 'Back' button is disabled (greyed/non-clickable). After clicking 'Next', 'Back' becomes active and returns you one step. The numbered step buttons in the stepper let you jump directly to any step. The submit button only appears on the final (Contact) step; earlier steps show 'Next' instead.

#### `PUB-14` Portfolio and Packages empty/placeholder states render gracefully  
*Type: edge · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/en/portfolio . 2. Observe the gallery area. 3. Go to http://localhost:3000/en/packages . 4. Observe the packages area.

**Expected:** Portfolio: if the seeded company has no PORTFOLIO images, a tidy grid of placeholder/skeleton tiles shows (no broken image icons, no crash); if images exist they render in a masonry-style gallery. Packages: if no active packages exist, the text 'Packages coming soon.' shows; if packages exist they appear grouped by category with name, price (RM …) or 'Included', and an 'Enquire now' button at the bottom linking to /en/contact. Neither page errors on empty data.

#### `PUB-15` Mobile layout: hamburger menu opens/closes and language switcher works  
*Type: happy · Priority: P1*

**Steps:**
1. Open Chrome DevTools device toolbar (or resize the window to ~390px wide, an iPhone-sized viewport). 2. Go to http://localhost:3000/en . 3. Confirm the desktop nav links are hidden and a hamburger (☰) button shows. 4. Tap the hamburger. 5. Tap a link (e.g. 'About') in the panel. 6. Re-open the menu, tap the hamburger again to close it. 7. Use the language dropdown to switch to BM.

**Expected:** At narrow width the inline nav links collapse into a hamburger button. Tapping it opens a panel listing Services, Packages, Portfolio, About, Contact plus an enquire button. Tapping a link navigates and closes the panel. Tapping the hamburger again (now showing ✕) closes the panel. The language dropdown remains visible and switching to BM moves to /ms and translates the page.

#### `PUB-16` i18n coverage gap: 'Packages' nav label and Packages page chrome stay English under BM/ZH  
*Type: negative · Priority: P2*

**Steps:**
1. Go to http://localhost:3000/ms (Malay). 2. Read every nav link label, paying attention to the 'Packages' item. 3. Navigate to http://localhost:3000/zh/packages . 4. Read the page heading and the 'Enquire now' button and the empty-state text.

**Expected:** Document the actual behaviour: the 'Packages' nav label, the Packages page heading ('Our Packages'), the intro line, the 'Enquire now' button, and 'Packages coming soon.' are NOT translated — they remain in English even on the BM and ZH sites. This is an i18n completeness gap (the rest of the nav and home/services/about/contact ARE translated). Flag it so the owner knows these strings are hardcoded and need localisation; it should not be mistaken for a passing translation.

#### `PUB-17` Tenant resolution by custom domain (bloomco.example) vs localhost fallback  
*Type: security · Priority: P1*

**Steps:**
1. Confirm http://localhost:3000/en resolves to 'Bloom & Co Events' branding (localhost fallback to the first company). 2. To verify domain-based resolution without DNS, add a hosts entry mapping bloomco.example to 127.0.0.1 (e.g. edit /etc/hosts: '127.0.0.1 bloomco.example'), or have a developer set the Host header. 3. Visit http://bloomco.example:3000/en . 4. Compare the brand name, colours, SEO title (browser tab) and footer to the localhost view. 5. If you cannot edit hosts, instead confirm the SEO title in the browser tab on localhost matches the seeded company.

**Expected:** On localhost the site falls back to the first company (Bloom & Co Events) and shows its gold branding and SEO title in the tab. When served on the matching custom domain bloomco.example, the SAME company is resolved by domain match (customDomains contains 'bloomco.example'), so branding/SEO are identical. The system never shows a random or blank tenant; an unmatched domain still falls back to the first active company rather than erroring.

#### `PUB-18` Footer social links only appear when configured and open safely in a new tab  
*Type: edge · Priority: P2*

**Steps:**
1. Go to http://localhost:3000/en . 2. Scroll to the footer. 3. Look for social links (Facebook / Instagram / TikTok / YouTube). 4. If any are present, click one. 5. If the seeded company has none configured, confirm no empty/broken social link row renders.

**Expected:** Only social platforms that the resolved company actually has a URL for are listed (the seeded company may have none, in which case the social row is simply absent — not an empty box). Any present link opens in a new browser tab (target=_blank) to the external URL and uses safe rel settings (no opener access back to the site). Footer always shows the brand name, tagline, and copyright year regardless.

#### `PUB-19` Public marketing pages are reachable WITHOUT login (no auth wall on the storefront)  
*Type: security · Priority: P0*

**Steps:**
1. Open a fresh private/incognito window (no session cookie). 2. Visit http://localhost:3000/en , then /en/services , /en/portfolio , /en/about , /en/contact , /en/packages . 3. Confirm none of them redirect to /login. 4. Then visit http://localhost:3000/admin and confirm it DOES redirect to /login.

**Expected:** All public /[locale] marketing pages load directly for an anonymous visitor (the storefront is intentionally public and protected only the /admin and /planning areas). Visiting /admin while logged out redirects to /login?next=/admin. This confirms the auth boundary is on the back office, not the marketing site, and that no public page leaks behind a login or exposes admin chrome.

#### `PUB-20` Cross-company isolation: public portfolio/packages only ever show the resolved tenant's content  
*Type: security · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/en/portfolio and note the images shown. 2. Go to http://localhost:3000/en/packages and note the packages/categories shown. 3. (Optional, needs a developer to seed a second company with its own portfolio + custom domain.) On the second company's domain, view /en/portfolio and /en/packages. 4. Compare the two tenants' galleries.

**Expected:** The portfolio gallery, homepage showcase strip, and packages list are filtered strictly by the resolved company's id (companyId scoping). One company's public site never displays another company's portfolio images or packages. On localhost only the first/fallback company's content appears; switching to a different tenant's domain shows only that tenant's content. No mixing or leakage of another company's media across the public storefront.

---

## 4. Enquiry form to Lead (multi-step contact form, reference image upload, validation, thank-you, lead in Back Office)

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the seeded database (one company: "Bloom & Co Events", quote prefix BLOOM-Q). Two seeded logins, both password ChangeMe123!: owner@platform.local (super-admin, sees all companies, must pick a company in the top switcher) and admin@bloomco.example (Bloom & Co company admin, auto-scoped to Bloom & Co). Use a normal desktop browser (Chrome/Safari). Use TWO browser windows where a test needs the public site and the Back Office (BO) at the same time, or use a private/incognito window for the public site so it is not logged in. Have 2-3 small image files ready (a .jpg or .png under 8 MB each), plus one non-image file (e.g. a .pdf or .txt) and ideally one very large image (over 8 MB) for the upload edge cases. NOTE on tenant routing: on localhost the public form does not match any company custom domain, so every enquiry submitted on localhost is filed under the first active company, which is Bloom & Co Events. This is why the company admin login can see the leads. Reference numbers look like BLOOMQ-EVT-2026-0001 (prefix derived from the company, then -EVT-, the year, then a 4-digit sequence).

#### `ENQ-01` Happy path: complete all 4 steps and submit a valid enquiry  
*Type: happy · Priority: P0*

**Steps:**
1. Open a private/incognito browser window (so you are NOT logged in). 2. Go to http://localhost:3000/en/contact . 3. Confirm the heading 'Plan your event' and a stepper showing 4 numbered steps: 1 Event, 2 Vision, 3 Details, 4 You. 4. On Step 1 (Event): leave Event type as 'Wedding', type a Venue (e.g. 'Grand Ballroom KLCC'), pick an Event date (a future date), pick a Time. Click 'Next'. 5. On Step 2 (Vision): type a Theme (e.g. 'Rustic garden, blush and gold'), choose Budget range 'RM30,000 - 50,000', enter Approx. guests '150', type a Purpose (e.g. 'Reception'). Click 'Next'. 6. On Step 3 (Details): skip the image upload for now, type a Special request (e.g. 'Need a stage backdrop'). Click 'Next'. 7. On Step 4 (You): type Your name 'Test Customer', Phone '+60 12-345 6789', Email 'test.customer@example.com', leave Preferred language as is. 8. Click 'Submit enquiry'.

**Expected:** The button briefly shows 'Submitting...' then the browser navigates to a thank-you page at /en/contact/thank-you?ref=... . The page shows a check mark, 'Thank you - we've received your enquiry', a body message, and a reference number box labelled 'Your reference number' containing a code like BLOOMQ-EVT-2026-0001. A 'Back to home' link is present. No error text appears.

#### `ENQ-02` Submitted enquiry appears as a NEW lead in the Back Office  
*Type: happy · Priority: P0*

**Steps:**
1. Complete ENQ-01 first and note the reference number shown on the thank-you page. 2. In a separate normal browser window go to http://localhost:3000/admin and log in as admin@bloomco.example / ChangeMe123! . 3. Navigate to http://localhost:3000/admin/leads . 4. Look at the top of the table (sorted newest first). 5. In the Search box type the reference number from step 1 (or the customer name 'Test Customer') and click 'Search'. 6. Click the reference number link to open the lead detail page.

**Expected:** The new lead is listed at the top with the correct Reference, Customer name 'Test Customer', Event 'wedding', the event Date you entered, and a Status badge 'NEW'. Searching by reference or name finds it. The detail page (/admin/leads/<id>) shows the reference as the title, the customer's name/email/phone line, fact tiles for Event, Date, Time, Venue, Guests (150), Budget (RM) showing 30000 - 50000, Purpose, plus the Theme and Special request text you entered.

#### `ENQ-03` Happy path with reference image upload, images visible on lead  
*Type: happy · Priority: P0*

**Steps:**
1. Open a private/incognito window and go to http://localhost:3000/en/contact . 2. Click straight to Step 1 then 'Next' twice to reach Step 3 (Details) - or click the '3 Details' stepper button directly. 3. On Step 3 click the Reference images file chooser and select 2 small valid images (.jpg or .png, each under 8 MB). Confirm the chooser shows '2 files selected' (or similar). 4. Click '4 You' in the stepper. 5. Fill Your name 'Photo Tester', Phone '0123334444', Email 'photo.tester@example.com'. 6. Click 'Submit enquiry'. 7. Note the reference on the thank-you page. 8. In a logged-in BO window (admin@bloomco.example) open /admin/leads, find this lead and open its detail page.

**Expected:** Submission succeeds and reaches the thank-you page with a reference number. On the lead detail page a 'Reference images' section appears showing the 2 uploaded photos as thumbnails. The images load (not broken). The lead status is 'NEW'.

#### `ENQ-04` Required contact fields block submission (browser validation)  
*Type: negative · Priority: P0*

**Steps:**
1. Open a private/incognito window and go to http://localhost:3000/en/contact . 2. Click the '4 You' stepper button to jump directly to the final step without filling anything. 3. Leave Your name, Phone and Email all blank. 4. Click 'Submit enquiry'.

**Expected:** The form does NOT submit. The browser's built-in validation focuses the first empty required field (Your name) and shows a 'Please fill out this field' style prompt. No navigation to the thank-you page occurs and no lead is created.

#### `ENQ-05` Invalid email format is rejected  
*Type: negative · Priority: P0*

**Steps:**
1. Open a private/incognito window and go to http://localhost:3000/en/contact . 2. Jump to Step 4 ('You'). 3. Type Your name 'Bad Email', Phone '0121112222', and Email 'notanemail' (no @ or domain). 4. Click 'Submit enquiry'.

**Expected:** Submission is blocked. The browser shows an email-format validation message on the Email field (e.g. "Please include an '@' in the email address"). If somehow bypassed, the server returns the inline red message 'Please complete the required fields.' and no lead is created. The thank-you page is never reached.

#### `ENQ-06` Minimal valid enquiry: only the 3 required fields filled  
*Type: edge · Priority: P1*

**Steps:**
1. Open a private/incognito window and go to http://localhost:3000/en/contact . 2. Do NOT touch Steps 1-3 (leave Event type at default Wedding, no date, no budget, no theme, no images). 3. Click the '4 You' stepper button. 4. Fill only Your name 'Minimal Lead', Phone '0129998888', Email 'minimal.lead@example.com'. 5. Click 'Submit enquiry'. 6. Log into BO as admin@bloomco.example and open /admin/leads, find this lead, open detail.

**Expected:** Submission succeeds and a reference number is shown. A NEW lead is created with the required contact info; optional fact tiles (Date, Venue, Guests, Purpose) show a dash '-' and Budget (RM) shows '? - ?'. This confirms only name/phone/email are mandatory and everything else is optional.

#### `ENQ-07` Phone too short is rejected by the server  
*Type: negative · Priority: P1*

**Steps:**
1. Open a private/incognito window and go to http://localhost:3000/en/contact . 2. Jump to Step 4 ('You'). 3. Fill Your name 'Short Phone', a valid Email 'short.phone@example.com', and Phone with just '12' (two characters). 4. Click 'Submit enquiry'.

**Expected:** The enquiry is not accepted. The phone must be at least 3 characters, so the server validation fails and an inline red message 'Please complete the required fields.' appears (the form stays on the contact page). No thank-you page and no lead created.

#### `ENQ-08` Stepper navigation: jump between steps and confirm entered data is retained  
*Type: edge · Priority: P1*

**Steps:**
1. Open a private/incognito window and go to http://localhost:3000/en/contact . 2. On Step 1 type Venue 'Test Venue A'. 3. Click '2 Vision' in the stepper, enter Approx. guests '80'. 4. Click '1 Event' in the stepper to go back. 5. Confirm Venue still shows 'Test Venue A'. 6. Click '2 Vision' again and confirm guests still shows '80'. 7. Use the 'Back' and 'Next' buttons at the bottom to move one step at a time and confirm the 'Back' button is disabled (greyed out) on Step 1, and that the bottom-right button shows 'Next' on steps 1-3 and 'Submit enquiry' only on Step 4.

**Expected:** All previously entered values are preserved when navigating between steps in any order. The 'Back' button is disabled on Step 1. The primary button reads 'Next' on Steps 1-3 and changes to 'Submit enquiry' on Step 4. No data is lost when jumping around via the numbered stepper.

#### `ENQ-09` Same email submitted twice reuses the customer but creates a second lead  
*Type: edge · Priority: P2*

**Steps:**
1. Open a private/incognito window and submit a full enquiry (as in ENQ-01) using Email 'repeat.customer@example.com' and name 'Repeat One'. Note the reference. 2. Submit a SECOND enquiry from a fresh contact form using the SAME Email 'repeat.customer@example.com' but a different event (e.g. Event type 'Birthday') and name 'Repeat Two'. Note the second reference. 3. Log into BO as admin@bloomco.example, go to /admin/leads, and search 'repeat.customer@example.com'.

**Expected:** Both submissions succeed and produce two distinct reference numbers and two separate lead rows (one wedding-type, one birthday-type), both status NEW, both tied to the same customer email. The two reference numbers are different (sequence increments). This confirms a returning customer does not overwrite or block a new enquiry.

#### `ENQ-10` Reference number is shown on thank-you and matches the lead in BO  
*Type: happy · Priority: P1*

**Steps:**
1. Submit any valid enquiry (private window) and on the thank-you page copy the exact reference number (e.g. BLOOMQ-EVT-2026-00NN). 2. In a BO window logged in as admin@bloomco.example go to /admin/leads and paste the reference into Search, click 'Search'.

**Expected:** Exactly one lead matches the searched reference and its Reference cell equals the value shown on the thank-you page. Opening it shows the same reference as the detail-page title. This confirms the customer-facing reference is the real lead identifier.

#### `ENQ-11` Upload rejects oversized image but the enquiry still succeeds  
*Type: edge · Priority: P1*

**Steps:**
1. Open a private/incognito window, go to http://localhost:3000/en/contact and reach Step 3 (Details). 2. In Reference images select ONE image file larger than 8 MB (plus optionally one small valid image). 3. Go to Step 4, fill Your name 'Big File', Phone '0127776666', Email 'big.file@example.com'. 4. Click 'Submit enquiry'. 5. In BO (admin@bloomco.example) open the resulting lead's detail page.

**Expected:** The enquiry still submits successfully and reaches the thank-you page with a reference (a single bad file must not fail the whole enquiry). On the lead detail page the over-8MB file is NOT shown as a reference image (silently skipped by the server); if you also added a small valid image, that one DOES appear. The lead is still created with status NEW.

#### `ENQ-12` Non-image file is not stored as a reference image  
*Type: edge · Priority: P2*

**Steps:**
1. The file chooser uses accept=image/* so most browsers hide non-images. If your browser lets you pick 'All files', select a .pdf or .txt file in Reference images on Step 3; otherwise note that only images are selectable and mark this case as 'cannot select non-image'. 2. If a non-image was selected, complete Step 4 with name 'Doc Upload', Phone '0125554444', Email 'doc.upload@example.com' and click 'Submit enquiry'. 3. Open the resulting lead in BO.

**Expected:** Either the file chooser only offers image files (so a non-image cannot be attached), OR if a non-image is forced through, the enquiry still succeeds but no 'Reference images' section appears for that file (server only stores jpeg/png/webp/gif). The lead is created regardless.

#### `ENQ-13` Invalid locale in the URL returns Not Found  
*Type: negative · Priority: P2*

**Steps:**
1. In any browser go to http://localhost:3000/fr/contact (French is not a supported locale). 2. Also try http://localhost:3000/xx/contact .

**Expected:** Both URLs return a 404 / 'This page could not be found' (Not Found) rather than rendering the form. Only /en/contact, /ms/contact and /zh/contact are valid enquiry form URLs.

#### `ENQ-14` Form works in all 3 supported languages and language carries into the lead  
*Type: edge · Priority: P2*

**Steps:**
1. Open http://localhost:3000/ms/contact in a private window. Confirm labels render in Bahasa Malaysia and the Preferred language dropdown defaults to 'Bahasa Malaysia'. 2. Submit a valid enquiry (name 'Ujian BM', Phone '0123210000', Email 'ujian.bm@example.com'). 3. Confirm the thank-you page text is in Malay. 4. Repeat with http://localhost:3000/zh/contact (Chinese), Preferred language defaults to '中文'. 5. In BO (admin@bloomco.example) open both leads' detail pages.

**Expected:** The contact form, buttons and thank-you page all display in the selected language. The Preferred language dropdown defaults to the page's locale (MS for /ms, ZH for /zh). Both enquiries create NEW leads visible in BO with the correct customer details. (The BO always shows lead facts in the staff's chosen back-office language.)

#### `ENQ-15` Security: company admin cannot open another company's lead  
*Type: security · Priority: P0*

**Steps:**
1. Log into BO as the super-admin owner@platform.local / ChangeMe123! . 2. Create a SECOND company via /admin/companies (e.g. name 'Rival Events') and set it active. 3. Using the company switcher, select 'Rival Events', go to /admin/leads, and (if none) note there are no leads for it; create a test lead for Rival by temporarily submitting an enquiry while... (simpler) instead, while still acting as super-admin under Rival Events, copy the URL /admin/leads/<id> of any Bloom & Co lead id you saw earlier (from ENQ-02). 4. Now log out and log in as admin@bloomco.example / ChangeMe123! . 5. In the address bar manually open /admin/leads/<id> where <id> is a lead that belongs to a DIFFERENT company than Bloom & Co (use a Rival Events lead id, or ask the super-admin to give you one).

**Expected:** When a Bloom & Co admin opens a lead id that belongs to another company, they are redirected back to /admin/leads and never see the other company's lead detail. The Bloom & Co admin's /admin/leads list only ever shows Bloom & Co leads (no Rival Events rows). This confirms cross-company data isolation for leads.

#### `ENQ-16` Security: customer 'add more photos' link requires the correct access code  
*Type: security · Priority: P1*

**Steps:**
1. Log into BO as admin@bloomco.example, open any NEW lead's detail page, and find the 'Request more photos' box. Note the link (/lead/<token>) and the 6-digit Access code. 2. Open the /lead/<token> URL in a private/incognito window (not logged in). 3. Confirm it shows the company name, the lead reference, and an upload form asking for an Access code and Photos. 4. First attempt: enter a WRONG 6-digit code and select a valid image, click 'Upload photos'. 5. Second attempt: enter the CORRECT access code from the BO and select 1-2 valid images, click 'Upload photos'. 6. Back in BO, refresh the lead detail page. 7. Also try opening /lead/garbagetoken123 (an invalid token).

**Expected:** Step 4 (wrong code) shows the red error 'Incorrect access code.' and nothing is uploaded. Step 5 (correct code) shows a green '✓ Thank you! N photo(s) received...' confirmation. Step 6: the newly uploaded photos appear in the lead's 'Reference images' section in BO. Step 7: an invalid /lead/<token> returns Not Found. This confirms the public upload link is gated by the PIN and tied to a real lead.

---

## 5. Quotations (create from lead, line items, costPrice/profit%/SST/deposit, totals, mark sent)

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the database seeded. Two logins (both password ChangeMe123!): owner@platform.local (super-admin, no home company) and admin@bloomco.example (company admin for "Bloom & Co Events"). Seeded company Bloom & Co Events is SST-registered at 8%, default profit 35%, default deposit 50%, quote number prefix "BLOOM-Q". One seeded lead exists: reference BLOOM-EVT-2026-0001, customer "Aisyah Rahman" (aisyah@example.com), a WEDDING with no reference photos attached. NOTE on super-admin: the super-admin has no fixed company, so it acts inside whatever company is picked in the company switcher (top of back office). Before creating quotations as the super-admin, pick "Bloom & Co Events" in the switcher. For cross-company security tests you need a SECOND company; if only Bloom & Co exists, those cases can be marked "blocked – need 2nd company" or a second company can be added first under /admin/companies. AI buttons ("Generate with AI", concept image generation) require an OpenAI API key configured on the company; if none is set, AI is expected to show an error and is out of scope for these manual line/total cases. Log in at http://localhost:3000/login. The back office is under /admin.

#### `QUOT-01` Create a quotation from an existing lead (happy path)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/leads and click the seeded lead BLOOM-EVT-2026-0001 (Aisyah Rahman) to open http://localhost:3000/admin/leads/{id}. 3. Note the lead status shown in the status dropdown at the top right. 4. Scroll to the 'Quotations' section near the bottom and click the green '+ Create quotation' button.

**Expected:** The browser navigates to a new quotation editor at /admin/quotations/{id}. The heading shows a quote number like 'BLOOM-Q-0000' (prefix BLOOM-Q, zero-padded). Subheading reads 'draft · SST-registered (8%)'. The line items table is empty showing 'No items yet'. Default profit % is 35, Deposit % is 50, and the 'Apply SST (8%)' checkbox is ticked (company is SST-registered). Event date and Venue are pre-filled from the lead (14/11/2026 wedding, Grand Ballroom KLCC). If you go back to the lead, its status has changed to 'reviewing'.

#### `QUOT-02` Quote numbers increment without duplicates across multiple creates  
*Type: edge · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open the seeded lead at /admin/leads/{id}. 2. Click '+ Create quotation' and note the quote number (e.g. BLOOM-Q-0000). 3. Use the browser Back button to return to the lead. 4. Click '+ Create quotation' again and note the new number.

**Expected:** Each create produces a different, sequentially increasing quote number (e.g. BLOOM-Q-0000 then BLOOM-Q-0001). No two quotations share the same number. The lead's 'Quotations' list now shows both quotations linked to it.

#### `QUOT-03` Add line items, set cost and profit %, verify live sell price and line total  
*Type: happy · Priority: P0*

**Steps:**
1. Open a draft quotation editor at /admin/quotations/{id}. 2. Click '+ Add line'. 3. In the new row type 'Floral arch' in Material/item, set Qty=2, Unit='set', Cost (RM)=100, Profit %=30. 4. Observe the 'Sell/unit' and 'Line total' cells for that row. 5. Click '+ Add line' again, set Qty=3, Cost=50, Profit %=0. 6. Click 'Save quotation'.

**Expected:** For row 1, Sell/unit shows RM 130.00 (100 + 30%) and Line total shows RM 260.00 (2 × 130). For row 2, Sell/unit shows RM 50.00 and Line total RM 150.00. The Totals panel Subtotal updates live to RM 410.00. After clicking Save, a green 'Saved.' message appears and the values persist after reloading the page.

#### `QUOT-04` Edit and remove existing line items  
*Type: happy · Priority: P0*

**Steps:**
1. Open a quotation that already has at least two lines (or add two via QUOT-03). 2. Change the Profit % of the first line from 30 to 50 and watch its Line total. 3. Click the '✕' (remove) button at the end of the second line's row. 4. Click 'Save quotation' and reload the page.

**Expected:** Editing profit % to 50 immediately recalculates that row's Sell/unit (RM 150.00 for cost 100) and Line total, and the Subtotal updates live. Clicking '✕' removes the second row from the table immediately. After Save and reload, only the first (edited) line remains with the updated profit/total.

#### `QUOT-05` Apply default profit % to all lines at once  
*Type: happy · Priority: P1*

**Steps:**
1. Open a draft quotation and add three lines with different Profit % values (e.g. 10, 20, 0). 2. Set the 'Default profit %' field (in the Settings panel) to 35. 3. Click the 'Apply 35% to all' button above the table. 4. Observe each line's Profit % cell and the totals.

**Expected:** Every line's Profit % is set to 35, and each Sell/unit and Line total recalculates accordingly. The Subtotal in the totals panel updates live to match. (Note: the button label reflects the current Default profit % value.)

#### `QUOT-06` Verify SST, discount, total and deposit math end-to-end  
*Type: happy · Priority: P0*

**Steps:**
1. Open a draft quotation for Bloom & Co (SST-registered). 2. Add line: Qty=2, Cost=100, Profit %=50 (sell 150 → line 300). 3. Add line: Qty=1, Cost=200, Profit %=0 (line 200). 4. Set Discount (RM)=0, Deposit %=50, ensure 'Apply SST (8%)' is ticked and 'Void 8% SST' is unticked. 5. Read the Totals panel. 6. Click 'Save quotation' and reload.

**Expected:** Subtotal = RM 500.00. SST (8%) = RM 40.00. Total = RM 540.00. Deposit (50%) = RM 270.00. Balance = RM 270.00. After Save and reload these totals persist. (Matches the known pricing formula: total = (subtotal − discount) + SST; deposit = total × deposit%.)

#### `QUOT-07` Discount cannot push totals below zero  
*Type: edge · Priority: P1*

**Steps:**
1. Open a draft quotation. 2. Add a single line: Qty=1, Cost=100, Profit %=0 (line total 100). 3. Set Discount (RM)=500 (greater than the subtotal). 4. Observe the Totals panel. 5. Save and reload.

**Expected:** Subtotal shows RM 100.00 but the after-discount amount is clamped at zero, so Total = RM 0.00, SST = RM 0.00, Deposit = RM 0.00, Balance = RM 0.00. The total never goes negative. Values persist after Save.

#### `QUOT-08` B2B SST exemption voids the SST charge and requires a customer SST number  
*Type: happy · Priority: P1*

**Steps:**
1. Open a draft quotation for Bloom & Co with at least one line totalling e.g. RM 500.00 and 'Apply SST (8%)' ticked. 2. Note the SST line in the totals (RM 40.00). 3. Tick the '🇲🇾 Void 8% SST — B2B same-category exemption' checkbox. 4. A 'Customer SST no. (required for exemption)' field appears; enter W10-1808-32000000. 5. Observe the totals. 6. Click 'Save quotation' and reload.

**Expected:** When B2B exempt is ticked, the totals SST row changes to 'SST: Exempt (B2B)' and the Total drops back to the pre-SST amount (RM 500.00 instead of RM 540.00). Deposit recalculates off the lower total. After Save and reload the exemption and the customer SST number are still applied. (The exemption is also remembered on the customer record for future documents.)

#### `QUOT-09` SST checkbox is disabled/ignored for a non-SST-registered company  
*Type: security · Priority: P1*

**Steps:**
1. This requires a company that is NOT SST-registered. If only Bloom & Co (SST-registered) exists, mark this case blocked or first create/edit a second company under /admin/companies with SST registration turned off, then create a quotation under it. 2. Open a draft quotation under the non-registered company. 3. Look at the 'Apply SST' row in the Settings panel. 4. Try to tick the SST checkbox. 5. Add a line and check the totals.

**Expected:** The 'Apply SST' label shows '— company not SST-registered' and the checkbox is greyed out / disabled and cannot be enabled. No SST line appears in the totals and Total equals the after-discount amount with zero tax, regardless of any attempt. (Server-side, SST is forced off when the company is not registered.)

#### `QUOT-10` Add a line from a package pulls in the package price as cost at 0% profit  
*Type: happy · Priority: P2*

**Steps:**
1. Ensure Bloom & Co has at least one active package (check /admin/packages; if none exists, create one with a price and a few '•'-separated inclusions). 2. Open a draft quotation. 3. Use the '+ Add from package…' dropdown above the table and select a package. 4. Inspect the newly added line and the totals. 5. Save.

**Expected:** A new line is added whose description is the package name followed by each inclusion as a bulleted line, Unit='set', Cost = the package price, and Profit % = 0 (so Sell/unit equals the package price exactly). The Subtotal increases by exactly the package price. If no packages exist, the dropdown is not shown at all.

#### `QUOT-11` Mark a draft quotation as sent generates a share link and access code  
*Type: happy · Priority: P0*

**Steps:**
1. Open a draft quotation that has at least one line and Save it. 2. Click the green 'Send proposal' button at the top right of the editor. 3. Wait for the page to reload. 4. Observe the new 'Customer proposal link' panel and the quotation status. 5. Open the linked lead at /admin/leads/{id} and check its status.

**Expected:** Status changes from 'draft' to 'sent'. A 'Customer proposal link' panel appears showing a /q/{token} URL plus a 6-digit 'Access code'. The send button label changes to 'Resend (new code)'. The linked lead's status changes to 'quoted'. (An email to the customer is also queued because the lead/customer has an email on file.)

#### `QUOT-12` Resending a sent quotation issues a fresh access code  
*Type: edge · Priority: P1*

**Steps:**
1. Open a quotation already in 'sent' status (e.g. from QUOT-11). 2. Record the current 6-digit access code shown in the 'Customer proposal link' panel. 3. Click 'Resend (new code)'. 4. After reload, compare the access code.

**Expected:** The quotation stays 'sent' and a NEW 6-digit access code is shown that differs from the previous one. The /q/{token} link stays the same. (Each send rotates the view PIN so old codes stop working.)

#### `QUOT-13` Send from the quotations list 'Send' shortcut  
*Type: happy · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/admin/quotations. 2. Find a row with status 'DRAFT'. 3. In the Actions column click the 'Send' button. 4. Observe the row after the page refreshes.

**Expected:** The row's status badge changes to SENT and the inline 'Send' button disappears (it only shows for DRAFT rows). 'Open' and 'PDF' actions remain. The total column is unchanged.

#### `QUOT-14` Preview / PDF view reflects saved lines, totals and event details  
*Type: happy · Priority: P1*

**Steps:**
1. Open a quotation with several lines, a discount, SST applied, deposit set, notes filled, and event date/venue/setup/start/dismantle times entered; Save it. 2. Click the 'Preview' button at the top of the editor (or 'PDF' on the list row) to open /admin/quotations/{id}/preview. 3. Compare the line items, subtotal, SST, total, deposit and balance against the editor. 4. Click 'Save as PDF'.

**Expected:** The preview renders a formatted QUOTATION document with the company header, quote number, customer name/phone, the EVENT DATE / SETUP / START / DISMANTLE / VENUE bill lines, the same line items (qty, unit, unit price, line total), and matching Subtotal / Discount / SST / Total / Deposit / Balance. Any uploaded design references appear under 'Design references'. 'Save as PDF' triggers the browser print dialog.

#### `QUOT-15` Negative/invalid line input is rejected or normalised on save  
*Type: negative · Priority: P1*

**Steps:**
1. Open a draft quotation. 2. Add a line and clear/blank out the Material/item description (leave it empty). 3. Try entering a negative Qty (e.g. -2) and a negative Cost (e.g. -50). 4. Click 'Save quotation'. 5. Observe the result message and reload the page.

**Expected:** Saving with a blank description fails validation: an error like 'Could not read the line items.' is shown and nothing is persisted (description is required, min length 1). Negative quantity/cost are not accepted by the pricing schema (quantity and costPrice are constrained to be ≥ 0); the line is rejected rather than saved with negative money. After reload the bad line is not present.

#### `QUOT-16` Company admin cannot open another company's quotation (cross-company access)  
*Type: security · Priority: P0*

**Steps:**
1. This requires a quotation belonging to a DIFFERENT company than Bloom & Co. If a second company and one of its quotations exist, copy that quotation's id. (If not, mark blocked — needs a 2nd company.) 2. Log in as admin@bloomco.example (Bloom company admin). 3. Manually navigate to http://localhost:3000/admin/quotations/{other-company-quotation-id}. 4. Also try the preview URL /admin/quotations/{other-company-quotation-id}/preview.

**Expected:** The Bloom admin is redirected away to /admin/quotations and cannot view or edit the other company's quotation (server enforces user.companyId must match the quotation's company). The same applies to the preview page. No line data, totals, or customer details of the other company are exposed.

#### `QUOT-17` Super-admin can access any company's quotation; company switcher scopes the list  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local (super-admin). 2. Go to /admin/quotations. If the list is empty, use the company switcher at the top to select 'Bloom & Co Events'. 3. Open any Bloom quotation directly via /admin/quotations/{id}. 4. (If a 2nd company exists) switch the active company in the switcher and confirm the list contents change.

**Expected:** The super-admin can open and edit quotations for any company (no redirect). The quotations list is scoped to the company currently selected in the switcher; with no company selected the list shows a 'select a company' notice instead of cross-company data. Switching company changes which quotations are listed.

#### `QUOT-18` Unauthenticated access to a quotation redirects to login  
*Type: security · Priority: P0*

**Steps:**
1. Log out of the back office (or open a private/incognito window). 2. Without logging in, navigate directly to http://localhost:3000/admin/quotations and to http://localhost:3000/admin/quotations/{any-id}.

**Expected:** Both requests redirect to /login. No quotation list, line items, totals, or customer data are shown to an unauthenticated visitor.

#### `QUOT-19` Filter and search the quotations list  
*Type: happy · Priority: P2*

**Steps:**
1. As admin@bloomco.example (or super-admin with Bloom selected), go to /admin/quotations. 2. Use the status filter to select 'DRAFT', then 'SENT'. 3. Type part of an existing quote number (e.g. 'BLOOM-Q') into the search box and apply. 4. Type part of a customer name (e.g. 'Aisyah') and apply. 5. Set a created-date range that excludes today.

**Expected:** The status filter narrows the table to only quotations with that status. Searching by number or by customer name returns matching rows (case-insensitive). A date range that excludes the creation date shows 'No quotations match.' Pagination appears only when more than 25 quotations match.

#### `QUOT-20` Create a manual quotation with no lead (manual-only mode)  
*Type: edge · Priority: P1*

**Steps:**
1. As admin@bloomco.example go to /admin/quotations. 2. Click '+ New quotation' at the top right (for a single-company admin no company picker is shown; the super-admin picks a company from the dropdown first). 3. On the new editor, look at the 'Step 2 — Smart quotation' panel. 4. Add a couple of manual lines and Save.

**Expected:** A new DRAFT quotation is created with a fresh BLOOM-Q number and opens in the editor with no linked lead. The Step 2 panel shows 'No linked lead — manual only.' (the AI Generate button is hidden because there is no lead with reference images). Manual lines can still be added, priced, saved, and the quotation can be sent normally.

---

## 6. Quotations — AI Generation (Generate with AI, OpenAI key tester, draft to editable lines)

*Area: both*

**Prerequisites:** App running at http://localhost:3000. Two seeded logins (both password ChangeMe123!): owner@platform.local (super-admin, sees all companies) and admin@bloomco.example (company admin, scoped to BloomCo). The "Generate with AI" button only appears on a quotation that was created FROM A LEAD (a manually created quotation shows "No linked lead — manual only" and has no AI button), so several cases need a lead-linked quotation.

To create a lead-linked quotation: log into /admin, open Leads (left nav, /admin/leads), open a lead that has details and ideally one or more reference photos, then click "+ Create quotation". You land on /admin/quotations/{id}, the quotation editor, where Step 2 "Smart quotation" shows the "✨ Generate with AI" button.

A live OpenAI API key is needed for the happy-path generation and a genuine "success" from the key tester. The key is configured per company at /admin/companies/{id} under the "AI (smart quoting)" section (field "OpenAI API key", plus "AI model" default gpt-4o). If no per-company key is saved, the app may fall back to a server OPENAI_API_KEY env var if one is set. For the negative "no key" case you need a company that has NO saved key AND no env fallback — ask whoever set up the server to confirm, or use a company you know has never had a key saved. Real OpenAI calls cost money and take 10-60s; budget for that. If you do not have a real key, you can still run all the no-key / validation / permission cases, which do not call OpenAI.

Note where things live: AI generation = Step 2 of the quotation editor at /admin/quotations/{id}. Key tester = "Test OpenAI connection" box at the bottom of /admin/companies/{id}. Company AI key + model fields = same company edit page, "AI (smart quoting)" section.

#### `QAI-01` Generate with AI button appears only on a lead-linked quotation  
*Type: happy · Priority: P0*

**Steps:**
1. Log in at http://localhost:3000/login as owner@platform.local / ChangeMe123!.
2. Go to /admin/leads and open any lead, then click '+ Create quotation'. You are now on /admin/quotations/{id}.
3. Scroll to the 'Step 2 — Smart quotation' card.
4. Observe the controls in that card.
5. In a separate step, go to /admin/quotations, click '+ New quotation' (pick a company if prompted) to create a MANUAL quotation, and scroll to its Step 2 card.

**Expected:** On the lead-linked quotation: Step 2 shows a purple '✨ Generate with AI' button and an 'Edit prompt / instructions' link. On the manually created quotation: NO AI button is shown — instead the text 'No linked lead — manual only.' appears. The editable line-items table is present on both.

#### `QAI-02` Happy path — generate a draft and see it become editable line items  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123! (or admin@bloomco.example for a BloomCo lead). Use a company that has a working OpenAI API key saved (set it at /admin/companies/{id} 'AI (smart quoting)' if needed).
2. Open a lead WITH reference photos and event details, click '+ Create quotation'.
3. On /admin/quotations/{id}, in Step 2 click the '✨ Generate with AI' button.
4. Wait — the button label changes to 'Analysing images & drafting…' and is disabled while it works (can take 10-60s).
5. When it finishes, read the green confirmation and scroll through the page.

**Expected:** While running the button shows 'Analysing images & drafting…' and cannot be clicked again. On success: a green message 'Draft applied — edit below.' appears next to the button; an 'AI plan' panel appears with a written concept and a 'Questions to confirm' bullet list; and the line-items table below is populated with AI-suggested materials (description, qty, unit, cost RM, profit %, sell/unit, line total) instead of the empty 'No items yet' row. Subtotal/Total update accordingly.

#### `QAI-03` Generated lines are fully editable and persist on Save  
*Type: happy · Priority: P0*

**Steps:**
1. Continue from a quotation that already has AI-generated lines (run QAI-02 first, or open a lead-linked quotation and generate).
2. In the line table, change a line's Qty, edit its Cost (RM), and change its Profit %.
3. Edit the text of a line description, then delete a line with the '✕' button and add a fresh blank line with '+ Add line'.
4. Click 'Save quotation' at the bottom.
5. After the page reloads, reopen the same quotation via /admin/quotations and verify the values.

**Expected:** Sell/unit and Line total recompute live as you type. After clicking Save, a green 'Saved.' confirmation shows. On reload the edited quantities, costs, profit %, edited descriptions, the deletion and the added line all persist — confirming AI output is just a starting draft that is fully editable, not locked.

#### `QAI-04` Regenerate replaces existing lines (does not append)  
*Type: edge · Priority: P1*

**Steps:**
1. Open a lead-linked quotation that already has line items (AI-generated or manually added and saved).
2. Note how many lines are currently in the table.
3. In Step 2 click '✨ Generate with AI' again and wait for it to finish.
4. Count the lines after generation.

**Expected:** The previous line items are CLEARED and replaced by a brand-new AI draft (lines are not duplicated or appended on top of the old ones). The green 'Draft applied — edit below.' shows and the AI plan panel updates to the newest plan. Warn the owner: regenerating discards any manual edits to the lines that were not the point of regenerating.

#### `QAI-05` Optional instructions prompt steers the draft  
*Type: happy · Priority: P1*

**Steps:**
1. Open a lead-linked quotation on /admin/quotations/{id}.
2. In Step 2 click the 'Edit prompt / instructions' link — a text box opens.
3. Type a specific steer, e.g. 'Luxury blush & gold garden theme, emphasise floral arch and fairy lights, keep within RM30k.'
4. Click '✨ Generate with AI' and wait.
5. Read the resulting AI plan and line items.
6. Click 'Edit prompt / instructions' again (now labelled 'Hide prompt') to collapse it.

**Expected:** The textbox appears/collapses when toggling the link (label flips between 'Edit prompt / instructions' and 'Hide prompt'). The generated plan and materials reflect the typed steer (e.g. blush/gold, floral arch). Generating with the box collapsed/empty still works (auto-generates from the enquiry + images).

#### `QAI-06` Customer-requested-changes feedback pre-fills the AI prompt automatically  
*Type: edge · Priority: P1*

**Steps:**
1. Use a quotation that has been SENT and where the customer requested changes (the quotations list shows a 'changes' badge; the editor shows an amber 'Customer requested changes' box). If none exists, this can be set up by sending a proposal then submitting a change request from the customer /q/{token} view.
2. Open that quotation at /admin/quotations/{id}.
3. Observe the amber feedback box and the Step 2 prompt area.

**Expected:** The amber box shows the customer's feedback text and revision number, plus guidance 'Their feedback is pre-filled in the AI prompt below — click Generate to redesign, then Resend.' In Step 2 the instructions textbox is ALREADY OPEN and pre-filled with the customer's feedback, so clicking '✨ Generate with AI' redesigns against that feedback without retyping.

#### `QAI-07` Negative — no OpenAI key configured shows a clear error (no crash)  
*Type: negative · Priority: P0*

**Steps:**
1. Identify or create a company with NO saved OpenAI key and confirm the server has no OPENAI_API_KEY fallback (otherwise generation would succeed). At /admin/companies/{id} the AI key field placeholder should read 'sk-…' (not '•••••••• (saved …)').
2. Open a lead under that company and click '+ Create quotation'.
3. On /admin/quotations/{id}, in Step 2 click '✨ Generate with AI'.

**Expected:** No line items are generated. A red error message appears next to the button reading 'No OpenAI API key configured for this company.' The page does not crash, no AI plan appears, and the line table stays empty / unchanged.

#### `QAI-08` Negative — invalid/rejected OpenAI key surfaces the provider error gracefully  
*Type: negative · Priority: P1*

**Steps:**
1. As owner@platform.local or the relevant company admin, go to /admin/companies/{id}, AI (smart quoting) section, and save a clearly INVALID key such as 'sk-invalid-000' (type it in the 'OpenAI API key' field, Save changes).
2. Open a lead under that company and click '+ Create quotation'.
3. In Step 2 click '✨ Generate with AI' and wait.

**Expected:** No draft is applied. A red error appears next to the button containing the rejection reason from OpenAI (e.g. text including 'OpenAI error 401' / 'Incorrect API key'). The app handles it gracefully — no white-screen, line table unchanged. (Remember to restore the real key afterwards.)

#### `QAI-09` Edge — lead with no reference images still generates from text details  
*Type: edge · Priority: P1*

**Steps:**
1. Open a lead that has event details (type, theme, budget, notes) but NO reference photos uploaded. Click '+ Create quotation'.
2. On /admin/quotations/{id}, in Step 2 click '✨ Generate with AI' and wait.

**Expected:** Generation still succeeds using just the text enquiry — the AI plan and material lines appear and 'Draft applied — edit below.' shows. The feature does not require images to produce a quotation draft (images only enrich it).

#### `QAI-10` Key tester — happy path reports key validity and model/image capability  
*Type: happy · Priority: P1*

**Steps:**
1. Log in as owner@platform.local (or the company admin for that company).
2. Go to /admin/companies/{id} for a company with a valid saved key.
3. Scroll to the 'Test OpenAI connection' box at the bottom.
4. Leave the field blank to test the saved key (placeholder shows '•••••••• (testing saved key — or paste a new one)'), then click 'Test connection'. Wait.

**Expected:** Button shows 'Testing…' while working. On success a green box appears starting with '✓ API key works.' and then states whether the quoting model (e.g. 'Quoting model "gpt-4o" available.') and the photo generator are available ('Photo generator (gpt-image-1) available.' or a warning that gpt-image-1 needs organisation verification). It does not save or change anything — it is a read-only check.

#### `QAI-11` Key tester — invalid pasted key is rejected with a clear message  
*Type: negative · Priority: P1*

**Steps:**
1. Go to /admin/companies/{id} → 'Test OpenAI connection'.
2. In the key field type an invalid key such as 'sk-not-a-real-key'.
3. Click 'Test connection' and wait.

**Expected:** A red box appears with the rejection reason from OpenAI (e.g. 'OpenAI rejected the key (HTTP 401)' or 'Incorrect API key provided…'). The invalid pasted key is only used for the test and is NOT saved as the company key.

#### `QAI-12` Key tester — empty with no saved key prompts to enter one  
*Type: negative · Priority: P2*

**Steps:**
1. Go to /admin/companies/{id} for a company that has NO saved key (placeholder 'sk-…' in the tester).
2. Leave the tester field blank and click 'Test connection'.

**Expected:** A red message appears: 'Enter an API key first, or save one.' No network call to OpenAI is attempted; nothing is saved.

#### `QAI-13` Wrong model name in company settings is flagged by the key tester  
*Type: edge · Priority: P2*

**Steps:**
1. Go to /admin/companies/{id}, AI (smart quoting) section, change 'AI model' to a bogus value like 'gpt-9-does-not-exist', click 'Save changes'.
2. Scroll to 'Test OpenAI connection', ensure a valid key is in place, click 'Test connection' and wait.
3. Restore 'AI model' to gpt-4o afterwards.

**Expected:** The green/result message confirms '✓ API key works.' but warns 'Quoting model "gpt-9-does-not-exist" not found on this account — check the model name.' This warns the owner that AI generation would fail until the model name is corrected.

#### `QAI-14` Security — company admin cannot generate AI on another company's quotation  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, open a lead-linked quotation belonging to a company OTHER than BloomCo and copy its URL (/admin/quotations/{otherId}).
2. Log out, log in as admin@bloomco.example / ChangeMe123! (BloomCo company admin).
3. Paste and visit /admin/quotations/{otherId} directly.
4. If the editor loads, attempt to use Step 2 'Generate with AI'.

**Expected:** The BloomCo admin must not be able to act on another company's quotation. Either the page redirects away (back to /admin/quotations) so no AI button is reachable, or — if reached — clicking 'Generate with AI' returns a red 'Not found.' error and no draft is created. No cross-company data leaks.

#### `QAI-15` Security — company admin cannot test/read another company's OpenAI key  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, note the id of a company OTHER than BloomCo (from /admin/companies). Form the URL /admin/companies/{otherId}.
2. Log in as admin@bloomco.example / ChangeMe123!.
3. Visit /admin/companies/{otherId} directly.
4. If reachable, try the 'Test OpenAI connection' box.

**Expected:** BloomCo admin is denied access to another company's settings: the page redirects to /admin (no company edit form or key tester shown for that company). If the test action were somehow invoked for another company, it returns a red 'Not found.' The saved key value is never displayed as plaintext anywhere (field is masked '••••••••').

#### `QAI-16` Cannot double-submit while a generation is in flight  
*Type: edge · Priority: P2*

**Steps:**
1. Open a lead-linked quotation with a valid key configured.
2. Click '✨ Generate with AI' and immediately try to click it again several times while it shows 'Analysing images & drafting…'.

**Expected:** The button is disabled (greyed, ~60% opacity) while pending and additional clicks do nothing — only one generation runs. When it completes, the button re-enables and the single resulting draft is applied (no duplicate drafts / no doubled line sets).

---

## 7. Confirm payment to Booking + Invoice issuance (per-company numbering, SST snapshot, balance due, planning)

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the database seeded (super-admin owner@platform.local and company admin admin@bloomco.example, both password ChangeMe123!; demo company "Bloom & Co Events", SST-registered at 8%, invoice prefix BLOOM-INV). KEY FACT FROM THE CODE: there is NO admin-side button to record a payment. A confirmable (PENDING) payment can only be created through the public proposal flow. So before the confirm tests, you must set up a confirmable payment ONCE like this (call this the "Setup recipe"):
  S1. Log in at http://localhost:3000/login as admin@bloomco.example.
  S2. Go to http://localhost:3000/admin/quotations. Create a quotation for a customer (e.g. the seeded "Aisyah Rahman") with at least one line item, and SAVE it. Note its total. (If the quote editor offers an SST toggle, leave SST ON so the snapshot test has data.) Set its status to SENT/published so it gets a public link, and open the quotation's preview/public link (a /q/<token> URL). If there is a "view PIN"/access code, note it.
  S3. In a separate browser (or private window, logged out), open that /q/<token> link. If asked for an access code, enter the PIN. Click "Accept & Proceed to Payment" — this creates a Booking (status CONFIRMED, balance = full total, deposit = 0).
  S4. Still on the public page, under "Pay your deposit", enter a payment amount, choose a method (Bank transfer or DuitNow QR), optionally attach a proof image, and submit. This creates a PENDING payment on the booking.
  S5. Back in the admin, the booking now appears at http://localhost:3000/admin/bookings (status CONFIRMED) and its detail page shows a PENDING payment with a "Confirm payment" button.
Each test below states whether it needs a fresh Setup recipe run. Have at least two such bookings prepared if you want to run several confirm tests. NOTE: confirming is irreversible in the UI (no un-confirm button), so prepare one bookable payment per destructive test.

#### `PAYINV-01` Pending payment shows on booking with an actionable Confirm button and amber guidance  
*Type: happy · Priority: P0*

**Steps:**
1. Run the Setup recipe so a booking has a PENDING payment. 2. Log in as admin@bloomco.example at http://localhost:3000/login. 3. Go to http://localhost:3000/admin/bookings and click the booking title to open http://localhost:3000/admin/bookings/<id>. 4. Read the colored guidance box near the top and the 'Payments' section.

**Expected:** An amber guidance box appears titled '💳 A payment is waiting for you' explaining to check the proof then click Confirm payment. Under 'Payments' the pending payment row shows the amount, type (deposit), method, status 'pending', and a 'Confirm payment' button. If a proof was attached, a 'view proof' link is present. Top stats show Total = quote total, Deposit paid = RM 0.00, Balance due = full total. The stage tracker highlights the early steps. Under 'Invoices' it reads 'No invoice yet — confirm a payment to issue one.'

#### `PAYINV-02` Confirm a partial deposit issues a DEPOSIT/PARTIAL invoice and moves booking into planning  
*Type: happy · Priority: P0*

**Steps:**
1. Use a booking from the Setup recipe where the PENDING payment amount is LESS than the booking total (e.g. a 50% deposit). 2. Open http://localhost:3000/admin/bookings/<id> as admin@bloomco.example. 3. Note the Total and the pending payment amount. 4. Click 'Confirm payment'. 5. After the page reloads, read the stats, the payment row, the guidance box, and the 'Invoices' section. 6. Click the new invoice link to open http://localhost:3000/admin/invoices/<invId>.

**Expected:** Page reloads on the same booking. Payment row status now reads 'confirmed' and the Confirm button is gone. Stats update: Deposit paid = the payment amount, Balance due = Total minus deposit (greater than 0). Booking status badge changes to IN_PLANNING and the guidance box turns blue '✅ Deposit received — in planning' telling you to collect the remaining balance. Under 'Invoices' a new invoice appears with number BLOOM-INV-0001 (or next sequence), labeled 'deposit · partial · RM <total>'. Opening it shows an INVOICE document with the line items, a 'Less: Paid' row equal to the deposit and a 'Balance Due' row equal to the remaining balance.

#### `PAYINV-03` Confirm a full payment issues a FULL/PAID invoice with zero balance and fully-paid guidance  
*Type: happy · Priority: P0*

**Steps:**
1. Run the Setup recipe but in step S4 enter a payment amount EQUAL TO (or greater than) the full booking total. 2. Open http://localhost:3000/admin/bookings/<id> as admin@bloomco.example. 3. Click 'Confirm payment'. 4. Read the stats, guidance box, and Invoices section. 5. Open the issued invoice.

**Expected:** Deposit paid = full total, Balance due = RM 0.00. Guidance box turns green '🎉 Fully paid'. The new invoice in the list is labeled 'full · paid · RM <total>'. Opening the invoice shows status reflecting full payment; balance due on the document is RM 0.00 (the 'Less: Paid' / 'Balance Due' rows show the full amount paid and zero balance). Booking status is IN_PLANNING.

#### `PAYINV-04` Confirming seeds planning checklist tasks and the event appears on the Planning board  
*Type: happy · Priority: P0*

**Steps:**
1. Use a booking whose quotation/lead event type is WEDDING (the seeded lead is a wedding) and that has a PENDING payment. 2. Open http://localhost:3000/admin/bookings/<id> and click 'Confirm payment'. 3. At the bottom of the booking page read the 'Planning tasks:' count and click 'open planning →'. 4. On http://localhost:3000/planning confirm the event is listed. 5. Click into http://localhost:3000/planning/<id>.

**Expected:** After confirming, the booking page footer shows 'Planning tasks: 8' (the 8 seeded wedding checklist items; corporate=6, birthday=5). The Planning board at /planning lists this event (it only lists non-completed bookings) with a task progress bar like 0/8. Opening the planning detail shows the seeded checklist items (Confirm theme & colour palette, Finalise stage & backdrop design, etc.).

#### `PAYINV-05` Per-company invoice numbering increments sequentially with the company prefix  
*Type: happy · Priority: P1*

**Steps:**
1. Prepare two separate bookings of Bloom & Co, each with its own PENDING payment (run the Setup recipe twice). 2. As admin@bloomco.example confirm the payment on the first booking and note the issued invoice number. 3. Confirm the payment on the second booking and note its invoice number. 4. Go to http://localhost:3000/admin/invoices and review the 'Number' column.

**Expected:** Both numbers use the Bloom prefix 'BLOOM-INV-' followed by a 4-digit zero-padded sequence (e.g. BLOOM-INV-0001 then BLOOM-INV-0002). The second number is exactly one higher than the first. No two invoices share a number. The invoices list shows both rows for the Bloom company.

#### `PAYINV-06` SST snapshot is frozen onto the invoice from the quotation at issue time  
*Type: happy · Priority: P1*

**Steps:**
1. In the Setup recipe, build the quotation with SST ON (Bloom is SST-registered at 8%). 2. After accepting and submitting a payment, confirm it as admin@bloomco.example on http://localhost:3000/admin/bookings/<id>. 3. Open the issued invoice at http://localhost:3000/admin/invoices/<invId> and inspect the totals block. 4. (Optional) Go back to http://localhost:3000/admin and change the company SST rate in company settings, then re-open the same invoice.

**Expected:** The invoice document shows the subtotal, an SST line at the rate captured from the quote (e.g. SST 8%) with the SST amount, and the total — matching the quotation's SST figures. The invoice's SST values are a frozen snapshot: changing the company's SST rate AFTER the invoice was issued does NOT change this already-issued invoice's SST line.

#### `PAYINV-07` Customer details are snapshotted onto the invoice  
*Type: happy · Priority: P2*

**Steps:**
1. Run the Setup recipe using the seeded customer 'Aisyah Rahman' (or any customer with name/email/phone). 2. Confirm the payment as admin@bloomco.example. 3. Open the issued invoice at http://localhost:3000/admin/invoices/<invId>. 4. Check the invoices list at http://localhost:3000/admin/invoices, 'Customer' column.

**Expected:** The invoice document shows the customer name (and phone where rendered) captured at issue time. The invoices list 'Customer' column shows the customer's name (not a dash). The snapshot is independent of later customer-record edits.

#### `PAYINV-08` Confirming an already-confirmed payment does not issue a second invoice (idempotency)  
*Type: edge · Priority: P0*

**Steps:**
1. Confirm a payment per PAYINV-02 so one invoice exists. 2. Open the same booking detail page http://localhost:3000/admin/bookings/<id> again. 3. Confirm the payment row no longer shows a 'Confirm payment' button (status 'confirmed'). 4. To force the case, paste the confirm URL is not exposed; instead refresh and re-open the page several times, then count invoices under 'Invoices' and on http://localhost:3000/admin/invoices.

**Expected:** There is no Confirm button on an already-confirmed payment, so it cannot be confirmed twice from the UI. The booking shows exactly ONE invoice; the invoices list shows exactly one invoice for this booking. The invoice sequence number was consumed only once (no skipped/duplicated numbers from re-visiting).

#### `PAYINV-09` Second payment on an already-in-planning booking reduces balance and issues another invoice  
*Type: edge · Priority: P1*

**Steps:**
1. Start from a booking confirmed with a partial deposit per PAYINV-02 (status IN_PLANNING, balance > 0). 2. Re-open the public /q/<token> page for that quote and submit a SECOND payment proof for the remaining balance (Setup recipe step S4 again). 3. As admin@bloomco.example open http://localhost:3000/admin/bookings/<id>, find the new PENDING payment, and click 'Confirm payment'. 4. Read the stats and Invoices section.

**Expected:** Deposit paid increases to the cumulative total of both confirmed payments; Balance due drops to RM 0.00 if the two payments cover the total. A SECOND invoice is issued with the next sequential number; because the running balance is now zero it is typed 'full · paid'. Both invoices are listed under the booking. Guidance box turns green 'Fully paid'.

#### `PAYINV-10` Confirming a payment with no underlying quotation still issues an invoice using booking total  
*Type: edge · Priority: P2*

**Steps:**
1. Create a booking that has a payment but NO linked quotation. (Manual bookings created via http://localhost:3000/planning/events/new have no quotation; if such a booking can receive a PENDING payment in your build, use it. If the only way to get a PENDING payment is the quote flow, mark this case N/A and note it.) 2. As admin@bloomco.example open the booking detail and click 'Confirm payment'. 3. Open the issued invoice.

**Expected:** An invoice is still issued with the next BLOOM-INV sequence number. With no quotation, the line items are empty and the invoice total falls back to the booking's total amount; subtotal/SST show as 0. Balance due reflects total minus the confirmed amount. (If your build cannot attach a payment to a quote-less booking, record this case as not reproducible.)

#### `PAYINV-11` Invalid / non-positive payment amount is rejected at submission (no PENDING payment created)  
*Type: negative · Priority: P1*

**Steps:**
1. Run the Setup recipe up to the public payment step (S4) on the /q/<token> page. 2. In the 'Pay your deposit' amount field, try to submit an empty amount, then 0, then a negative number such as -50, then non-numeric text. 3. Observe the form response each time. 4. As admin@bloomco.example open the corresponding booking at http://localhost:3000/admin/bookings/<id> and check the Payments section.

**Expected:** Each invalid submission is rejected with the message 'Enter a valid payment amount.' and NO payment is created. The booking's Payments section shows no PENDING payment from these attempts, so there is nothing to confirm and no invoice is issued.

#### `PAYINV-12` Payment proof submission is blocked before the quote is accepted  
*Type: negative · Priority: P2*

**Steps:**
1. In the Setup recipe, open a SENT (not yet accepted) quote's /q/<token> page. 2. Do NOT click 'Accept & Proceed to Payment'. 3. Observe whether a payment form is even shown; if you can reach a submit, attempt to submit a payment amount.

**Expected:** Before acceptance the 'Pay your deposit' section is not shown (it only appears once status is ACCEPTED). If a payment is somehow submitted without an accepted booking, the server rejects it with 'Please accept the quote first.' and no payment/booking-side change occurs.

#### `PAYINV-13` Cross-company user cannot confirm a payment or view another company's booking/invoice  
*Type: security · Priority: P0*

**Steps:**
1. As super-admin owner@platform.local create a SECOND company (http://localhost:3000/admin/companies/new) if one does not already exist, and prepare a booking + PENDING payment under Bloom & Co. 2. Log out and log in as admin@bloomco.example (Bloom company admin). 3. Confirm you CAN see Bloom's booking at http://localhost:3000/admin/bookings/<bloomId>. 4. Now manually navigate to a booking ID that belongs to the OTHER company (http://localhost:3000/admin/bookings/<otherId>) and to an invoice of the other company (http://localhost:3000/admin/invoices/<otherInvId>).

**Expected:** The Bloom admin is redirected to /admin/bookings (or /admin/invoices) for the other company's records and never sees them or any Confirm button. Even if a confirm action were triggered for a payment outside the user's company, the server action redirects to /admin/bookings without confirming, issuing an invoice, or changing balances. Company data stays isolated.

#### `PAYINV-14` Confirm payment requires authentication (logged-out users are sent to login)  
*Type: security · Priority: P0*

**Steps:**
1. Log out of the back office entirely. 2. In the address bar navigate directly to a booking detail URL such as http://localhost:3000/admin/bookings/<id>. 3. Also try http://localhost:3000/admin/invoices.

**Expected:** Both URLs redirect to http://localhost:3000/login. No booking, payment, or invoice data is shown to an unauthenticated visitor, and no Confirm action is reachable.

#### `PAYINV-15` Super-admin must select a company context; can confirm and the invoice uses that company's prefix  
*Type: security · Priority: P1*

**Steps:**
1. Log in as owner@platform.local (super-admin) at http://localhost:3000/login. 2. Go to http://localhost:3000/admin/bookings WITHOUT selecting a company in the switcher — observe the page. 3. Use the company switcher in the admin shell to select 'Bloom & Co Events'. 4. Open a Bloom booking with a PENDING payment and click 'Confirm payment'. 5. Open the issued invoice and the invoices list.

**Expected:** With no company selected, the bookings/invoices list shows the 'select a company' notice instead of records. After switching to Bloom, the booking and its pending payment are visible; super-admin can confirm it (allowed by the permission check). The issued invoice uses Bloom's BLOOM-INV prefix and the next sequence number, and appears in the Bloom invoices list. Confirming behaves identically to a company admin (planning seeded, balance/stats updated).

#### `PAYINV-16` Invoice issued event is logged for emailing the customer  
*Type: edge · Priority: P2*

**Steps:**
1. Confirm any payment per PAYINV-02 as admin@bloomco.example. 2. If the build exposes an email/notifications log in the admin (e.g. under company settings or a WhatsApp/email section), open it. Otherwise note that the email log is a backend record. 3. Look for an 'Invoice issued' / 'invoice_issued' entry addressed to the customer email.

**Expected:** Issuing the invoice queues one email-log entry with subject 'Invoice <number> from Bloom & Co Events' and template 'invoice_issued', addressed to the customer's email (falling back to the company email if the customer has none). This is best-effort: even if the email log fails, the invoice and booking updates still succeed. Confirm the invoice itself was issued regardless of email-log visibility.

---

## 8. Invoices (list, detail, edit, PDF/print document, void)

*Area: backend*

**Prerequisites:** App running at http://localhost:3000 with the database seeded. Two logins available (password ChangeMe123! for both): owner@platform.local (super-admin, can switch between all companies) and admin@bloomco.example (company admin, locked to "Bloom & Co Events"). The seeded company "Bloom & Co Events" is SST-registered at 8% with invoice prefix "BLOOM-INV". To exercise list/detail/edit you need at least one existing invoice — if the list is empty, create one first using TC-INV-02 (the "+ New invoice" button). For the cross-company security cases (TC-INV-13/14) you need a second company; sign in as owner@platform.local, create or pick a different company's invoice, copy its ID from the URL, then log out and continue as admin@bloomco.example. Use a desktop browser (Chrome/Edge/Safari) so the print-to-PDF dialog is available. IMPORTANT FINDING TO VERIFY: the system has NO "void invoice" button or action anywhere — the list has a "Void" status filter chip and the editor has a "Void 8% SST" checkbox (that toggle only removes SST, it does not void the invoice). The void-related cases below confirm this gap is intentional/known rather than a usable feature.

#### `TC-INV-01` Invoice list loads with table, summary cards, and filters (company admin)  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/admin and log in as admin@bloomco.example / ChangeMe123!.
2. In the left navigation, click Invoices (or go directly to http://localhost:3000/admin/invoices).
3. Observe the page heading, the two summary cards near the top, the filter row, and the table.
4. Note the table column headers from left to right.

**Expected:** Page titled 'Invoices' loads. Two summary cards show: 'Invoiced (all)' with an RM amount, and 'Outstanding balance' with an RM amount in red. A filter row offers status chips (ISSUED, PARTIAL, PAID, VOID), a search box placeholder 'Search invoice number…', and From/To date inputs. The table has columns: Number, Customer, Issued, Type, Status, Total (right), Balance (right), Actions. A green '+ New invoice' button sits top-right. Each existing invoice row shows its number as a clickable link plus 'View' and 'Edit' buttons. No error or blank screen.

#### `TC-INV-02` Create a new blank invoice via '+ New invoice'  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/invoices.
2. Click the green '+ New invoice' button (top-right).
3. Observe the page you land on and the URL.
4. Click '← Back to invoice' / navigate back to http://localhost:3000/admin/invoices and confirm the new invoice now appears in the list.

**Expected:** A new invoice is created with status ISSUED and the browser redirects to its edit page at a URL like /admin/invoices/<id>/edit. The 'Edit BLOOM-INV-XXXX' heading shows a new, sequential invoice number beginning with the company prefix 'BLOOM-INV-' and a 4-digit zero-padded number (e.g. BLOOM-INV-0007). Back on the list, the new invoice appears with empty/zero amounts and an ISSUED badge. Creating two in a row produces two consecutive numbers with no duplicate.

#### `TC-INV-03` Open an invoice detail document and verify rendered fields  
*Type: happy · Priority: P0*

**Steps:**
1. From http://localhost:3000/admin/invoices, click an invoice number link (or the 'View' button) for any invoice with line items.
2. Observe the rendered document at /admin/invoices/<id>.
3. Check the header (company legal name, registration / tax IDs, address), the meta box (No., Date, Payment Term, Due Date, Prepared by), Bill To block, the line-item table, and the Totals block.

**Expected:** An A4-style 'INVOICE' document renders. Header shows the company legal name 'Bloom & Co Events Sdn Bhd', Reg No, Sales/Service Tax ID, and address. The meta table shows the invoice No., issue Date (DD/MM/YYYY), Payment Term (defaults to NET30), a Due Date computed as issue date + term days, and Prepared by. Bill To shows the customer name (or — if blank) and any event lines (EVENT DATE / SETUP TIME / etc.) and phone. Line items list with Subtotal, Discount (if any), SST/Service Tax (if applied), Rounding (if non-zero), and Total. Top-right (screen only) shows 'Save as PDF' and 'Edit invoice' buttons.

#### `TC-INV-04` Edit invoice: add line items and save, totals recompute correctly  
*Type: happy · Priority: P0*

**Steps:**
1. Open an invoice and click 'Edit invoice' (or go to /admin/invoices/<id>/edit).
2. Click '+ Add line'. In the new row type Description 'Floral Arch', Qty 2, Unit 'pcs', Unit price (RM) 150.
3. Click '+ Add line' again and add Description 'Fairy Lights', Qty 10, Unit 'pcs', Unit price 12.50.
4. Watch the live Totals box on the right update as you type.
5. Click 'Save invoice'.
6. Observe the detail page you are redirected to.

**Expected:** As values are entered, each row's Amount column updates (e.g. 2 x 150 = RM 300.00) and the Totals box live-updates Subtotal = RM 425.00. After clicking Save, the button shows 'Saving…' then redirects to /admin/invoices/<id>. The detail document shows the two new line items and Subtotal 425.00, with Total rounded to the nearest 5 sen (Malaysia cash rounding). The list view now reflects the new Total for this invoice.

#### `TC-INV-05` Edit invoice: apply SST (8%) for the SST-registered company  
*Type: happy · Priority: P1*

**Steps:**
1. Open an invoice for Bloom & Co Events with at least one line item, click 'Edit invoice'.
2. Locate the 'Apply SST (8%)' checkbox near the line items and tick it.
3. Observe the Totals box: an 'SST (8%)' row should appear and the Total should increase.
4. Click 'Save invoice'.
5. On the detail page, confirm the Service Tax line and the new Total.

**Expected:** Because Bloom & Co Events is SST-registered, the 'Apply SST (8%)' checkbox is enabled. Ticking it adds an SST line equal to 8% of (subtotal − discount); the Total increases accordingly and is rounded to the nearest 5 sen. After saving, the detail document shows a 'Service Tax (8%)' row with the correct RM amount and the updated Total. The persisted invoice keeps sstApplied = true.

#### `TC-INV-06` Edit invoice: B2B SST exemption requires customer SST number and zeroes SST  
*Type: edge · Priority: P1*

**Steps:**
1. On an invoice for Bloom & Co Events, open the editor and tick 'Apply SST (8%)'.
2. Tick the amber '🇲🇾 Void 8% SST — B2B same-category exemption' checkbox.
3. A 'Customer SST no. (required for exemption)' field appears; leave it blank first and observe the Totals box.
4. Enter a sample SST number like W10-1808-32000000.
5. Click 'Save invoice' and check the detail page.

**Expected:** Ticking B2B exempt makes the Totals box SST row read 'Exempt (B2B)' and the SST amount drops to RM 0.00 (Total = subtotal − discount, rounded). The customer SST-number input is revealed. After saving, the detail document shows 'Service Tax: Exempt (B2B)' and no tax is added to the Total. Note for the owner: the SST number field is labelled 'required for exemption' but the system does NOT block saving when it is empty — flag this as a possible validation gap to confirm with the developer.

#### `TC-INV-07` Edit invoice: discount reduces subtotal and SST base; negative discount is clamped  
*Type: negative · Priority: P1*

**Steps:**
1. Open the editor for an invoice whose subtotal is, say, RM 425.00.
2. In the 'Discount (RM)' field enter 25.
3. Observe the Totals box (Discount row appears, Total drops by 25 before rounding).
4. Now change the Discount field to a negative value like -50 and observe.
5. Save and re-open the editor to confirm the persisted value.

**Expected:** A positive discount of 25 shows a 'Discount − RM 25.00' row and reduces the Total (and the SST base if SST is on). A negative discount is treated as 0 by the system (Math.max(0, ...)) — the Total does not increase. After saving, re-opening the editor shows discount stored as 0 for the negative case (no negative discount is persisted).

#### `TC-INV-08` Edit invoice: remove all line items leaves a zero-total invoice and flips status to PAID  
*Type: edge · Priority: P1*

**Steps:**
1. Open the editor for an invoice that currently has line items and a balance due (status ISSUED, amountPaid 0).
2. Click the ✕ button on each line until 'No items.' is shown.
3. Observe the Totals box (Subtotal RM 0.00, Total RM 0.00, Balance due RM 0.00).
4. Click 'Save invoice'.
5. Return to the list and check this invoice's Status badge.

**Expected:** All lines are removed, Totals show RM 0.00 across the board. On save it redirects to the detail page showing an empty line-item table and Total 0.00. Because balanceDue computes to <= 0, the status auto-changes to PAID — the list shows a PAID badge for this invoice. (Owner note: a zero-line invoice silently becoming 'PAID' is worth flagging; there is no warning before save.)

#### `TC-INV-09` Edit invoice: SST checkbox is disabled for a non-SST-registered company  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123!.
2. Using the company switcher, select a company that is NOT SST-registered (create one in /admin/companies with SST unchecked if none exists), then create/open one of its invoices and click Edit.
3. Look at the 'Apply SST' checkbox and try to tick it.

**Expected:** For a non-SST-registered company the 'Apply SST' checkbox is disabled (greyed) and shows the helper text '— company not SST-registered'. The B2B exemption block is not shown at all. Even if SST were force-submitted, the server recomputes SST = 0 for a non-registered company. Totals never include any tax.

#### `TC-INV-10` Filter and search the invoice list  
*Type: happy · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/admin/invoices.
2. Click the 'PAID' status chip and observe the table and the 'Invoiced (paid)' summary card.
3. Clear the status filter, then type a partial invoice number (e.g. 'BLOOM-INV-000') into the search box and submit.
4. Set a From date in the future (e.g. 2099-01-01) and apply.
5. Type a number that does not exist (e.g. 'ZZZ-9999') and submit.

**Expected:** Selecting PAID shows only PAID invoices and the first summary card label changes to 'Invoiced (paid)' with a recomputed total. Searching by partial number returns matching invoices (case-insensitive, matches the number field only). A future From date returns 'No invoices match.'. A non-existent number returns 'No invoices match.' with a clean empty-state row, no error. URL query params reflect the active filters so the view is shareable/refreshable.

#### `TC-INV-11` Save / print invoice to PDF  
*Type: happy · Priority: P1*

**Steps:**
1. Open any invoice detail page at /admin/invoices/<id>.
2. Click the green 'Save as PDF' button.
3. In the browser print dialog, set Destination to 'Save as PDF' and preview the output.
4. Confirm the on-screen navigation (← Invoices, Save as PDF, Edit invoice buttons) is hidden in the printed/preview output.

**Expected:** The browser's native print dialog opens. The print preview shows only the clean INVOICE document (header, meta, bill-to, line items, totals, remarks, payment details, 'Page 1 / 1' footer) with no admin chrome — the top button bar is hidden via print styles. Saving produces a readable single-page A4 PDF that matches the on-screen document.

#### `TC-INV-12` Pagination across many invoices  
*Type: edge · Priority: P2*

**Steps:**
1. Ensure the company has more than 25 invoices (create extras via '+ New invoice' if needed, or use owner login on a busier company).
2. Open http://localhost:3000/admin/invoices.
3. Scroll to the bottom and use the pagination control to go to page 2.
4. Apply a status filter, then page again.

**Expected:** The list shows at most 25 invoices per page (newest issued first). Pagination controls appear with a total count. Going to page 2 loads the next batch and the URL gains a page=2 param. Applying a filter and paging preserves the filter in the URL (status/q/from/to all carry across pages). No duplicate or missing rows between pages.

#### `TC-INV-13` Security: company admin cannot view another company's invoice detail  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local, switch to a company OTHER than Bloom & Co Events, open one of its invoices, and copy the invoice ID from the URL (/admin/invoices/<id>).
2. Log out and log back in as admin@bloomco.example / ChangeMe123!.
3. Manually type the foreign invoice URL http://localhost:3000/admin/invoices/<foreign-id> into the address bar.
4. Repeat with the edit URL http://localhost:3000/admin/invoices/<foreign-id>/edit.

**Expected:** Both the detail and edit pages reject cross-company access: the company admin is redirected back to /admin/invoices and never sees the other company's invoice content. No invoice data from the other company is rendered, even briefly. (Server checks user.companyId === invoice.companyId for non-super-admins.)

#### `TC-INV-14` Security: company admin cannot edit/save into another company's invoice  
*Type: security · Priority: P0*

**Steps:**
1. As admin@bloomco.example, with a foreign invoice ID obtained per TC-INV-13, attempt to submit an edit by navigating to /admin/invoices/<foreign-id>/edit (it should already redirect). 
2. As a deeper check (optional, with developer help) attempt to POST the updateInvoiceAction for the foreign ID.
3. Confirm the foreign invoice is unchanged afterwards (re-check it as owner@platform.local).

**Expected:** The edit page redirects to /admin/invoices for the foreign invoice. Even if the underlying server action is invoked directly with a foreign invoice ID, it returns 'Not found.' and makes no change. Re-checking as owner shows the foreign invoice's line items, totals, and status are untouched.

#### `TC-INV-15` Negative/invalid: non-existent and malformed invoice IDs  
*Type: negative · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/invoices/nonexistent-id-123.
2. Open http://localhost:3000/admin/invoices/nonexistent-id-123/edit.
3. Try a clearly malformed ID such as http://localhost:3000/admin/invoices/%20.

**Expected:** A non-existent invoice ID produces a 'Not Found' (404) page rather than a server crash or a redirect. The /edit variant of a non-existent ID also shows Not Found. Malformed IDs do not expose a stack trace or 500 error to the owner. No partial/blank document is rendered.

#### `TC-INV-16` Void status: confirm there is NO void-invoice action and the VOID filter is empty  
*Type: edge · Priority: P1*

**Steps:**
1. Open an invoice detail page /admin/invoices/<id> and scan all on-screen buttons (← Invoices, Save as PDF, Edit invoice).
2. Open the editor and scan for any 'Void invoice' / 'Cancel invoice' control.
3. Back on the list /admin/invoices, click the 'VOID' status filter chip.

**Expected:** There is NO button or action anywhere in the Invoices module to void/cancel an invoice — only 'Save as PDF' and 'Edit invoice' on detail, and the editor's '🇲🇾 Void 8% SST' checkbox which ONLY removes SST (it does not void the document). Clicking the 'VOID' status chip on the list returns 'No invoices match.' because the app never assigns VOID status. Owner note: this is a coverage gap to report — the VOID filter exists in the UI but is currently unreachable functionality.

#### `TC-INV-17` Super-admin requires an active company before invoice list shows data  
*Type: security · Priority: P1*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123!.
2. If a company is already active, use the company switcher to clear/none the active company (or use a fresh session).
3. Open http://localhost:3000/admin/invoices with no active company selected.
4. Then select Bloom & Co Events and reload.

**Expected:** With no active company selected, the super-admin sees a 'Select a company' notice instead of the invoice table and summary cards, and '+ New invoice' offers a company dropdown (since multiple companies exist). After selecting Bloom & Co Events, the full list, summary cards, and filters render scoped to that company only.

---

## 9. Bookings (list, detail, status transitions, suppliers)

*Area: both*

**Prerequisites:** Environment: the app is running at http://localhost:3000 and the database has been seeded (the standard demo data: one company "Bloom & Co Events", one customer "Aisyah Rahman", one supplier "Petal Florists", one venue, and NO bookings or payments yet).

Logins (password for both is ChangeMe123!):
- Super-admin (group owner): owner@platform.local — sees ALL companies and must pick one in the "Active company" switcher (top of the back office) before booking data appears.
- Company admin (Bloom & Co): admin@bloomco.example — always locked to Bloom & Co Events; no switcher choice needed.

How to log in: go to http://localhost:3000/login, enter the email and password, submit. The back office lives under /admin.

IMPORTANT starting reality you must know before testing:
1. The seed contains NO bookings. The very first thing to do (Case BK-01) is create a booking so later cases have something to open. A booking is created from the Planning area, not from a form on the Bookings page.
2. There is NO "change status" dropdown on the booking DETAIL page. A booking's status changes two ways only: (a) automatically when you Confirm a payment (it jumps to "in planning"), or (b) manually on the Planning board (/planning/{id}) under "Event details" using the Status dropdown. Cases are written accordingly.
3. Suppliers are NOT managed on the Bookings pages — they live on the Planning board for each event (/planning/{id}, "Suppliers" panel).
4. Cross-company security cases (BK-13, BK-14) require a SECOND company to exist. If only Bloom & Co exists, first create another company at /admin/companies/new (e.g. "Test Rival Sdn Bhd") and, ideally, create one booking inside it, so you have a foreign booking id to attempt to reach. Note its booking URL for the test.

Throughout, "the switcher" = the "Active company" dropdown at the top of the back office (only the super-admin sees a real choice).

#### `BK-01` Create the first booking (seeds an event so the list is not empty)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example.
2. In the left menu click Bookings (or go to http://localhost:3000/admin/bookings). Confirm the table shows 'No bookings match.' and both top cards read RM 0.00.
3. Click the '+ New booking' button (top right). You land on http://localhost:3000/planning/events/new ('New event').
4. In 'Event title' type: Aisyah Garden Wedding.
5. Leave 'Event type' as wedding.
6. In 'Date' pick a date about 3 months out (e.g. 2026-11-14).
7. In 'Budget / total (RM)' type 30000.
8. In 'Venue name' type: Grand Ballroom, KLCC.
9. Click 'Create event'.

**Expected:** The event is created and you are taken to its Planning board (URL /planning/<some-id>). The header shows the title, status reads 'in planning', the date you picked, and the Event value card shows RM 30000.00. A checklist is auto-populated (wedding tasks appear). Going back to /admin/bookings now shows this booking in the table with status 'in planning', Total RM 30,000.00 and Balance RM 30,000.00; the 'Booked value' card reads RM 30,000.00 and 'Outstanding balance' reads RM 30,000.00.

#### `BK-02` Bookings list shows correct columns, totals and links  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example.
2. Go to http://localhost:3000/admin/bookings.
3. Read the table header: Event, Customer, Event date, Status, Total, Balance, Actions.
4. For the Aisyah Garden Wedding row, confirm the date is shown as YYYY-MM-DD, Status is a coloured badge, and Total/Balance show 'RM 30,000.00' formatted with a comma thousands separator.
5. Click the event title link in the Event column.
6. Use the browser Back button, then click the 'View' button in the Actions column.
7. Use Back again, then click the 'Plan' button in the Actions column.

**Expected:** The two summary cards above the table show 'Booked value RM 30,000.00' (in dark text) and 'Outstanding balance RM 30,000.00' (in red). The title link and the 'View' button both open the booking detail page at /admin/bookings/<id>. The 'Plan' button opens the Planning board at /planning/<id>. Customer shows the linked customer name or an em-dash (—) if none.

#### `BK-03` Filter the list by status using the pills  
*Type: happy · Priority: P1*

**Steps:**
1. As admin@bloomco.example open http://localhost:3000/admin/bookings.
2. Note the status pills: All, confirmed, in planning, ready, executed, completed, closed, cancelled.
3. Click the 'in planning' pill.
4. Observe the URL and the table.
5. Click the 'completed' pill.
6. Click 'All' to clear.

**Expected:** Clicking 'in planning' adds ?status=IN_PLANNING&page=1 to the URL, highlights that pill, and the table shows only bookings whose status is in planning (the Aisyah booking appears). The two summary cards recompute to reflect only the filtered rows. Clicking 'completed' shows 'No bookings match.' (no completed bookings yet) and both cards read RM 0.00. Clicking 'All' removes the status filter and shows every booking again.

#### `BK-04` Search by event title and by customer name (case-insensitive)  
*Type: happy · Priority: P1*

**Steps:**
1. As admin@bloomco.example open http://localhost:3000/admin/bookings.
2. In the search box type: garden (lowercase) and click Search.
3. Note the result, then clear and type: GARDEN (uppercase) and click Search.
4. Clear the box, type a customer's name fragment if the booking has a linked customer (otherwise skip to step 5), click Search.
5. Clear the box, type: zzzznomatch and click Search.

**Expected:** Searching 'garden' and 'GARDEN' both return the 'Aisyah Garden Wedding' row (search is case-insensitive and matches the event title). Searching a customer-name fragment also returns matching bookings (search matches title OR customer name). Searching 'zzzznomatch' shows 'No bookings match.' and both summary cards read RM 0.00. The search term is preserved in the box and in the URL (?q=...).

#### `BK-05` Filter the list by event-date range  
*Type: edge · Priority: P2*

**Steps:**
1. As admin@bloomco.example open http://localhost:3000/admin/bookings.
2. In the 'From' date input pick a date the day AFTER your booking's event date (so the booking falls outside the range), leave 'To' blank, click Search.
3. Observe the table.
4. Now set 'From' to the first of the booking's month and 'To' to the last of that month, click Search.
5. Set 'From' = 2026-12-01 and 'To' = 2026-01-01 (To earlier than From) and click Search.

**Expected:** Step 2: a From date later than the event date excludes the booking, so 'No bookings match.' appears. Step 4: a range that contains the event date shows the booking. Step 5: an inverted range (To before From) returns no rows but does NOT crash — the page renders normally with 'No bookings match.'. The chosen dates persist in the inputs and the URL (?from=...&to=...).

#### `BK-06` Booking detail page renders all sections and the right guidance banner  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example open /admin/bookings and click the Aisyah Garden Wedding title.
2. On the detail page read: the back link '← Bookings', the title + status badge, the sub-line (customer · event type · date).
3. Read the coloured guidance banner near the top.
4. Read the 5-step stage tracker (Confirmed, Deposit paid, In planning, Fully paid, Event done).
5. Read the three stat cards: Total, Deposit paid, Balance due.
6. Read the Payments, Invoices and 'Planning tasks' sections.

**Expected:** Title and 'in planning' badge show. Because nothing is paid yet, the banner is the amber '⏳ Waiting for the deposit' message. The stage tracker highlights step 1 (Confirmed) only — no later steps lit (since deposit = 0). Stats show Total RM 30,000.00, Deposit paid RM 0.00, Balance due RM 30,000.00. Payments shows 'No payments recorded yet.' Invoices shows 'No invoice yet — confirm a payment to issue one.' The Planning tasks line shows a count (>0 from the seeded checklist) with an 'open planning →' link.

#### `BK-07` Confirm a deposit payment: status, invoice, deposit/balance all update  
*Type: happy · Priority: P0*

**Steps:**
PREP — create a pending payment. The UI has no 'add payment' button for the owner, so a pending payment normally arrives from a customer upload. If your seed/data has no PENDING payment on this booking, ask a developer to insert one (amount e.g. 10000) OR use any booking that already shows a payment with status 'pending'.
1. As admin@bloomco.example open the booking detail page for a booking that has a PENDING payment.
2. Confirm the amber banner now reads '💳 A payment is waiting for you'.
3. In the Payments row, optionally click 'view proof' to open the uploaded file in a new tab, then return.
4. Click the 'Confirm payment' button on that pending row.

**Expected:** After confirming: the payment row status changes from 'pending' to 'confirmed' and the 'Confirm payment' button disappears for that row. The booking status moves from confirmed/in planning to 'in planning' (if it was CONFIRMED). 'Deposit paid' increases by the payment amount and 'Balance due' decreases by the same amount. A new invoice appears in the Invoices section with a number like BLOOM-INV-0000; if a balance remains it is type 'deposit' / status 'partial', if fully covered it is 'full' / 'paid'. The guidance banner switches to the blue '✅ Deposit received — in planning' (or emerald '🎉 Fully paid' if balance hit 0) and the stage tracker advances.

#### `BK-08` Confirming an already-confirmed payment does not double-count (idempotency)  
*Type: edge · Priority: P1*

**Steps:**
1. Continue from BK-07 on the same booking (it now has one confirmed payment and an issued invoice). Note the current Deposit paid, Balance due, and the invoice number.
2. Refresh the page (the confirmed row should have NO 'Confirm payment' button).
3. Try to re-trigger a confirm: use the browser Back button to return to the state before confirming and click any 'Confirm payment' again if one is still visible; otherwise just reload twice.

**Expected:** There is no way to confirm the same payment twice from the UI (the button is gone once status is 'confirmed'). Even if the action is re-invoked, the deposit/balance figures do NOT change a second time and NO duplicate invoice is created — the system treats an already-confirmed payment as a no-op and simply returns to the booking detail page. Deposit paid, Balance due and the invoice count remain exactly as after BK-07.

#### `BK-09` Change booking status manually on the Planning board (in planning -> ready -> executed)  
*Type: happy · Priority: P1*

**Steps:**
1. As admin@bloomco.example open the Aisyah booking, then click 'Plan' (or 'open planning →') to reach /planning/<id>.
2. Scroll to the 'Event details' panel.
3. In the 'Status' dropdown choose 'ready'. Click 'Save details'.
4. Reopen /admin/bookings and confirm the status badge for this booking now reads 'ready'.
5. Return to the Planning board, set Status to 'executed', click 'Save details'.
6. Open the booking DETAIL page (/admin/bookings/<id>) and look at the stage tracker.

**Expected:** Saving 'ready' updates the booking; the list and detail badges both show 'ready' (blue). Saving 'executed' updates again. On the detail page, because status is now one of EXECUTED/COMPLETED/CLOSED, the stage tracker advances to step 5 ('Event done') lit. No errors appear, and the Save button shows 'Saving…' briefly while submitting.

#### `BK-10` Cancel a booking and verify it filters/displays as cancelled  
*Type: happy · Priority: P2*

**Steps:**
1. Create a throwaway booking via '+ New booking' (title: Cancel Test, budget 5000) so you do not disturb the main one.
2. Open its Planning board, in 'Event details' set Status to 'cancelled', click 'Save details'.
3. Open /admin/bookings.
4. Click the 'cancelled' status pill.
5. Click the 'in planning' pill.

**Expected:** The Cancel Test booking shows a red 'cancelled' badge in the list and on its detail page. Filtering by 'cancelled' shows it; filtering by 'in planning' hides it. The summary cards still include the cancelled booking's amounts only when the 'cancelled' filter (or All) is active. No part of the app blocks editing a cancelled booking (there is no hard lock), which is acceptable but worth noting.

#### `BK-11` Add and remove a supplier on the event Planning board (margin recalculates)  
*Type: happy · Priority: P1*

**Steps:**
1. As admin@bloomco.example open the Aisyah booking's Planning board (/planning/<id>).
2. Note the three budget cards: Event value, Supplier cost (RM 0.00 initially), Margin (= Event value).
3. In the 'Suppliers' panel form enter Supplier name: Petal Florists, Type: Florist, Cost (RM): 4000, Phone: +60 12-345 6789. Click 'Add supplier'.
4. Confirm the supplier appears in the list with its cost.
5. Re-read the budget cards.
6. Click the ✕ next to the supplier to remove it.

**Expected:** After adding, the supplier appears under Suppliers showing 'Petal Florists Florist' and 'RM 4000.00'. The 'Supplier cost' card becomes RM 4000.00 and the 'Margin' card drops to Event value minus 4000 (e.g. RM 26000.00). Removing the supplier (✕) deletes the row, Supplier cost returns to RM 0.00 and Margin returns to the full Event value. The supplier was created scoped to Bloom & Co and only linked to this event.

#### `BK-12` Add supplier with blank name / non-numeric cost (input validation)  
*Type: negative · Priority: P2*

**Steps:**
1. On the Aisyah Planning board, in the 'Suppliers' form leave 'Supplier name' EMPTY, type Cost 100, click 'Add supplier'.
2. Observe whether anything is added.
3. Now type a name 'Test Lighting', and in 'Cost (RM)' type letters 'abc' (note the field is a number input, so it may reject letters as you type). Click 'Add supplier'.
4. Observe the resulting supplier row's cost.

**Expected:** Step 1: with a blank name the form does nothing — no supplier row is added and no error crash (name is required server-side). Step 2/3: with a valid name but an unparseable cost, the supplier is still added but its cost shows RM 0.00 (a non-numeric/blank cost is treated as 0). The page never errors out; Supplier cost and Margin recalculate using 0 for that supplier.

#### `BK-13` SECURITY: company admin cannot open another company's booking detail  
*Type: security · Priority: P0*

**Steps:**
PREP — there must be a booking that belongs to a DIFFERENT company than Bloom & Co. If only Bloom & Co exists: log in as owner@platform.local, create a second company at /admin/companies/new (e.g. 'Test Rival Sdn Bhd'), select it in the switcher, create a booking inside it via '+ New booking', and COPY its URL (e.g. /admin/bookings/<rivalId>). Then log out.
1. Log in as admin@bloomco.example (Bloom & Co admin).
2. In the address bar paste the foreign booking's detail URL: http://localhost:3000/admin/bookings/<rivalId>.
3. Observe the result.
4. Repeat with the foreign Planning URL: http://localhost:3000/planning/<rivalId>.

**Expected:** Both attempts are blocked by tenant isolation: the booking detail page redirects the Bloom admin back to /admin/bookings, and the planning board redirects back to /planning — the foreign booking's data is NEVER shown. No customer names, amounts, payments or suppliers from the other company leak.

#### `BK-14` SECURITY: company admin cannot confirm a payment belonging to another company  
*Type: security · Priority: P0*

**Steps:**
PREP — a foreign company's booking that has a PENDING payment, plus that payment's id (ask a developer to provide a pending payment id on the rival company's booking).
1. Log in as admin@bloomco.example.
2. Because the Confirm button only renders on the owning company's detail page, attempt cross-tenant confirmation by reaching the foreign booking detail at /admin/bookings/<rivalId> (per BK-13 this should already redirect, so the button is never reachable).
3. As a deeper check, ask a developer to POST the confirmPaymentAction for the foreign payment id while logged in as the Bloom admin (server-action probe).

**Expected:** The Confirm payment button is never shown to a user outside the owning company (the detail page redirects first). Even when the server action is invoked directly with a foreign payment id, the action checks the user's company against the payment's company and redirects to /admin/bookings WITHOUT confirming: the foreign payment stays 'pending', no deposit/balance change, and no invoice is issued on the other company.

#### `BK-15` SECURITY/EDGE: open a non-existent or malformed booking id  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example.
2. In the address bar go to http://localhost:3000/admin/bookings/does-not-exist-123.
3. Observe the result.
4. Go to http://localhost:3000/admin/bookings/%20 (a space) and observe.
5. Go to http://localhost:3000/planning/does-not-exist-123 and observe.

**Expected:** A booking id that matches no record shows the standard 404 'Not found' page (the detail page calls notFound()). The malformed/space id also yields a 404 (or redirect) without a server crash or stack trace. The Planning board for a missing id likewise 404s. In no case is another booking's data shown.

#### `BK-16` Super-admin must pick a company before bookings appear; switching companies swaps the data  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local.
2. Without touching the switcher, go to http://localhost:3000/admin/bookings.
3. Observe the message shown instead of a table.
4. In the 'Active company' switcher at the top, select 'Bloom & Co Events'.
5. Observe the bookings list.
6. If a second company exists, switch the switcher to it and observe the list again.

**Expected:** Before a company is selected the page shows the notice 'Pick a company from the switcher above to view its data.' (no table, no totals). After selecting Bloom & Co, the Bloom bookings (e.g. Aisyah Garden Wedding) appear with correct totals. Switching to another company shows only THAT company's bookings (or 'No bookings match.' if it has none) — the two companies' data never mix, confirming the active-company cookie scopes the list.

#### `BK-17` Pagination across more than 25 bookings  
*Type: edge · Priority: P2*

**Steps:**
PREP — this only matters if a company has more than 25 bookings. If feasible, have ~26+ bookings (ask a developer to bulk-insert test bookings for Bloom & Co).
1. As admin@bloomco.example open http://localhost:3000/admin/bookings.
2. Scroll to the footer line showing the total count and 'Page 1 / N'.
3. Click 'Next'.
4. Click 'Prev'.
5. Apply a status filter, then page Next.

**Expected:** At most 25 booking rows render per page. The footer shows the correct total (e.g. '26 bookings') and 'Page 1 / 2'. 'Next' goes to page 2 (URL ?page=2) showing the remaining rows; 'Prev' returns to page 1. When a status/search/date filter is active, paging preserves that filter in the URL and only pages through matching rows. Bookings are ordered by event date ascending.

---

## 10. Planning dashboard (event detail, checklist, suppliers, run-sheet, budget, inventory allocation)

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with seed data loaded. Two login accounts (both password ChangeMe123!): owner@platform.local (super-admin, can see all companies) and admin@bloomco.example (company admin for the "BloomCo" company). Log in at http://localhost:3000/login.

Important navigation notes grounded in the code:
- The Planning dashboard lives at http://localhost:3000/planning (NOT under /admin). Reach it from the back-office left sidebar under the "Delivery" group -> "Planning".
- A "booking" and an "event" are the same record. The list at /planning shows only active events (it hides COMPLETED, CLOSED and CANCELLED). Each card links to the event detail page at /planning/<id>.
- Super-admin must pick a company from the top company switcher first; with no company selected, /planning and /planning/events/new show a "Select a company" notice instead of content.
- For cross-company permission tests you need at least two companies with events. The super-admin can create a second event under a different company by switching the company in the switcher. Note the event IDs (the long string in the URL /planning/<id>) of an event in Company A and one in Company B before starting the security cases.
- Add-item forms (task, run-sheet, supplier, crew, prep item) submit and reload the page; there is no separate "save" confirmation toast for these. The "Save details" button on the Event details form is the only one that shows a "Saving..." state.

#### `PLAN-01` Open the planning dashboard and an event detail page (happy path)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in at http://localhost:3000/login as admin@bloomco.example / ChangeMe123!.
2. In the left sidebar, under the 'Delivery' group, click 'Planning' (or go to http://localhost:3000/planning).
3. Confirm the page title reads 'Event Planning' and a list of event cards appears, each showing the event title, a status badge, the date (or 'date TBC'), location/customer, and a 'X/Y tasks done' progress bar.
4. Click any event card.

**Expected:** The event detail page opens at /planning/<id>. It shows the event title heading, a status/date/location line, three budget stat tiles (Event value, Supplier cost, Margin), a 'Materials to prepare' panel, and sections for Checklist, Run sheet, Suppliers, Setup & dismantle crew, Preparation / loading list, and Event details. No error is shown.

#### `PLAN-02` Add, complete (toggle), and delete a checklist task  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, open any event at /planning/<id>.
2. Find the 'Checklist' section. Note the counter next to it (e.g. '2/5').
3. In the row of inputs at the bottom of the checklist, type a task title (e.g. 'Confirm florist') in the 'New task' box and optionally a 'Category' (e.g. 'Decor'), then click 'Add'.
4. After the page reloads, locate the new task. Click the empty square checkbox to its left to mark it done.
5. Click the checkbox again to mark it back to not-done.
6. Click the '✕' on the right of the task row to delete it.

**Expected:** After step 3 the new task appears in the list and the counter denominator increases by 1. After step 4 the checkbox fills (accent color with a tick), the task text shows struck-through/greyed, and the 'done' numerator increases by 1. After step 5 it reverts to not-done. After step 6 the task disappears and the counter decreases by 1.

#### `PLAN-03` Add a checklist task with an empty title (negative / invalid input)  
*Type: negative · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open any event at /planning/<id>.
2. In the Checklist section, leave the 'New task' box empty (you may type only into the 'Category' box, e.g. 'Decor').
3. Click 'Add'.

**Expected:** No task is created. The page reloads (or stays) with no new row added and the checklist counter unchanged. No error message is shown - the empty submission is silently ignored. (Confirms blank tasks cannot pollute the list.)

#### `PLAN-04` Add a run-sheet entry with time/activity/owner and delete it  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open any event at /planning/<id>.
2. Find the 'Run sheet' section. If empty it reads 'No entries yet.'
3. In the bottom row of inputs, type a time (e.g. '14:30'), an Activity (e.g. 'Backdrop setup'), and an Owner (e.g. 'Ali'), then click 'Add'.
4. Repeat with a second entry using a different time (e.g. '09:00') and activity.
5. Click the '✕' on the right of one entry to delete it.

**Expected:** Each entry appears as a row showing the time on the left, the activity in the middle, and the owner on the right. Entries are listed in the order added. Deleting an entry removes only that row. Time and owner are optional (an entry with only an activity should also be accepted).

#### `PLAN-05` Add a run-sheet entry with no activity (negative / invalid input)  
*Type: negative · Priority: P2*

**Steps:**
1. Logged in as admin@bloomco.example, open any event at /planning/<id>.
2. In the Run sheet add row, type only a time (e.g. '10:00') and leave the Activity box empty.
3. Click 'Add'.

**Expected:** No run-sheet entry is created (Activity is required). The list is unchanged and no error message appears - the submission is silently ignored.

#### `PLAN-06` Print / save the run-sheet as PDF  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open an event that has at least one run-sheet entry and some crew assigned.
2. In the Run sheet section header, click '🖨 Print run sheet' (this navigates to /planning/<id>/runsheet).
3. Review the printable document: it should show a 'Run sheet' heading, the event title, date and venue, the company name (and logo if set), three time boxes (Setup / Start / Dismantle time), a Setup crew and Dismantle crew block, and a timeline table of Time / Activity / Owner.
4. Click 'Save as PDF' (top right).
5. Click '← Back to event'.

**Expected:** The run-sheet document renders all entered run-sheet rows in time/activity/owner columns, with setup vs dismantle crew split correctly. 'Save as PDF' opens the browser print dialog. 'Back to event' returns to /planning/<id>. Setup/Start/Dismantle times show the linked quotation's times, or '—' if none.

#### `PLAN-07` Add a supplier with a cost and verify budget Margin recalculates  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, open an event at /planning/<id>. Note the three budget tiles: Event value (RM), Supplier cost (RM), Margin (RM).
2. In the 'Suppliers' section add-form, type a Supplier name (e.g. 'Petals Co'), a Type (e.g. 'florist'), a Cost in RM (e.g. '500'), and a Phone, then click 'Add supplier'.
3. After reload, confirm the supplier appears in the list with its cost shown as 'RM 500.00'.
4. Add a second supplier with cost '300'.
5. Re-check the budget tiles at the top.

**Expected:** Each added supplier appears with name, type label, and cost. The 'Supplier cost' tile equals the sum of all supplier costs (RM 800.00). The 'Margin' tile equals Event value minus Supplier cost and updates automatically. The supplier cost total feeds the margin live on reload.

#### `PLAN-08` Margin goes negative when supplier cost exceeds event value (edge case)  
*Type: edge · Priority: P2*

**Steps:**
1. Logged in as admin@bloomco.example, open an event whose Event value is a known amount (e.g. RM 1000.00). If needed, set it via the Event details form (see PLAN-12).
2. In the Suppliers section, add a supplier with a Cost larger than the event value (e.g. '1500').
3. Observe the budget tiles.
4. Remove that supplier by clicking its '✕'.

**Expected:** Supplier cost shows RM 1500.00 and Margin shows a negative value (e.g. RM -500.00) - the app does not block a loss-making margin or clamp it to zero. After removing the supplier, Supplier cost returns to its prior value and Margin recovers.

#### `PLAN-09` Assign setup/dismantle crew by staff dropdown, by typed name, and with phase BOTH  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open an event at /planning/<id>. Find 'Setup & dismantle crew' with two columns (Setup, Dismantle).
2. In the add-crew form, choose a staff member from the '— staff member —' dropdown, set phase to 'Setup', then click 'Add crew'. Confirm they appear under the Setup column.
3. Add another person by leaving the dropdown blank and typing a name in '…or type a name' (e.g. 'Hassan'), set a Role (e.g. 'driver') and Phone, phase 'Dismantle'; click 'Add crew'. Confirm they appear under Dismantle.
4. Add a third person with phase 'Both'.
5. Use the '✕ Remove' next to one crew member to remove them.

**Expected:** Step 2 places the chosen staff member under Setup (name from the staff record). Step 3 places the typed name under Dismantle with the role and phone shown. Step 4: the 'Both' person appears in BOTH the Setup and Dismantle columns, tagged with a small 'both' label. Each column header count updates. Removing a member deletes them from the relevant column(s).

#### `PLAN-10` Add crew with neither a staff member nor a name (negative / invalid input)  
*Type: negative · Priority: P2*

**Steps:**
1. Logged in as admin@bloomco.example, open an event at /planning/<id>.
2. In the add-crew form leave the staff dropdown on '— staff member —' and leave the name box empty. Optionally fill only Role and Phone.
3. Click 'Add crew'.

**Expected:** No crew member is added (a staff selection OR a typed name is required). The Setup/Dismantle columns are unchanged and no error message appears - the empty submission is silently ignored.

#### `PLAN-11` Load the standard preparation template, tick items, add a custom item, and delete an item  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open an event that has NO prep items yet (the 'Preparation / loading list' shows a 'Load standard template' button on the right).
2. Click 'Load standard template'.
3. Confirm the Materials column fills with items (Water base, Pasir (sand), Papan (board), etc.) and the Operations column fills (Tool bag, Extension cables, lights, banners, etc.), each with quantities where defined.
4. Confirm the 'Load standard template' button is now GONE (because the list is no longer empty).
5. Tick a few checkboxes to mark items packed (text greys/strikes through).
6. In the Materials column add-row, type a label (e.g. 'Cable ties') and a Qty (e.g. 'x20'), click '+'.
7. Delete one item via its '✕'.

**Expected:** Template loads 10 Materials and 10 Operations with the correct labels/quantities. The 'Load standard template' button disappears after loading. Ticking toggles the done state visually. The custom item is added to the correct column. Deleting removes only that item. Clicking the template button is a no-op if items already exist (does not duplicate).

#### `PLAN-12` Edit event details (title, type, date, status, event value) and verify they persist  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, open an event at /planning/<id>. Scroll to the 'Event details' form.
2. Change the Event title, pick a different Event type, set a Date, change Status (e.g. to 'READY'), and set a Budget / total (RM) value (e.g. '1200').
3. Click 'Save details' and wait for the 'Saving...' state to finish.
4. After reload, confirm the heading title, the status/date line at the top, and the 'Event value' budget tile all reflect your changes.
5. Go back to /planning and confirm the card shows the new title, status badge, and date.

**Expected:** The form saves; the page reloads showing the updated title heading, the updated status (lowercased) and date in the sub-line, and the 'Event value' tile equal to the new total. The /planning list card reflects the same changes. Margin recomputes against the new event value.

#### `PLAN-13` Set status to COMPLETED/CLOSED/CANCELLED and confirm the event drops off the planning list  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open an event at /planning/<id> and note its title.
2. In the Event details form, change Status to 'completed' and click 'Save details'.
3. Navigate to http://localhost:3000/planning.
4. Look for the event in the list.
5. (Optional) Reopen the event directly via its URL /planning/<id> and set Status back to 'in planning', save, and confirm it reappears on the list.

**Expected:** After setting status to completed (or closed/cancelled), the event no longer appears in the /planning list because the list filters out COMPLETED, CLOSED and CANCELLED. The event is still reachable by direct URL. Reverting the status to an active value makes it reappear on the list.

#### `PLAN-14` Materials-to-prepare panel stays locked until the customer has paid  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open an event that HAS a linked quotation (the 'Materials to prepare' panel shows an 'Open quotation →' link and an item count) but for which NO deposit/payment has been recorded.
2. Read the 'Materials to prepare' panel.
3. Then open an event where a deposit has been paid or an invoice is PAID/PARTIAL (a green 'Paid' badge appears next to the section title).
4. Compare the two panels.

**Expected:** For the unpaid event, the panel shows an amber lock message: '🔒 The materials list unlocks once the customer has paid (deposit received).' and the materials table is hidden. For the paid event, a green 'Paid' badge shows and the materials table is visible with columns Material/item, Qty, Unit, Category populated from the quotation items. An event with no linked quotation instead shows 'No quotation is linked to this booking yet.'

#### `PLAN-15` Cross-company access to another company's event is blocked (security / permission)  
*Type: security · Priority: P0*

**Steps:**
1. Identify an event that belongs to a DIFFERENT company than BloomCo. Easiest way: log in as owner@platform.local (super-admin), switch the company switcher to a non-BloomCo company, open one of its events, and copy the event ID from the URL /planning/<otherCompanyEventId>.
2. Log out, then log in as admin@bloomco.example / ChangeMe123! (company admin for BloomCo only).
3. In the address bar go directly to http://localhost:3000/planning/<otherCompanyEventId>.
4. Observe what happens.
5. Also confirm that event is NOT listed on the BloomCo /planning list.

**Expected:** The BloomCo admin is redirected away to /planning (cannot view another company's event). The other company's event never appears in BloomCo's planning list. This confirms tenant isolation on the event detail page. Repeat the same with /planning/<otherCompanyEventId>/runsheet and confirm it also redirects to /planning.

#### `PLAN-16` Cross-company mutation (toggle/delete another company's task) is silently rejected  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, open a non-BloomCo event, add a task, and confirm it exists. Note that company's event.
2. Reproduce the cross-company scenario: while still on the BloomCo admin context (admin@bloomco.example), attempt to act on another company's records. Since the UI redirects away from foreign events (PLAN-15), the realistic check is server-side: have the tester confirm that even if a foreign event/task URL or action is reached, no change is persisted.
3. Practical version: as admin@bloomco.example, open a BloomCo event, add a task and toggle it (works). Then as owner@platform.local switch to the OTHER company and confirm BloomCo's task does NOT appear there and was not affected.
4. Confirm counts and done-states on each company's events are independent.

**Expected:** All planning mutations (task add/toggle/delete, run-sheet, supplier, crew, prep item, event update) only succeed when the acting user owns the company or is super-admin; foreign-company actions are no-ops that change nothing. Each company's checklist counts, suppliers, crew and prep lists remain isolated - no bleed-through between companies.

#### `PLAN-17` Super-admin must select a company before creating an event  
*Type: security · Priority: P1*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123!.
2. Make sure NO company is selected in the top company switcher (group view).
3. Go to http://localhost:3000/planning.
4. Then go to http://localhost:3000/planning/events/new.
5. Now use the company switcher to pick a company and revisit /planning/events/new.

**Expected:** With no company selected, both /planning and /planning/events/new show a 'Select a company' notice instead of the event list / new-event form. After choosing a company in the switcher, /planning/events/new shows the full New event form (title, type, date, saved venue dropdown, budget, venue search, status not shown on create). This prevents creating orphaned events with no company.

#### `PLAN-18` Create a new event with a typed venue and verify it seeds a checklist and a reusable location  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example (or super-admin with BloomCo selected), go to http://localhost:3000/planning/events/new.
2. Enter an Event title (e.g. 'Tan Wedding'), pick Event type 'wedding', set a Date, leave 'Saved venue' on the placeholder, type a Budget / total (e.g. '5000'), and type a Venue name (e.g. 'KSL Hotel JB') in the 'Venue name' box (you can also use the 'Search a new venue' autocomplete and pick a suggestion to attach a map).
3. Click 'Create event'.
4. On the resulting event detail page, check the Checklist section.
5. Go to http://localhost:3000/planning/locations and look for the typed venue.

**Expected:** Creating the event redirects to /planning/<newId>. The status is 'in planning' and the Event value tile equals the entered budget. The Checklist is pre-seeded with template tasks for the chosen event type (wedding) if a template exists. The typed venue is saved as a reusable Location and now appears in the Locations list and in the 'Saved venue' dropdown for future events.

#### `PLAN-19` Create an event with an empty title (negative / invalid input)  
*Type: negative · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/planning/events/new.
2. Leave the Event title blank but fill other fields (type, date, budget).
3. Click 'Create event'.

**Expected:** The event is NOT created and the user stays on the New event form. A red validation error 'Event title is required.' is shown beneath the form. No redirect to a new event page occurs.

#### `PLAN-20` Non-existent event ID returns Not Found  
*Type: edge · Priority: P2*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/planning/this-id-does-not-exist-12345 in the address bar.
2. Observe the result.

**Expected:** A 'Not Found' (404) page is shown for an event ID that does not exist (the page calls notFound() when no booking matches). The app does not crash or leak a stack trace.

---

## 11. Locations

*Area: both*

**Prerequisites:** App running at http://localhost:3000. Two seeded logins (password ChangeMe123! for both): owner@platform.local (super-admin, sees a company switcher) and admin@bloomco.example (company admin, locked to BloomCo). Use a private/incognito window per login so sessions do not collide. The Locations area lives under the Planning section, not /admin. Reach it at http://localhost:3000/planning/locations or click Planning in the left sidebar, then the "Locations" button. Note: as super-admin you MUST first pick a company in the top company switcher, otherwise Locations shows a "select a company" notice instead of the list/form. Have at least one second company (besides BloomCo) seeded so cross-company checks are meaningful. Address autocomplete calls OpenStreetMap and needs internet access.

#### `LOC-01` Create a location with only the required name  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/planning/locations. 3. Click the '+ New location' button (top right). 4. On the New location page, leave the 'Search address / venue' box empty. 5. In the 'Venue name' field type 'Grand Ballroom A'. 6. Leave every other field (Address, City, State, Postcode, Capacity, Contact name, Contact phone, Notes) blank. 7. Click 'Create location'.

**Expected:** The form submits with no error. You are redirected back to http://localhost:3000/planning/locations and a card titled 'Grand Ballroom A' appears in the list. Because city/state are empty the card's second line shows a dash (—).

#### `LOC-02` Create a fully populated location and verify the list card  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/planning/locations/new. 2. Fill Venue name = 'Sunway Convention Centre', Address = 'Jalan Lagoon Selatan', City = 'Subang Jaya', State = 'Selangor', Postcode = '47500', Capacity = '800', Contact name = 'Aisha', Contact phone = '0123456789', Notes = 'Loading bay at rear'. 3. Click 'Create location'. 4. On the list page locate the new card.

**Expected:** Redirected to the list. A card 'Sunway Convention Centre' shows the second line 'Subang Jaya, Selangor · up to 800'. Re-opening the card shows every field you entered persisted exactly.

#### `LOC-03` Address autocomplete fills city/state/postcode/coordinates and shows a map  
*Type: happy · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/planning/locations/new. 2. In 'Search address / venue' type 'KLCC Convention Centre' (at least 3 characters) and wait about 1 second for the dropdown to appear. 3. Click the first suggestion in the dropdown. 4. Observe the form fields and the area below the search box.

**Expected:** Address, City, State and Postcode auto-populate from the chosen suggestion, the Venue name fills if it was empty, and an embedded OpenStreetMap map with a marker appears between the search box and the Venue name field (because hidden latitude/longitude were set). Clicking 'Create location' saves and the saved record retains the coordinates (the map re-appears when you open the card to edit).

#### `LOC-04` Submitting with a blank venue name is rejected  
*Type: negative · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/planning/locations/new. 2. Leave 'Venue name' empty. 3. Optionally fill City = 'Penang' so you can confirm nothing was saved. 4. Click 'Create location'.

**Expected:** No redirect happens; you stay on the New location page and a red message 'Location name is required.' appears above the button. Returning to the list shows no new location was created.

#### `LOC-05` Whitespace-only venue name is treated as empty and rejected  
*Type: edge · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/planning/locations/new. 2. In 'Venue name' type three spaces only. 3. Click 'Create location'.

**Expected:** The name is trimmed to empty server-side, so the red 'Location name is required.' message appears and nothing is saved. The form does not create a location named with blank spaces.

#### `LOC-06` Edit an existing location and verify changes persist  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example go to http://localhost:3000/planning/locations. 2. Click the 'Grand Ballroom A' card created in LOC-01. 3. On the edit page change Venue name to 'Grand Ballroom A (Renovated)', set City = 'Kuala Lumpur', State = 'WP', Capacity = '500'. 4. Click 'Save location'. 5. Back on the list, open the same card again.

**Expected:** Redirected to the list after saving. The card title now reads 'Grand Ballroom A (Renovated)' with second line 'Kuala Lumpur, WP · up to 500'. Re-opening confirms all three changed fields were saved.

#### `LOC-07` Capacity accepts only whole numbers (decimal truncates, text is dropped)  
*Type: edge · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/planning/locations/new. 2. Venue name = 'Capacity Test Hall'. 3. In Capacity (a number field) try typing letters like 'abc' (note the number input usually blocks them), then clear it and enter '150.7'. 4. Click 'Create location'. 5. Open the saved card.

**Expected:** Capacity is stored as a whole number: '150.7' is truncated and saved as 150 (the card shows '· up to 150'). Non-numeric text cannot be submitted as capacity; if it somehow is, capacity is stored empty rather than crashing. The save still succeeds because capacity is optional.

#### `LOC-08` Negative or zero capacity is currently accepted (data-quality gap)  
*Type: edge · Priority: P2*

**Steps:**
1. Go to http://localhost:3000/planning/locations/new. 2. Venue name = 'Negative Cap Venue'. 3. In Capacity enter '-5'. 4. Click 'Create location'. 5. Open the saved card.

**Expected:** Note the current behaviour: the location saves with capacity -5 and the list card shows '· up to -5'. There is no validation preventing zero or negative capacity. Flag this as a defect to fix if the business requires capacity to be a positive number.

#### `LOC-09` Empty list shows a friendly message for a company with no locations  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as owner@platform.local (super-admin). 2. Using the company switcher at the top, select a company that has no locations yet (a freshly seeded second company). 3. Go to http://localhost:3000/planning/locations.

**Expected:** The page header 'Locations' and the '+ New location' button are shown, and instead of cards the body reads 'No locations yet.' No locations from any other company are shown.

#### `LOC-10` Super-admin with no company selected sees a select-company notice instead of locations  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. In the company switcher choose the option that clears the active company (the group/all-companies view, i.e. no specific company selected). 3. Go to http://localhost:3000/planning/locations. 4. Also open http://localhost:3000/planning/locations/new and try to use it.

**Expected:** On the list page, instead of a location list you see the 'Select a company' notice (no cards, no error crash). The '+ New location' header button still shows, but creating a location is blocked: if you submit the new-location form with no active company the action returns the error 'Select a company first.' and nothing is saved.

#### `LOC-11` Locations list is scoped to the active company only (tenant isolation)  
*Type: security · Priority: P0*

**Steps:**
1. As admin@bloomco.example note the BloomCo locations on http://localhost:3000/planning/locations. 2. In a separate incognito window log in as owner@platform.local. 3. With BloomCo selected in the switcher, view http://localhost:3000/planning/locations and confirm you see the same BloomCo locations. 4. Switch the company to a different company and reload the list.

**Expected:** Each view lists ONLY the selected company's locations, sorted alphabetically by name. BloomCo's 'Sunway Convention Centre' / 'Grand Ballroom A' do not appear when another company is selected, and vice versa. No location leaks across companies.

#### `LOC-12` Company admin cannot open or edit another company's location (cross-company URL access)  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, open a BloomCo location's edit page and copy its URL, e.g. http://localhost:3000/planning/locations/<bloomco-location-id>. 2. Create or note a location id belonging to a DIFFERENT company (open that company in the switcher and copy one of its location ids). 3. In an incognito window log in as admin@bloomco.example (BloomCo admin). 4. Paste the OTHER company's location-id URL directly into the address bar and load it.

**Expected:** The BloomCo admin is redirected away to http://localhost:3000/planning/locations (their own list) and never sees the other company's location data or edit form. Attempting to POST an edit to that id also returns 'Not found.' so no cross-company modification is possible.

#### `LOC-13` Opening a non-existent location id shows Not Found  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as owner@platform.local with a company selected. 2. In the address bar go to http://localhost:3000/planning/locations/does-not-exist-123.

**Expected:** A 404 / Not Found page is shown (the edit page calls notFound() because no location with that id exists). The app does not crash and does not reveal another company's data.

#### `LOC-14` Unauthenticated access to Locations redirects to login  
*Type: security · Priority: P0*

**Steps:**
1. Open a fresh incognito window where you are NOT logged in. 2. Navigate directly to http://localhost:3000/planning/locations. 3. Also try http://localhost:3000/planning/locations/new.

**Expected:** Both requests redirect to the login page at /login with a 'next' parameter pointing back to the requested path (e.g. /login?next=/planning/locations). After logging in you land on the originally requested page. No location data is shown while logged out.

#### `LOC-15` Attach a saved location to a new booking via the 'Saved venue' dropdown  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example go to http://localhost:3000/planning (Planning) and click '+ New booking', or go directly to http://localhost:3000/planning/events/new. 2. Enter Event title = 'Tan Wedding', pick an Event type and Date. 3. In the 'Saved venue' dropdown select 'Sunway Convention Centre' (created in LOC-02). 4. Leave the 'Search a new venue' and 'Venue name' fields empty. 5. Click 'Create event'. 6. On the event board that opens, scroll to 'Event details'.

**Expected:** The booking is created and the event board opens. The booking is linked to the saved Sunway location: the Planning list line and the event header reference that venue, and in 'Event details' the 'Saved venue' dropdown shows 'Sunway Convention Centre' preselected.

#### `LOC-16` Typing a brand-new venue on a booking auto-creates a reusable location  
*Type: happy · Priority: P1*

**Steps:**
1. Go to http://localhost:3000/planning/events/new. 2. Event title = 'Lim Engagement'. 3. Leave 'Saved venue' on '— pick saved, or search below —'. 4. In 'Venue name' type a venue that does not yet exist, e.g. 'Backyard Garden KL' (or use the 'Search a new venue' box, pick a Nominatim result, then submit). 5. Click 'Create event'. 6. After the event board loads, open http://localhost:3000/planning/locations.

**Expected:** A new location 'Backyard Garden KL' now appears in the Locations list for BloomCo (the system auto-saved the typed venue as a reusable Location, with coordinates if a map result was picked). The new booking is linked to that newly created location, and it is selectable in the 'Saved venue' dropdown on subsequent bookings.

#### `LOC-17` Saved-venue dropdown on a booking only lists the booking's own company locations  
*Type: security · Priority: P1*

**Steps:**
1. As owner@platform.local, ensure two companies each have at least one distinct location (e.g. BloomCo has 'Sunway Convention Centre'; second company has 'Other Co Hall'). 2. Select BloomCo in the switcher and open http://localhost:3000/planning/events/new. 3. Open the 'Saved venue' dropdown. 4. Switch the company to the second company and reload the New event page; open the dropdown again.

**Expected:** When BloomCo is active the dropdown lists only BloomCo venues (e.g. 'Sunway Convention Centre') and NOT 'Other Co Hall'. When the second company is active it lists only that company's venues. Venues never cross company boundaries in the booking attach dropdown.

#### `LOC-18` Address search ignores queries shorter than 3 characters  
*Type: edge · Priority: P2*

**Steps:**
1. Go to http://localhost:3000/planning/locations/new. 2. In 'Search address / venue' type just 'KL' (2 characters) and wait. 3. Then add more so it reads 'KLCC' (4 characters) and wait about 1 second.

**Expected:** With only 2 characters no suggestion dropdown appears (search is suppressed below 3 characters). Once 3+ characters are entered, the debounced lookup runs and a suggestion dropdown appears. This confirms the minimum-length guard and that the form does not spam the lookup on every keystroke.

---

## 12. Expenses & Petty Cash

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the seeded database. Seeded logins (both password ChangeMe123!): owner@platform.local (super-admin, no fixed company — must pick a company from the switcher in the top bar) and admin@bloomco.example (company admin for "Bloom & Co Events"). NOTE FROM CODE: the seed creates only ONE company (Bloom & Co Events) and only manager-level accounts (no plain SALES/PLANNER staff). To run the cross-company test (EXP-13) you must first create a SECOND company while logged in as owner@platform.local (Companies section in /admin) and note an expense ID that belongs to Bloom & Co. To exercise the AI receipt extraction (EXP-02) the active company needs a valid OpenAI key saved in its settings; if no key is configured the system intentionally still saves the receipt and lets you fill the form by hand (see EXP-03). Have 1-2 real receipt photos (JPG/PNG) handy, plus one non-image file (e.g. a .pdf or .txt) and one very large image (>8MB) for negative tests. Tip: open expenses at http://localhost:3000/admin/expenses and petty cash at http://localhost:3000/admin/petty-cash.

#### `EXP-01` Submit an expense claim manually without AI (happy path)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in at http://localhost:3000/login as admin@bloomco.example / ChangeMe123!. 2. Go to http://localhost:3000/admin/expenses. 3. Click the '+ New claim' button (top right). 4. On the New expense claim page, ignore Step 1 (Upload receipt) for now and scroll to Step 2 (Claim details). 5. Type a Vendor / shop name, e.g. 'Daiso KLCC'. 6. Pick a Date. 7. Choose Category 'Materials'. 8. Enter Amount paid (RM) = 120.50. 9. Enter SST / tax (RM) = 6.50. 10. Type Paid by = 'Cash'. 11. Leave 'For event (optional)' as '— company overhead —'. 12. Add a short Note. 13. Click 'Submit claim'.

**Expected:** Page redirects to the expense detail page (/admin/expenses/<id>) showing the vendor as the title, a 'submitted' status badge (amber), the amount RM 120.50, SST 6.50, Paid by Cash, and 'Submitted by' = Bloom Admin. The claim also appears at the top of the list on /admin/expenses with status 'submitted'.

#### `EXP-02` Upload a receipt and prefill via AI extract (requires AI key)  
*Type: happy · Priority: P1*

**Steps:**
1. Ensure the active company (Bloom & Co Events) has a valid OpenAI key saved in its settings. 2. Log in as admin@bloomco.example. 3. Go to http://localhost:3000/admin/expenses/new. 4. In Step 1 (Upload receipt), click the file chooser and select a clear receipt photo (JPG/PNG). 5. Click the '✨ Extract with AI' button. 6. Wait while the button shows 'Reading receipt…'.

**Expected:** A green message 'Receipt uploaded — check the details below, then submit.' appears with a thumbnail of the uploaded receipt. The Step 2 fields (Vendor, Date, Category, Amount, SST, Notes) auto-fill with values read from the receipt. You can correct any field, then click 'Submit claim' to save (redirects to the detail page with the receipt image shown under 'Receipts').

#### `EXP-03` AI extract gracefully degrades when OCR is unavailable — receipt still saved  
*Type: edge · Priority: P1*

**Steps:**
1. Use a company with NO OpenAI key configured (the default seeded state), logged in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/expenses/new. 3. In Step 1, choose a receipt image and click '✨ Extract with AI'.

**Expected:** The receipt is still uploaded and a thumbnail plus the green 'Receipt uploaded…' confirmation appears (no crash). The Step 2 fields are NOT auto-filled (or stay as typed) so you fill them in manually. After completing Vendor and Amount you can still 'Submit claim' successfully, and the receipt is attached to the claim. (If a key exists but OCR fails, a red error line appears but the receipt is still kept.)

#### `EXP-04` Submit blocked when vendor is empty  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/expenses/new. 3. In Step 2 leave Vendor / shop blank, enter Amount = 50. 4. Click 'Submit claim' (if the browser blocks on the required field, clear it via the field and use the keyboard to bypass the HTML required hint, or note the browser's own 'fill this field' prompt).

**Expected:** The claim is NOT created. The browser's required-field prompt appears on the Vendor field; if it is bypassed, the server rejects it and a red message 'Vendor / shop name is required.' is shown. No redirect to a detail page occurs.

#### `EXP-05` Submit blocked when amount is zero or negative  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/expenses/new. 3. In Step 2 enter Vendor = 'Test Shop'. 4. Enter Amount paid (RM) = 0 (then also try -10). 5. Click 'Submit claim'.

**Expected:** No claim is created. A red message 'Enter the amount paid.' is shown. The form stays on the New claim page. A negative or zero amount never produces a SUBMITTED expense.

#### `EXP-06` Reject non-image and oversized files on receipt upload  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/expenses/new. 3. In Step 1 try to choose a non-image file (e.g. a .pdf or .txt) — note the file picker is restricted to images (accept=image/*). 4. If you can still select it, click '✨ Extract with AI'. 5. Separately, select a very large image over 8MB and click '✨ Extract with AI'.

**Expected:** Non-image files are filtered out by the picker; if forced through, they are silently not stored. For an oversized (>8MB) image, the file is rejected by storage and not saved; if no valid file remains, a red message 'Upload failed — try a clearer photo.' or 'Choose at least one receipt image.' is shown. No broken/empty attachment is created.

#### `EXP-07` Approve a submitted claim (manager)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example (company admin = manager). 2. Open a claim in SUBMITTED status from http://localhost:3000/admin/expenses (click 'View'). 3. In the 'Review:' bar at the bottom, click the green 'Approve' button.

**Expected:** The status badge changes to 'approved' (emerald). The 'Reviewed by' row now shows Bloom Admin. The Approve/Reject buttons are replaced by a single blue 'Mark reimbursed' button. The list view also shows the claim as 'approved'.

#### `EXP-08` Reject a submitted claim (manager)  
*Type: happy · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example. 2. Open a different SUBMITTED claim. 3. Click the red 'Reject' button in the Review bar.

**Expected:** The status badge changes to 'rejected' (red) and 'Reviewed by' shows the manager. The Review bar now shows 'No further action.' (no Approve/Reject/Reimburse buttons), confirming a rejected claim is terminal.

#### `EXP-09` Mark an approved claim as reimbursed (manager)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Open a claim that is in APPROVED status (use the one from EXP-07). 3. Click the blue 'Mark reimbursed' button.

**Expected:** The status badge changes to 'reimbursed' (blue). The Review bar now shows 'No further action.' On the list, the claim shows 'reimbursed' and counts toward the 'Approved (this month)' total tile.

#### `EXP-10` Cannot reimburse a claim that was never approved  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example. 2. Open a claim that is still SUBMITTED (only Approve/Reject are offered). 3. Confirm there is no 'Mark reimbursed' button. 4. Open a REJECTED claim and confirm no reimburse button either.

**Expected:** 'Mark reimbursed' is only available on APPROVED claims. SUBMITTED claims offer only Approve/Reject; REJECTED and REIMBURSED claims show 'No further action.' There is no UI path to reimburse a non-approved claim.

#### `EXP-11` Filter and search the expenses list  
*Type: happy · Priority: P2*

**Steps:**
1. Log in as admin@bloomco.example with several claims of various dates/categories. 2. Go to http://localhost:3000/admin/expenses. 3. Click the 'This month' period pill. 4. Type part of a vendor name in 'Search vendor…' and pick a Category, then click 'Search'. 5. Set From/To dates and click 'Search'. 6. Click 'All time' to clear.

**Expected:** The table updates to show only matching rows; the URL gains period/cat/q/from/to query params. The top tiles (Pending approval count, Pending this month, Approved this month) reflect the visible/period data. 'All time' clears all filters. An empty result shows 'No claims yet.'

#### `EXP-12` Super-admin must select a company before using expenses  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123!. 2. WITHOUT picking a company in the top-bar switcher (group view), go to http://localhost:3000/admin/expenses. 3. Then go to http://localhost:3000/admin/expenses/new. 4. Now pick 'Bloom & Co Events' in the company switcher and revisit both pages.

**Expected:** With no company selected, both pages show the notice 'Pick a company from the switcher above to view its data.' and the claim form is hidden. After selecting Bloom & Co Events, the list and the New claim form appear and operate as that company. (If a super-admin tries to submit without a selected company the server returns 'Select a company first.')

#### `EXP-13` Cross-company access to another company's expense is blocked  
*Type: security · Priority: P0*

**Steps:**
1. As owner@platform.local, create a SECOND company (Companies area of /admin) if one does not exist, e.g. 'Acme Decor'. 2. Note the ID of an expense that belongs to Bloom & Co Events (open it as the Bloom admin and copy the URL /admin/expenses/<bloomExpenseId>). 3. Log out and log in as admin@bloomco.example — confirm you CAN open that Bloom expense. 4. Create or identify a user/expense belonging to the OTHER company; while logged in as the Bloom admin, manually navigate to http://localhost:3000/admin/expenses/<otherCompanyExpenseId>.

**Expected:** A company admin can only see their own company's expenses. Navigating directly to another company's expense URL redirects back to /admin/expenses (the detail is never shown). The list at /admin/expenses only contains Bloom & Co rows. Only the super-admin (after switching into that company) can view the other company's claims.

#### `PC-01` Record a petty-cash spend (cash out) — goes to PENDING  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/petty-cash. 3. In the 'Record a spend (cash out)' form, set a Date, Pay to = 'May Fang', Description = 'Lalamove for Delux setup', Category = 'Transport', Amount (RM) = 45.00. 4. Optionally attach a receipt photo. 5. Click 'Submit spend'.

**Expected:** A new ledger row appears with the date, pay-to, description (with '· Transport' tag), the amount in the 'Out' column (red), Balance shown as '—', and status 'pending' (amber). The note 'Spends need manager approval before they affect the balance.' holds true — the 'Balance in hand' and 'Cash out (approved)' totals do NOT change yet; the 'Pending approval' tile increases by RM 45.00.

#### `PC-02` Spend validation — amount and description required  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/petty-cash. 3. In the spend form leave Description blank but enter Amount = 20, click 'Submit spend'. 4. Then enter a Description but set Amount = 0 (and try blank), click 'Submit spend'.

**Expected:** With a blank description: red message 'Describe what it was for.' and no row is created. With amount 0/blank: red message 'Enter the amount spent.' and no row is created. (Description is also marked required by the browser.) No PENDING entry is created in either case.

#### `PC-03` Add cash to the float (top-up) — manager only, auto-approved  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/petty-cash. 3. In the green 'Add cash to float (top-up)' form, set Date, Amount (RM) = 500.00, Description = 'Opening float'. 4. Click 'Add to float'.

**Expected:** A ledger row appears immediately with status 'approved' (emerald), the amount in the 'In' column (green), and a running Balance. The 'Cash in (approved)' tile increases by RM 500.00 and 'Balance in hand' increases by RM 500.00 right away (no approval step needed for top-ups).

#### `PC-04` Approve a pending spend — balance updates  
*Type: happy · Priority: P0*

**Steps:**
1. Ensure there is an APPROVED top-up (e.g. RM 500 from PC-03) and a PENDING spend (e.g. RM 45 from PC-01). 2. Log in as admin@bloomco.example and go to http://localhost:3000/admin/petty-cash. 3. In the rightmost column of the pending spend row, click the green '✓' button.

**Expected:** The spend row status changes to 'approved'. 'Cash out (approved)' increases by RM 45.00, the 'Pending approval' tile drops by RM 45.00, and 'Balance in hand' decreases to RM 455.00 (500 − 45). The row's Balance column now shows the running balance instead of '—'.

#### `PC-05` Reject a pending spend — never affects balance  
*Type: happy · Priority: P1*

**Steps:**
1. Create another PENDING spend (e.g. RM 30). 2. Log in as admin@bloomco.example and go to http://localhost:3000/admin/petty-cash. 3. On that pending row click the red '✕' button.

**Expected:** The row status changes to 'rejected' (red). 'Pending approval' drops by RM 30.00 and 'Balance in hand' / 'Cash out (approved)' are unchanged — a rejected spend never reduces the float. The row's Balance column remains '—'.

#### `PC-06` Delete a petty-cash entry (manager) recomputes balance  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as admin@bloomco.example and go to http://localhost:3000/admin/petty-cash. 2. Find an APPROVED entry that is no longer pending (e.g. the approved top-up). 3. In the rightmost column click 'Delete'.

**Expected:** The entry is removed from the ledger and the balance summary recomputes immediately (e.g. removing the RM 500 top-up drops 'Cash in (approved)' and 'Balance in hand' by 500). Pending rows show ✓/✕ controls instead of Delete; only non-pending rows expose 'Delete'.

#### `PC-07` Period filter shows opening / closing balance correctly  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as admin@bloomco.example with entries spread across dates. 2. Go to http://localhost:3000/admin/petty-cash. 3. Click 'This month' (or set From/To). 4. Observe the balance tiles and the ledger's first 'Opening balance' row.

**Expected:** When a period is selected, an 'Opening balance' tile and a top ledger row appear, equal to the net of APPROVED movements dated BEFORE the period start. Closing balance = opening + approved cash-in − approved cash-out within the period. Pending entries within the period count only toward 'Pending approval', not the closing balance. 'All time' hides the opening row and shows 'Balance in hand'.

#### `PC-08` Non-manager cannot top up, approve, reject, or delete (permission check)  
*Type: security · Priority: P0*

**Steps:**
1. Create a staff user with a non-manager role (SALES or PLANNER) for Bloom & Co Events (the seed has none), or use any account whose role is not SUPER_ADMIN/COMPANY_ADMIN. 2. Log in as that user and go to http://localhost:3000/admin/petty-cash. 3. Observe the forms and the ledger action column. 4. Attempt to submit a spend as this user.

**Expected:** The 'Add cash to float (top-up)' form is hidden for non-managers; only the 'Record a spend' form is shown. Pending rows show NO ✓/✕ buttons and there is no 'Delete' link. The user CAN submit a spend (it lands in PENDING). Even if a manager-only action were triggered server-side, addTopup returns 'Only managers can add cash to the float.' and approve/reject/delete are silently no-ops for non-managers.

#### `PC-09` Cross-company isolation and super-admin company gate for petty cash  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local WITHOUT selecting a company; go to http://localhost:3000/admin/petty-cash. 2. Then select Bloom & Co Events in the switcher and reload. 3. Add a top-up. 4. Switch to the OTHER company (Acme Decor) in the switcher and reload petty cash.

**Expected:** With no company selected, the page shows 'Pick a company from the switcher above to view its data.' After selecting Bloom & Co, only Bloom's ledger entries and balance appear. Switching to Acme Decor shows ONLY Acme's entries (Bloom's top-up does not appear). Entries and balances never bleed across companies.

#### `PC-10` Save petty-cash statement as PDF  
*Type: happy · Priority: P2*

**Steps:**
1. Log in as admin@bloomco.example and go to http://localhost:3000/admin/petty-cash. 2. Optionally apply a period filter. 3. Click the 'Save as PDF' button (top right).

**Expected:** The browser print dialog opens showing a clean printable statement: the company header (legal name, reg no, address, logo if set), a 'PETTY CASH / Reimbursement statement' title with the selected date range, the balance summary, and the ledger table. The filter pills, search, action buttons and the add-entry forms are hidden in the printed/PDF output.

---

## 13. Finance P&L + Group reports (per-company P&L, super-admin consolidated reports, CSV export)

*Area: backend*

**Prerequisites:** App running at http://localhost:3000. Two seeded logins (both password ChangeMe123!): owner@platform.local = super-admin (group owner, no company), admin@bloomco.example = company admin for "Bloom & Co Events". By default only ONE company ("Bloom & Co Events") is seeded; to test consolidation across multiple companies, the super-admin must first create a second company via the back office (Admin > Companies > "+ New company"). Use a private/incognito window or two separate browsers so the super-admin and company-admin sessions do not overwrite each other (login replaces the ep_session cookie). For some negative/security cases you must be able to paste a URL directly into the address bar while logged in as a specific user. A spreadsheet app (Excel / Numbers / Google Sheets) is needed to verify the exported CSV.

#### `FIN-01` Company admin can open the per-company P&L and see the monthly statement  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/login and sign in as admin@bloomco.example / ChangeMe123!.
2. In the left navigation, open the 'Admin' group and click 'Finance (P&L)' (or go directly to http://localhost:3000/admin/finance).
3. Observe the page heading and the three period tabs at the top: 'Daily', 'Weekly', 'Monthly'.
4. Note which tab is highlighted by default.
5. Read the statement body: company name/header, the 'Profit & Loss Statement' title, and the table rows.

**Expected:** The page loads with heading 'Finance — P&L'. The 'Monthly' tab is highlighted by default and the period label shows the current month and year. A statement is shown with the company header (Bloom & Co Events legal name and Reg No 202601000000), a 'Revenue' row, a 'Less: Cost of Sales' section, 'Gross Profit' with a margin %, a 'Less: Operating Expenses' section, and a 'Net Profit / (Loss)' line with a margin %. All money values are formatted like 'RM 1,234.56'. Net profit is shown in green when positive, red (in parentheses) when negative.

#### `FIN-02` Switch P&L period between Daily, Weekly, and Monthly  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/finance.
2. Click the 'Daily' tab.
3. Confirm the period label changes to a single date (e.g. '25 June 2026') and the URL contains period=day.
4. Click the 'Weekly' tab.
5. Confirm the period label changes to a date range like '2026-06-22 → 2026-06-28' and the URL contains period=week.
6. Click the 'Monthly' tab.
7. Confirm the period label changes back to a month/year and the URL contains period=month.

**Expected:** Each tab click reloads the statement scoped to that period. Daily shows one calendar day, Weekly shows a Monday-to-Sunday 7-day range, Monthly shows the full calendar month. The Revenue, Cost of Sales, Operating Expenses, and Net Profit figures recalculate for the selected period. The currently selected tab is highlighted (accent colour).

#### `FIN-03` Navigate to a specific date and step through periods with Previous / Next  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/finance.
2. Stay on the 'Monthly' tab. In the date field next to the tabs, pick a date in a past month (e.g. the 1st of last month) and click 'Go'.
3. Confirm the period label now shows that earlier month.
4. Click '← Previous'.
5. Confirm the label moves back exactly one month.
6. Click 'Next →' twice.
7. Confirm the label advances two months forward from the previous step.

**Expected:** Choosing a date and clicking 'Go' jumps the statement to the period containing that date. 'Previous' moves back one period unit (one month in Monthly, one week in Weekly, one day in Daily) and 'Next' moves forward one unit, with the URL date parameter updating accordingly. Figures recalculate for each navigated period.

#### `FIN-04` Empty / no-activity period shows zero P&L and the empty-expenses message  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/finance.
2. Switch to the 'Daily' tab.
3. In the date field choose a far-future date with no payments or expenses (e.g. 2030-01-01) and click 'Go'.
4. Read the Revenue, Gross Profit, Net Profit, and the 'Expenses Analysis' table.

**Expected:** Revenue shows RM 0.00, Cost of Sales and Operating Expenses totals show (RM 0.00), Gross Profit and Net Profit show RM 0.00 with 0.0% margins (no division-by-zero error or NaN). The 'Expenses Analysis' table shows the empty-state row 'No approved expenses this month.' and a Total row of RM 0.00 / 100%. The page does not error.

#### `FIN-05` P&L correctly classifies Cost of Sales vs Operating Expenses  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, ensure the company has at least one APPROVED expense in a Cost-of-Sales category (Materials, Transport, or Rental) and one in another category (e.g. Marketing/Salary) within a chosen month — create them via Admin > Expenses > new if needed, and approve them.
2. Go to http://localhost:3000/admin/finance on the 'Monthly' tab for that month.
3. Read the 'Less: Cost of Sales' section line items vs the 'Less: Operating Expenses' line items.
4. Read the footnote at the bottom of the statement.
5. Cross-check that Gross Profit = Revenue minus Total Cost of Sales, and Net Profit = Gross Profit minus Total Operating Expenses.

**Expected:** Materials / Transport / Rental expenses (plus petty cash categorised Petrol, Parking, Hardware, Transport, or Shipping) appear under Cost of Sales. All other expense and petty-cash categories appear under Operating Expenses (petty-cash lines are suffixed with '(petty)'). The footnote explains 'Revenue = confirmed payments. Cost of Sales = event materials/transport/rental + event petty cash. Operating = overhead.' The arithmetic ties out: Gross Profit and Net Profit equal the displayed totals.

#### `FIN-06` Revenue counts only CONFIRMED payments (not pending/draft)  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, note the current month's Revenue figure on http://localhost:3000/admin/finance.
2. Via Admin > Invoices / Bookings, record a payment but leave it in a non-confirmed (pending) state.
3. Reload the Finance page for the same period.
4. Confirm the Revenue figure has NOT increased.
5. Now confirm that payment (mark it CONFIRMED).
6. Reload the Finance page for the period containing the payment's confirmation date.
7. Confirm Revenue increases by the confirmed amount.

**Expected:** Pending/unconfirmed payments do not contribute to Revenue. Only payments with status CONFIRMED are counted, attributed to the period of their confirmedAt date (falling back to createdAt). Revenue increases by exactly the confirmed payment amount once it is confirmed.

#### `FIN-07` Save the P&L statement as PDF (print)  
*Type: happy · Priority: P2*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/finance.
2. Scroll to the bottom and click the 'Save as PDF' button.
3. In the browser print dialog that opens, review the print preview.
4. Choose 'Save as PDF' as the destination and confirm.

**Expected:** The browser print dialog opens. The print preview shows only the statement document (company header, Profit & Loss Statement, the P&L table, and the Expenses Analysis on a new page) without the navigation tabs, date picker, Previous/Next controls, or the 'Save as PDF' button (these are hidden in print). A clean PDF can be saved.

#### `FIN-08` Super-admin must pick a company before seeing a P&L  
*Type: edge · Priority: P0*

**Steps:**
1. In a fresh incognito window, sign in as owner@platform.local / ChangeMe123! (super-admin).
2. Without using the company switcher yet, go directly to http://localhost:3000/admin/finance.
3. Read the page body.
4. Now use the 'Active company' dropdown (company switcher) in the top bar and select 'Bloom & Co Events'.
5. Return to / reload http://localhost:3000/admin/finance.

**Expected:** Before a company is selected, the Finance page shows the heading plus the message 'Pick a company from the switcher above to view its data.' (no statement, no error). After selecting a company in the switcher, the full P&L statement for that company renders. The super-admin's selection persists (cookie) across reloads.

#### `FIN-09` Super-admin P&L is scoped to the selected company only (tenant isolation)  
*Type: security · Priority: P0*

**Steps:**
1. As super-admin (owner@platform.local), first create a second company: Admin > Companies > '+ New company', fill name (e.g. 'Acme Decor'), legal name, and save.
2. Go to http://localhost:3000/admin/finance, select 'Bloom & Co Events' in the switcher, and note its Revenue and totals.
3. Use the switcher to change the Active company to 'Acme Decor'.
4. Reload http://localhost:3000/admin/finance.
5. Compare the figures and the company header.

**Expected:** Each company's P&L shows only that company's payments and expenses. The newly created 'Acme Decor' (with no data) shows RM 0.00 across Revenue / Gross / Net and an empty Expenses Analysis. The company header (legal name, Reg No) matches the selected company. No data from Bloom & Co bleeds into Acme Decor and vice versa.

#### `FIN-10` SALES / PLANNER roles are denied access to the per-company P&L  
*Type: security · Priority: P0*

**Steps:**
1. As super-admin, create or identify a user with the SALES role (Admin > Staff). Note its login. (If no Sales user exists, create one assigned to Bloom & Co Events.)
2. In an incognito window, log in as that SALES user.
3. Observe the left navigation 'Admin' group.
4. Manually navigate to http://localhost:3000/admin/finance by typing it in the address bar.
5. (Optional) Repeat with a PLANNER user — note planners are redirected to /planning.

**Expected:** The SALES user does NOT see a 'Finance (P&L)' link in the navigation (only SUPER_ADMIN and COMPANY_ADMIN get it). Navigating directly to /admin/finance shows the access-denied message 'You don't have access to staff management.' instead of a statement. A PLANNER hitting any /admin URL is redirected to /planning.

#### `GRP-01` Super-admin opens consolidated Group reports  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as owner@platform.local (super-admin), open the 'Admin' nav group and click 'Group reports' (or go to http://localhost:3000/admin/reports).
2. Read the four summary cards at the top.
3. Read the per-company table and the totals row at the bottom.

**Expected:** Page loads with heading 'Group reports' and subtitle 'Consolidated across all companies.' Four cards show 'Revenue (confirmed)', 'Outstanding balances', 'Accepted quotes', and 'Upcoming events'. A table lists every company with columns Company, Leads, Accepted, Active events, Upcoming, Revenue, Outstanding, with a bold 'Total' row summing all columns. Money values are formatted 'RM 0.00'. Each company name links to /admin/companies/{id}.

#### `GRP-02` Group totals equal the sum of all company rows and reconcile with per-company P&L revenue  
*Type: happy · Priority: P1*

**Steps:**
1. As super-admin on http://localhost:3000/admin/reports, manually add up the 'Revenue' column across all company rows.
2. Compare your sum to the 'Total' row Revenue and to the 'Revenue (confirmed)' card.
3. Do the same check for the Outstanding column vs the 'Outstanding balances' card.
4. For one company, click its name, then open that company's Finance P&L (via switcher) for an all-time view and sanity-check that the report's confirmed revenue is consistent with the P&L revenue concept (confirmed payments).

**Expected:** The Total row equals the column-by-column sum of all company rows. The 'Revenue (confirmed)' card equals the Total Revenue, and the 'Outstanding balances' card equals the Total Outstanding. Confirmed-payment revenue concept is consistent between the group report and the per-company P&L (both count only CONFIRMED payments).

#### `GRP-03` New company appears in Group reports with zeroed metrics  
*Type: edge · Priority: P1*

**Steps:**
1. As super-admin, create a brand-new company via Admin > Companies > '+ New company' (e.g. 'Zen Events') and save.
2. Go to http://localhost:3000/admin/reports.
3. Locate the new company's row in the table.

**Expected:** The new company appears as a row (companies are listed alphabetically by name) with Leads 0, Accepted 0, Active events 0, Upcoming 0, Revenue RM 0.00, Outstanding RM 0.00. The Total row and the summary cards update to include it (unchanged numerically since it has no data).

#### `GRP-04` Export the Group report to CSV and verify contents  
*Type: happy · Priority: P0*

**Steps:**
1. As super-admin on http://localhost:3000/admin/reports, click the 'Export CSV' button (links to http://localhost:3000/admin/reports/export).
2. Save / open the downloaded file.
3. Open it in a spreadsheet app.
4. Compare the header row and each data row against the on-screen table, including the final 'Total' row.

**Expected:** A file named 'group-report.csv' downloads (Content-Type text/csv). The header row is Company, Leads, Accepted, Active events, Upcoming, Revenue, Outstanding. There is one row per company matching the on-screen values, followed by a 'Total' row. Revenue and Outstanding are written with two decimals. Values match the web table exactly.

#### `GRP-05` CSV export is protected against spreadsheet formula injection  
*Type: security · Priority: P0*

**Steps:**
1. As super-admin, create a company whose name begins with a spreadsheet control character, e.g. name it '=HYPERLINK("http://evil")' or '+SUM(1+1)' or '@cmd' via Admin > Companies > '+ New company', and save.
2. Go to http://localhost:3000/admin/reports and click 'Export CSV'.
3. Open group-report.csv in Excel / Numbers / Google Sheets.
4. Look at the cell containing that company name.
5. Also open the CSV in a plain text editor to inspect the raw cell.

**Expected:** The spreadsheet does NOT execute the formula. In the raw CSV the offending cell is prefixed with a single quote (e.g. "'=HYPERLINK(...)") and properly quoted/escaped so any embedded double-quotes are doubled. When opened in a spreadsheet the cell displays as literal text, not an evaluated formula or hyperlink. (Cleanup: rename/delete the test company afterward.)

#### `GRP-06` Company admin cannot access Group reports (navigation + direct URL)  
*Type: security · Priority: P0*

**Steps:**
1. In an incognito window, log in as admin@bloomco.example / ChangeMe123! (company admin).
2. Open the 'Admin' nav group and confirm what links are present.
3. Type http://localhost:3000/admin/reports directly into the address bar and press Enter.
4. Observe where you land.

**Expected:** The company admin does NOT see a 'Group reports' link (only super-admin gets it; they see a 'Settings' link to their own company instead). Navigating directly to /admin/reports redirects them away to /admin (the dashboard) — they never see consolidated cross-company data.

#### `GRP-07` Company admin is blocked from the CSV export endpoint (returns Forbidden)  
*Type: security · Priority: P0*

**Steps:**
1. In an incognito window, log in as admin@bloomco.example / ChangeMe123! (company admin).
2. Paste http://localhost:3000/admin/reports/export directly into the address bar and press Enter.
3. Observe the response.

**Expected:** The export endpoint returns HTTP 403 with the body 'Forbidden'. No CSV file downloads and no cross-company data is exposed. (The route checks for SUPER_ADMIN specifically.)

#### `GRP-08` Unauthenticated access to reports, export, and finance is rejected  
*Type: security · Priority: P0*

**Steps:**
1. Ensure you are logged out (clear cookies or use a fresh incognito window).
2. Paste http://localhost:3000/admin/reports into the address bar.
3. Paste http://localhost:3000/admin/finance into the address bar.
4. Paste http://localhost:3000/admin/reports/export into the address bar.

**Expected:** Visiting /admin/reports and /admin/finance while logged out redirects to /login (no data shown). The /admin/reports/export endpoint returns 403 Forbidden (no session = not a super-admin). No financial or consolidated data is ever rendered to an anonymous visitor.

#### `GRP-09` Group report Active vs Upcoming event counts respect booking status  
*Type: edge · Priority: P2*

**Steps:**
1. As super-admin, ensure one company has at least one booking with a future event date in an open status (e.g. CONFIRMED / IN_PLANNING / READY) and one booking that is CLOSED or CANCELLED.
2. Go to http://localhost:3000/admin/reports and note that company's 'Active events' and 'Upcoming' counts.
3. Cancel or close the open future booking (Admin > Bookings).
4. Reload http://localhost:3000/admin/reports.

**Expected:** 'Active events' counts only bookings in CONFIRMED / IN_PLANNING / READY status; 'Upcoming' counts only open (not CLOSED/CANCELLED) bookings with a future event date. CLOSED/CANCELLED bookings are excluded from both counts and from Outstanding balances. After cancelling the open future booking, that company's Active and Upcoming counts decrease accordingly.

#### `GRP-10` Outstanding balances reflect open booking balance due only  
*Type: edge · Priority: P2*

**Steps:**
1. As super-admin on http://localhost:3000/admin/reports, note a company's 'Outstanding' value.
2. For a booking of that company with a non-zero balance due, record/confirm a payment that reduces or clears the balance (Admin > Bookings / Invoices).
3. Reload http://localhost:3000/admin/reports.
4. Compare the Outstanding value and the Revenue value.

**Expected:** Outstanding equals the sum of balanceDue across that company's non-closed, non-cancelled bookings. After a payment reduces a booking's balance, Outstanding decreases by that amount; if the payment is confirmed, Revenue increases. Closing/cancelling a booking removes its balance from Outstanding. Figures stay internally consistent with the per-company P&L revenue.

---

## 14. Companies management (create/edit company: branding, SST, bank/DuitNow, profit%, prefixes, AI key, custom domains, domain binding)

*Area: both*

**Prerequisites:** App running at http://localhost:3000. Two seeded logins, both password ChangeMe123!: (1) owner@platform.local = group super-admin (can see and manage ALL companies); (2) admin@bloomco.example = company admin tied to the seeded "Bloom & Co Events" company. To log in: open http://localhost:3000/login, enter the email + password, submit; you land in the back office at /admin. To log out before switching accounts, use the logout control in the back office, or clear cookies. Use a normal desktop browser (Chrome/Safari). The seeded company "Bloom & Co Events" already has: SST registered, profit 35%, prefixes BLOOM-Q / BLOOM-INV, domain bloomco.example. Some tests need TWO companies to exist — create a second company as the super-admin first (see TC-COMP-01) if only Bloom & Co exists. Note: TC-COMP-14 (Bind via Cloudflare) makes a REAL call to Cloudflare's API and will only fully succeed with a genuine Cloudflare API token + Zone ID; without real credentials, verify the error-handling behavior instead.

#### `TC-COMP-01` Super-admin creates a new company with valid details (happy path)  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as owner@platform.local. 2. In the left sidebar under 'Admin', click 'Companies' (or go to http://localhost:3000/admin/companies). 3. Click the '+ New company' button at top right (lands on /admin/companies/new). 4. Under 'Identity', type Company name = 'Acme Events'; Legal name = 'Acme Events Sdn Bhd'; leave Default language = English. 5. Under 'SST', leave the 'This company is SST-registered' box unchecked. 6. Under 'Branding', set Primary colour = #2f6fed. 7. Under 'Quoting & numbering', confirm Quote prefix = 'Q', Invoice prefix = 'INV', Default profit % = '30.00', Default deposit % = '50.00'. 8. Leave all other fields at their defaults. 9. Click the 'Create company' button at the bottom.

**Expected:** Company is created and the browser is redirected to that company's edit page (URL /admin/companies/<new-id>?saved=1). A green banner reads 'Saved — changes are now in effect.' Page heading shows 'Acme Events'. Returning to /admin/companies shows 'Acme Events' listed in the table with SST '—', Default profit '30%', and Domains '—'.

#### `TC-COMP-02` Create company fails when required Company name is blank  
*Type: negative · Priority: P0*

**Steps:**
1. Log in as owner@platform.local. 2. Go to http://localhost:3000/admin/companies/new. 3. Leave 'Company name' completely empty. 4. Fill nothing else (leave defaults). 5. Click 'Create company'.

**Expected:** Form does NOT submit/save. A red error message appears at the bottom: 'Please fix the highlighted fields.' and a red field error 'Company name is required' shows under the Company name input. URL stays on /admin/companies/new. No new company appears in the list.

#### `TC-COMP-03` Create company rejects an invalid email address  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Go to http://localhost:3000/admin/companies/new. 3. Company name = 'Bad Email Co'. 4. Under 'Contact & address', type Email = 'not-an-email' (no @). 5. Click 'Create company'.

**Expected:** Form is rejected. Red banner 'Please fix the highlighted fields.' appears and a red 'Invalid email' message shows under the Email field. Company is not created. (Note: a completely blank email is allowed — only malformed text is rejected.)

#### `TC-COMP-04` Create company rejects out-of-range SST rate and deposit % (0–100 cap)  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Go to http://localhost:3000/admin/companies/new. 3. Company name = 'Range Test Co'. 4. Under 'SST', tick 'This company is SST-registered' and set SST rate (%) = '150'. 5. Under 'Quoting & numbering', set Default deposit % = '200'. 6. Click 'Create company'.

**Expected:** Form is rejected with red banner 'Please fix the highlighted fields.' A field error 'SST rate must be between 0 and 100' appears under SST rate, and 'Default deposit % must be between 0 and 100' under Default deposit %. Company is not created.

#### `TC-COMP-05` Create company rejects a negative / non-numeric Default profit %  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Go to http://localhost:3000/admin/companies/new. 3. Company name = 'Profit Test Co'. 4. Under 'Quoting & numbering', set Default profit % = '-5'. 5. Click 'Create company'. 6. After observing the result, change Default profit % to 'abc' and click 'Create company' again.

**Expected:** Both attempts are rejected with 'Please fix the highlighted fields.' For '-5' the field error reads 'Default profit % cannot be negative'; for 'abc' it reads 'Default profit % must be a number'. Company is not created. (Note: unlike SST/deposit, profit % has no upper cap — a value like 120 is accepted.)

#### `TC-COMP-06` Create company rejects blank Quote/Invoice prefix when explicitly cleared (only-spaces)  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as owner@platform.local. 2. Go to http://localhost:3000/admin/companies/new. 3. Company name = 'Prefix Test Co'. 4. Under 'Quoting & numbering', clear the 'Quote number prefix' field and type a single space ' '. 5. Click 'Create company'.

**Expected:** Form is rejected with 'Please fix the highlighted fields.' and a field error 'Quote prefix is required' (a single space is not a valid prefix). Note: if the prefix is fully emptied, the system silently defaults it back to 'Q' / 'INV' rather than erroring, so to confirm the requirement test with a whitespace-only value.

#### `TC-COMP-07` Super-admin edits the seeded Bloom & Co company branding/SST and changes persist  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as owner@platform.local. 2. Go to http://localhost:3000/admin/companies. 3. Click 'Bloom & Co Events' in the table. 4. Under 'Branding', change Primary colour (hex) to '#ff0066'. 5. Under 'Quoting & numbering', change Default profit % to '40'. 6. Under 'Payment details', set Bank name = 'CIMB', Account name = 'Bloom & Co', Account number = '7001234567', DuitNow QR image URL = 'https://example.com/qr.png'. 7. Click 'Save changes'. 8. After the green banner appears, reload the page (or navigate away and back).

**Expected:** Redirect to /admin/companies/<id>?saved=1 with green banner 'Saved — changes are now in effect.' After reload, the Branding primary colour still shows '#ff0066', Default profit % shows '40', and the payment fields retain CIMB / Bloom & Co / 7001234567 / the QR URL. The Companies list now shows Default profit '40%' for Bloom & Co.

#### `TC-COMP-08` Editing a company and leaving the OpenAI key blank keeps the existing key (secret not overwritten)  
*Type: edge · Priority: P0*

**Steps:**
1. Log in as owner@platform.local. 2. Open Bloom & Co edit page (/admin/companies). 3. Under 'AI (smart quoting)', first enter any value in 'OpenAI API key' (e.g. 'sk-test-123') and click 'Save changes' to establish a saved key. 4. Reopen the same company edit page. 5. Observe the OpenAI API key field placeholder. 6. Without typing anything in the OpenAI API key field, change an unrelated field (e.g. Brand font = 'Inter') and click 'Save changes'. 7. Reopen the edit page once more.

**Expected:** After step 3 the key is stored encrypted. In step 5 the OpenAI API key field is masked/empty with placeholder text indicating a saved key exists ('•••••••• (saved — leave blank to keep)'). After step 6 the unrelated change saves AND the previously saved key remains intact (placeholder still shows the 'saved — leave blank to keep' state, confirming the blank field did NOT wipe the key). The same blank-keeps-existing behavior applies to the WhatsApp Access token and Cloudflare API token fields.

#### `TC-COMP-09` Custom domains are normalized (lowercased, comma/space separated, de-duplicated) on save  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Open the edit page of any company. 3. Under 'Public site', set Custom domains to a messy mixed list: 'Acme-Events.com, WWW.Acme-Events.com\nacme-events.com  extra.com' (include the duplicate 'acme-events.com' and mixed case). 4. Click 'Save changes'. 5. Reopen the edit page and inspect the Custom domains box, then check the Companies list 'Domains' column.

**Expected:** On save the domains are stored lowercased, split on commas/whitespace/newlines, and de-duplicated. After reload the Custom domains field shows something like 'acme-events.com, www.acme-events.com, extra.com' (the duplicate 'acme-events.com' collapsed to one, all lowercase). The list page Domains column shows the same comma-joined set.

#### `TC-COMP-10` Test OpenAI connection reports a clear error for an invalid key  
*Type: negative · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Open any company's edit page. 3. Scroll below the form to the 'Test OpenAI connection' card. 4. In its API key field type an obviously invalid key, e.g. 'sk-invalid-000'. 5. Click 'Test connection'.

**Expected:** The button shows 'Testing…' then a red result box appears with an OpenAI rejection message (e.g. 'OpenAI rejected the key (HTTP 401)' or the provider's incorrect-API-key message). No success (green) message. Nothing is saved to the company by this test.

#### `TC-COMP-11` Test OpenAI connection with no key and none saved prompts the user to enter one  
*Type: edge · Priority: P2*

**Steps:**
1. Log in as owner@platform.local. 2. Create or open a company that has NO saved OpenAI key (a fresh company from TC-COMP-01 that never had a key entered). 3. Scroll to the 'Test OpenAI connection' card. 4. Leave the API key field empty. 5. Click 'Test connection'.

**Expected:** A red message appears: 'Enter an API key first, or save one.' (Assuming no OPENAI_API_KEY env fallback is configured; if a global env key exists the test will instead attempt a real connection.)

#### `TC-COMP-12` Company admin can open and edit ONLY their own company via the Settings link  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Observe the left sidebar 'Admin' group — there is a 'Settings' link (no 'Companies' or 'Group reports' links). 3. Click 'Settings' (it points to /admin/companies/<bloom-company-id>). 4. Change Brand font to 'Poppins'. 5. Click 'Save changes'.

**Expected:** The Bloom & Co company edit page opens directly (heading 'Bloom & Co Events'). Note there is NO '← Companies' back link shown for a company admin (that link only renders for super-admin). The edit saves successfully with the green 'Saved' banner. The company admin sees only their own company's settings — no company list and no link to create new companies.

#### `TC-COMP-13` SECURITY: Company admin is blocked from the company list, the New-company page, and editing another company  
*Type: security · Priority: P0*

**Steps:**
1. Ensure a second company exists (create one as super-admin per TC-COMP-01; note its id from the URL). 2. Log out and log in as admin@bloomco.example. 3. In the address bar manually go to http://localhost:3000/admin/companies. 4. Then go to http://localhost:3000/admin/companies/new. 5. Then go to http://localhost:3000/admin/companies/<the-other-company-id> (a company that is NOT Bloom & Co).

**Expected:** All three attempts are denied by redirect: the company list and the New-company page bounce the company admin to /admin (the dashboard), and attempting to open another company's edit page also redirects to /admin. At no point does the company admin see another company's settings, secrets, or the create form. (This confirms cross-company isolation.)

#### `TC-COMP-14` SECURITY: Unauthenticated user cannot reach any company management page  
*Type: security · Priority: P0*

**Steps:**
1. Ensure you are logged out (clear cookies / use a private window). 2. Try to open http://localhost:3000/admin/companies. 3. Try http://localhost:3000/admin/companies/new. 4. Try http://localhost:3000/admin/companies/<any-known-company-id>.

**Expected:** Every attempt redirects to the login page (http://localhost:3000/login). No company data, list, form, or secrets are exposed to a logged-out visitor.

#### `TC-COMP-15` Bind custom domain via Cloudflare — section visibility and validation behavior  
*Type: happy · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Open any company's edit page. 3. Confirm: with NO Cloudflare Zone ID and NO Cloudflare API token saved, the 'Custom domains' / 'Bind via Cloudflare' card does NOT appear below the AI tester. 4. Under 'Custom domain (Cloudflare)' in the form, enter a Cloudflare Zone ID (e.g. a real or test 32-char zone id) AND a Cloudflare API token, then click 'Save changes'. 5. Reopen the edit page — the 'Custom domains' bind card now appears. 6. In that card's domain field type an invalid value 'not a domain' and click 'Bind via Cloudflare'. 7. Then type a valid domain 'events.example.com' and click 'Bind via Cloudflare'.

**Expected:** Step 3: the bind card is hidden until BOTH Zone ID and API token are saved. Step 5: after saving both, the bind card appears, listing any existing bound domains as chips. Step 6: invalid input returns red error 'Enter a valid domain.' Step 7 with real Cloudflare credentials: a green 'Domain bound — DNS record created.' message and the domain is added to the company's domains; with fake credentials it returns a Cloudflare API error or 'Server IP is not configured (APP_BASE_URL).' — the form must surface that error clearly rather than crash.

#### `TC-COMP-16` SST toggle and rate flow correctly between checkbox and rate field  
*Type: happy · Priority: P1*

**Steps:**
1. Log in as owner@platform.local. 2. Open a company edit page. 3. Under 'SST', tick 'This company is SST-registered', set SST registration no. = 'W10-1808-12345678', SST rate (%) = '8'. 4. Click 'Save changes' and reload — confirm the checkbox stays ticked and the rate/reg no. persist; the Companies list shows SST 'Registered'. 5. Reopen, UNtick 'This company is SST-registered', leave SST rate as-is, click 'Save changes', reload.

**Expected:** Step 4: SST registered checkbox remains checked, SST reg no. and rate persist, list shows 'Registered' for that company. Step 5: after unchecking and saving, the checkbox is now unticked on reload and the Companies list shows '—' under SST. The saved SST rate value is retained but no longer flagged as registered.

---

## 15. Users / Staff management (create user, roles, status, company scoping)

*Area: both*

**Prerequisites:** App running at http://localhost:3000. Database seeded so these two logins work (password ChangeMe123! for both): owner@platform.local = super-admin (group owner, no company), admin@bloomco.example = company admin of "Bloom & Co Events". Use a normal Chrome window plus a second separate browser or Incognito window when a test asks you to be logged in as two different people at once. The Staff screen lives at http://localhost:3000/admin/users and is reached from the back office left sidebar under the "Admin" group, link labelled "Staff" (Chinese: 员工). For the cross-company test (TC-12) it helps to have a SECOND company created first via Admin > Companies (super-admin only); if only "Bloom & Co Events" exists, create one called e.g. "Test Co" before running TC-12. Tip: pick fresh, unique email addresses for every "create" test (e.g. add a number) because the system blocks duplicate emails. Note: there is currently no "delete user" button and no "reset password" button on this screen by design — do not look for them.

#### `TC-01` Company admin can open the Staff page and see only their own company's staff  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/login and sign in as admin@bloomco.example / ChangeMe123!.
2. In the left sidebar, find the 'Admin' group and click 'Staff' (you land on http://localhost:3000/admin/users).
3. Look at the page heading and the table of existing users.
4. Note whether a 'Company' column is shown in the table.

**Expected:** The page loads with heading 'Staff' and the helper line about adding team members. A table lists staff. Every row belongs to Bloom & Co Events (the admin's own company); no users from other companies and no group-level super-admin appear. There is NO 'Company' column (that column only shows for the super-admin). Your own row shows a '(you)' marker next to the name.

#### `TC-02` Company admin creates a new Sales staff member (happy path)  
*Type: happy · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. In the 'Add staff' form at the top, type a Full name e.g. 'Sales Sam'.
3. Type a fresh email e.g. sam01@bloomco.example.
4. Type a temporary password of at least 8 characters e.g. ChangeMe123!.
5. Leave the Role dropdown on 'sales' (its default).
6. Click 'Add staff'.
7. Watch the button and the message area.

**Expected:** The button briefly shows 'Adding…'. A green confirmation 'Staff member added.' appears. The new user 'Sales Sam' now shows in the table below with role 'sales', status active, assigned to Bloom & Co Events. No company picker was shown to the company admin (their new staff are auto-assigned to their own company).

#### `TC-03` New staff member can actually log in with the temporary password  
*Type: happy · Priority: P0*

**Steps:**
1. Complete TC-02 so 'Sales Sam' (sam01@bloomco.example) exists.
2. Open a separate browser window (or Incognito) and go to http://localhost:3000/login.
3. Sign in as sam01@bloomco.example / ChangeMe123! (the temporary password you set).
4. Observe where you land and which sidebar items appear.

**Expected:** Login succeeds and the back office loads. Because Sam is a 'sales' user (not admin), the sidebar shows Sales/Delivery/Marketing items but the 'Admin' group does NOT include 'Staff' management — confirming role-based menu. Visiting http://localhost:3000/admin/users directly shows a 'You don't have access to staff management.' message instead of the staff table.

#### `TC-04` Create staff with too-short password is rejected  
*Type: negative · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. In 'Add staff', enter Full name 'Short Pass' and a fresh email shortpw01@bloomco.example.
3. In the password field type 'abc' (only 3 characters).
4. Click 'Add staff'.

**Expected:** No user is created. A red error 'Password must be at least 8 characters.' appears under the form. The table does NOT gain a 'Short Pass' row.

#### `TC-05` Create staff with missing name is blocked  
*Type: negative · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. Leave the Full name field empty.
3. Enter email noname01@bloomco.example and a valid 8+ char password.
4. Click 'Add staff'.

**Expected:** The form does not submit because the browser flags the required Name field (it is marked required). If you bypass that, the server returns the red error 'Name and email are required.' No user is created.

#### `TC-06` Create staff with malformed email is blocked  
*Type: negative · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. Enter Full name 'Bad Email', a valid 8+ char password.
3. In the email field type 'not-an-email' (no @, no domain).
4. Click 'Add staff'.

**Expected:** The browser blocks submission with a built-in 'please enter an email address' style tooltip because the email field is type=email. No user is created and no green success message appears.

#### `TC-07` Duplicate email is rejected  
*Type: edge · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. In 'Add staff', enter Full name 'Dup User' and reuse an email that already exists, e.g. admin@bloomco.example (the admin's own email).
3. Enter a valid 8+ char password and click 'Add staff'.
4. Also try a variant with different capitalisation, e.g. ADMIN@bloomco.example, and submit again.

**Expected:** Both attempts fail with the red error 'A user with that email already exists.' The capitalised variant is also rejected, proving emails are compared case-insensitively (the system lowercases the email). No duplicate row is added.

#### `TC-08` Company admin role dropdown does NOT offer super-admin  
*Type: security · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. Open the Role dropdown in the 'Add staff' form and read every option.
3. Also open the per-row Role dropdown on any existing staff row in the table and read its options.

**Expected:** Both dropdowns list only: 'company admin', 'sales', 'planner'. There is NO 'super admin' option anywhere for a company admin. This prevents a company admin from elevating anyone to group-level access.

#### `TC-09` Company admin changes a staff member's role and saves  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. Find the 'Sales Sam' row from TC-02.
3. In that row's Role dropdown, change 'sales' to 'planner'.
4. Click the 'Save' button in that same row.
5. Let the page refresh and re-check Sam's row.

**Expected:** The page reloads and Sam's row now shows role 'planner'. The change persists on refresh. (As a planner, Sam would now be routed to the /planning area on next login rather than the sales back office.)

#### `TC-10` Disabling a staff member blocks their login  
*Type: security · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. Find the 'Sales Sam' row.
3. In that row's Status dropdown change 'active' to 'disabled' and click 'Save'.
4. In a separate/Incognito window, go to http://localhost:3000/login and try to sign in as sam01@bloomco.example / ChangeMe123!.
5. Back in the admin window, set Sam's status back to 'active', Save, and confirm login works again.

**Expected:** After disabling, Sam's login attempt fails with 'Invalid email or password.' (disabled accounts cannot authenticate, and the message does not reveal that the account exists). After re-enabling, Sam can log in again.

#### `TC-11` Admin cannot disable their own account (self-lockout protection)  
*Type: security · Priority: P0*

**Steps:**
1. Logged in as admin@bloomco.example, go to http://localhost:3000/admin/users.
2. Find your own row (it shows the '(you)' marker).
3. Look at the Status dropdown in your own row.
4. Try to change it to 'disabled' and click 'Save'.

**Expected:** The Status dropdown in your own row is disabled (greyed out / not changeable). Even if you force a status change, the server ignores the status update for your own account, so you cannot lock yourself out. Your account stays active.

#### `TC-12` Company admin cannot manage a user from another company (cross-company isolation)  
*Type: security · Priority: P0*

**Steps:**
1. As super-admin owner@platform.local, ensure a SECOND company exists (Admin > Companies > create one, e.g. 'Test Co'), then create a staff user inside Test Co, e.g. 'Other Co Sales' / other01@testco.example.
2. Log out and log back in as admin@bloomco.example (company admin of Bloom & Co).
3. Go to http://localhost:3000/admin/users and scan the table.
4. Confirm 'Other Co Sales' / other01@testco.example does NOT appear anywhere in the list.

**Expected:** The Bloom & Co admin's Staff list shows only Bloom & Co users. The Test Co user is completely absent — a company admin cannot see, edit, re-role, disable, or even discover staff belonging to another company. This is the core multi-tenant isolation guarantee.

#### `TC-13` Sales/Planner user is denied access to the Staff page  
*Type: security · Priority: P0*

**Steps:**
1. Ensure 'Sales Sam' (sam01@bloomco.example) is active and currently has the 'sales' role (re-set it via TC-09/TC-10 if you changed it).
2. In a separate/Incognito window log in as sam01@bloomco.example / ChangeMe123!.
3. Manually navigate to http://localhost:3000/admin/users in the address bar.
4. Separately, create or use a planner user, log in as them, and try the same URL.

**Expected:** For the sales user, the page shows the heading 'Staff' followed by 'You don't have access to staff management.' — no add-staff form and no table. For a planner user, navigating into /admin redirects them out to /planning entirely (planners do not use the back office), so they never reach the staff screen. Neither role can create or modify staff.

#### `TC-14` Super-admin sees the Company column, company picker, and the group view  
*Type: happy · Priority: P1*

**Steps:**
1. Log out and sign in as owner@platform.local / ChangeMe123!.
2. Go to http://localhost:3000/admin/users.
3. Note the company switcher in the top header. If no company is selected (group view), look at the table.
4. Confirm a 'Company' column exists in the table.
5. Use the top-of-page header company switcher to select 'Bloom & Co Events', then re-check the staff list.

**Expected:** As super-admin the table has an extra 'Company' column. With no active company chosen, the group view lists all users across companies (super-admins show as '— group —' in the Company column). After selecting Bloom & Co Events in the switcher, the list narrows to that company's users plus any group-level super-admins. The add-staff form also shows an extra company dropdown.

#### `TC-15` Super-admin creates a super-admin (company auto-cleared) and a company-scoped user  
*Type: happy · Priority: P1*

**Steps:**
1. Logged in as owner@platform.local, go to http://localhost:3000/admin/users.
2. In 'Add staff' set Full name 'Group Owner 2', email owner2@platform.local, valid password, Role = 'super admin'. In the company dropdown you may pick any company OR leave it on '— company (leave empty for super-admin) —'. Click 'Add staff'.
3. After success, create a second user: Full name 'Bloom Sales 2', email bsales2@bloomco.example, Role = 'sales', and in the company dropdown choose 'Bloom & Co Events'. Click 'Add staff'.
4. Inspect both new rows' Company column.

**Expected:** Both creations succeed with the green 'Staff member added.' message. 'Group Owner 2' is created as a super-admin with Company shown as '— group —' (the company selection is intentionally ignored / cleared for super-admins). 'Bloom Sales 2' is created under 'Bloom & Co Events'.

#### `TC-16` Super-admin creating a non-super-admin without choosing a company is rejected  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in as owner@platform.local, FIRST make sure no company is selected in the header switcher (group view). If a company is already selected, you can't easily clear it in the UI — in that case temporarily test by leaving the form's company dropdown on the empty '— company —' option.
2. Go to http://localhost:3000/admin/users.
3. In 'Add staff' set Full name 'Orphan Sales', email orphan01@x.example, valid password, Role = 'sales'.
4. In the company dropdown choose the empty option '— company (leave empty for super-admin) —'.
5. Click 'Add staff'.

**Expected:** Creation is blocked with the red error 'Select a company for this staff member.' A non-super-admin user must belong to a company, so the system refuses to create a company-less sales/planner/company-admin account. No 'Orphan Sales' row is added. (If you instead had an active company selected in the switcher, the system would fall back to that company and creation could succeed — note that behavior if observed.)

---

## 16. Portfolio management (upload portfolio images, ordering, display on public site)

*Area: both*

**Prerequisites:** App running at http://localhost:3000 with the database seeded (seed creates company "Bloom & Co Events" and a few demo records; it does NOT seed portfolio images, so the portfolio starts empty). Two seeded logins, both password ChangeMe123!: owner@platform.local (SUPER_ADMIN, group-level, no fixed company) and admin@bloomco.example (COMPANY_ADMIN of Bloom & Co Events). Back office is under /admin; the portfolio manager is at /admin/portfolio (reachable from the left nav under Marketing > Portfolio). The public site is multilingual (en / ms / zh); the public portfolio page is at /en/portfolio and the homepage showcase strip is on /en. Have ready on your computer: (a) 2-4 normal photos in JPG/PNG/WEBP under 8MB each, (b) one very large image over 8MB, (c) one non-image file such as a PDF or .txt renamed/kept as-is, (d) one animated GIF. Use a normal browser; for cross-company isolation tests you may want a second private/incognito window. Note for the tester: this build orders portfolio images automatically by upload time (newest first) everywhere; there is no drag-to-reorder or manual position control. Several invalid-file rejections happen silently (the bad file is skipped with no per-file message), so read the expected results carefully.

#### `PORT-01` Company admin opens the Portfolio manager and sees the empty state  
*Type: happy · Priority: P0*

**Steps:**
1. Go to http://localhost:3000/admin and log in as admin@bloomco.example / ChangeMe123!.
2. In the left navigation, expand the 'Marketing' group and click 'Portfolio' (or go directly to http://localhost:3000/admin/portfolio).
3. Observe the page heading and content.

**Expected:** The page loads with heading 'Portfolio' and the helper line 'These images appear in your public site's showcase and portfolio pages.' An upload box (a file chooser plus an 'Upload images' button) is shown. Because no portfolio images exist yet, the message 'No portfolio images yet — upload some above.' appears below the upload box. No error is shown.

#### `PORT-02` Upload a single valid image as company admin  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example and open http://localhost:3000/admin/portfolio.
2. Click the file chooser and select one valid JPG or PNG under 8MB.
3. Click 'Upload images'.
4. Wait for the button (which shows 'Uploading…' while busy) to finish.

**Expected:** A green 'Uploaded.' confirmation appears next to the button. The image thumbnail appears in the grid below as a square (object-cover) tile. The empty-state message is gone. No red error text is shown.

#### `PORT-03` Upload multiple valid images at once  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio.
2. Click the file chooser and multi-select 3 valid images (hold Cmd/Ctrl or Shift to pick several) of mixed types (e.g. one JPG, one PNG, one WEBP), each under 8MB.
3. Click 'Upload images' and wait for completion.

**Expected:** Green 'Uploaded.' shows. All 3 new thumbnails appear in the grid. The most recently uploaded images appear first (top-left), confirming newest-first ordering. Existing images from PORT-02 remain present, pushed further down/right.

#### `PORT-04` Verify ordering is newest-first and there is no manual reorder control  
*Type: edge · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio with several images already uploaded (from PORT-02/03).
2. Note the current order of thumbnails (left-to-right, top-to-bottom).
3. Upload one more clearly distinct image (e.g. a brightly colored test image).
4. Observe where the new image lands.
5. Try to drag a thumbnail to a different position; try right-clicking a thumbnail; look for any 'reorder', drag handle, arrow, or position field.

**Expected:** The newly uploaded image always appears first (top-left); ordering is strictly by upload time, newest first. There is NO drag-to-reorder, no up/down arrows, and no position/order field — manual ordering is not supported in this build. Document this as expected current behavior (a limitation, not a defect): owner cannot manually arrange portfolio order.

#### `PORT-05` Submit the upload form with no file selected  
*Type: negative · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio.
2. Without choosing any file, click 'Upload images'.

**Expected:** The form does not submit / nothing uploads — the file input is marked required, so the browser blocks submission and prompts to select a file. No new thumbnail is added and no green 'Uploaded.' appears. (If the browser allows an empty submit, the server returns the red message 'Choose at least one image.')

#### `PORT-06` Attempt to upload an oversized image (over 8MB)  
*Type: negative · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio.
2. Select the single image that is larger than 8MB.
3. Click 'Upload images' and wait.

**Expected:** The oversized file is rejected by the server-side 8MB limit and is silently skipped. Because it was the only file and nothing saved, the red message 'Upload failed — please try again.' appears. No new thumbnail is added to the grid. (Note for tester: the message does not specifically say 'too large' — this is expected.)

#### `PORT-07` Attempt to upload a non-image file (PDF/TXT)  
*Type: security · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio.
2. In the file chooser, switch the file-type filter to 'All files' if needed (the field defaults to images only), then select a PDF or .txt file.
3. Click 'Upload images'.

**Expected:** The file input filters to images (accept=image/*), so non-images normally cannot be picked. If forced through, the server rejects the disallowed MIME type and skips it; with no valid file saved, the red 'Upload failed — please try again.' message appears and no thumbnail is added. No PDF/text appears in the grid.

#### `PORT-08` Mixed batch: one valid image plus one invalid/oversized file  
*Type: edge · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio.
2. Multi-select two files: one valid JPG/PNG under 8MB and one bad file (over 8MB, or a non-image forced through).
3. Click 'Upload images' and wait.

**Expected:** Partial success: the valid image is saved and its thumbnail appears; the bad file is silently skipped. Because at least one file saved, the green 'Uploaded.' message shows and NO red error appears. (Tester note: there is no per-file feedback indicating the bad file was dropped — only the valid one shows up.)

#### `PORT-09` Upload an animated GIF  
*Type: edge · Priority: P2*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio.
2. Select the animated GIF file (under 8MB).
3. Click 'Upload images' and wait.

**Expected:** GIF is an allowed type, so it uploads successfully: green 'Uploaded.' shows and the GIF thumbnail appears in the grid. (In the square admin thumbnail it may be cropped/static-looking; that is acceptable.)

#### `PORT-10` Delete a portfolio image and confirm it disappears  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/portfolio with at least 2 images present.
2. Hover the mouse over one thumbnail; a small black '✕' button appears in the top-right corner of that tile.
3. Click the '✕' button.
4. Wait for the page to refresh.

**Expected:** The clicked image is removed from the grid immediately after the action completes. Remaining images stay in place (newest-first). If you delete the last remaining image, the 'No portfolio images yet — upload some above.' empty state reappears.

#### `PORT-11` Uploaded images appear on the public portfolio page and homepage showcase  
*Type: happy · Priority: P0*

**Steps:**
1. Ensure Bloom & Co has at least 2 portfolio images (upload via PORT-02/03 as admin@bloomco.example).
2. Open a new tab and go to the public portfolio page: http://localhost:3000/en/portfolio.
3. Observe the showcase grid (heading from the site dictionary, e.g. 'Showcase').
4. Now go to the public homepage: http://localhost:3000/en and scroll to the 'Showcase' teaser section.

**Expected:** On /en/portfolio the uploaded images render in a masonry-style column layout, newest first, up to 60 images. On the homepage /en, the showcase teaser shows the 6 most recent portfolio images and a 'Portfolio →' link that navigates to /en/portfolio. Images match what was uploaded in the admin. (If no images exist, both pages show placeholder gradient boxes instead of an error.)

#### `PORT-12` Deleting an image removes it from the public site  
*Type: happy · Priority: P1*

**Steps:**
1. As admin@bloomco.example at http://localhost:3000/admin/portfolio, note one specific image (e.g. the distinctive colored test image).
2. In a separate tab open http://localhost:3000/en/portfolio and confirm that image is visible there.
3. Back in the admin tab, hover that image and click its '✕' delete button.
4. Reload the public page http://localhost:3000/en/portfolio (and the homepage http://localhost:3000/en).

**Expected:** After deletion and reload, the removed image no longer appears on the public portfolio page or in the homepage showcase. Other images remain. The public site reflects the admin change.

#### `PORT-13` Staff/Planner role cannot manage the portfolio  
*Type: security · Priority: P0*

**Steps:**
1. Log out of any admin session.
2. Log in as a non-admin staff user — a PLANNER or STAFF account (if none exists, create one under Admin > Staff as the company admin first, or use any seeded non-admin account).
3. Navigate directly to http://localhost:3000/admin/portfolio.

**Expected:** The page shows the heading 'Portfolio' and the message 'You don't have access to manage the portfolio.' There is NO upload box and NO image grid. The 'Portfolio' link is also absent from a Planner's navigation (planners only see the Delivery group). The user cannot upload or delete.

#### `PORT-14` Super-admin must select a company before managing the portfolio  
*Type: edge · Priority: P1*

**Steps:**
1. Log in as owner@platform.local / ChangeMe123! (super-admin, group level).
2. Without choosing a company in the top company switcher, go to http://localhost:3000/admin/portfolio.
3. Observe the page.
4. Now use the company switcher (top of the admin shell) to select 'Bloom & Co Events'.
5. Observe the page again (it will reload to the company context).

**Expected:** Step 3: the page shows heading 'Portfolio' and a blue notice 'Pick a company from the switcher above to view its data.' — no upload box or grid (no active company is set). Step 5: after selecting Bloom & Co, the full portfolio manager appears scoped to Bloom & Co's images, and the super-admin can upload/delete for that company.

#### `PORT-15` Cross-company isolation — admin only sees and manages their own company's images  
*Type: security · Priority: P0*

**Steps:**
1. As super-admin owner@platform.local, create a second company (Admin > Companies > New, e.g. 'Test Decor Co'), then select it in the switcher and upload 1-2 portfolio images so it has its own set.
2. Switch back to Bloom & Co Events in the switcher and note its portfolio images.
3. Log out and log in as admin@bloomco.example (company admin of Bloom & Co).
4. Open http://localhost:3000/admin/portfolio.

**Expected:** The Bloom & Co company admin sees ONLY Bloom & Co's portfolio images — never the second company's images. The admin grid is scoped to their own companyId. There is no way for the Bloom admin to view or manage another company's portfolio.

#### `PORT-16` Uploaded image file URL is access-controlled / traversal-safe  
*Type: security · Priority: P1*

**Steps:**
1. As admin@bloomco.example, upload an image and on the admin portfolio page right-click a thumbnail and 'Copy image address' (it will look like http://localhost:3000/api/uploads/<companyId>/<random>-<name>.jpg).
2. Open that URL directly in a browser tab and confirm the image loads.
3. Now try a path-traversal attack: in the address bar replace the path tail with an attempt to escape the uploads folder, e.g. http://localhost:3000/api/uploads/..%2f..%2f..%2fetc%2fpasswd and also http://localhost:3000/api/uploads/../package.json .
4. Try a non-existent file path, e.g. http://localhost:3000/api/uploads/bogus/none.jpg .

**Expected:** Step 2: the legitimate image URL serves the image. Step 3: traversal attempts are rejected — the server returns a 400 Bad request or 403 Forbidden (because '..', null bytes and absolute paths are blocked and paths resolving outside the uploads directory are refused); no system file is served. Step 4: a missing file returns 404 Not found. No directory traversal or arbitrary file read is possible.

---

## 17. WhatsApp (inbound webhook, conversation view, reply, bot)

*Area: both*

**Prerequisites:** App running at http://localhost:3000. Two seeded logins (both password ChangeMe123!): owner@platform.local (super-admin, sees all companies) and admin@bloomco.example (company admin for BloomCo). The WhatsApp screens live in the back office under Marketing -> WhatsApp (/admin/whatsapp).

IMPORTANT real-world constraint: Outbound sending and the live inbound webhook require a real Meta WhatsApp Cloud API connection (Phone number ID + Access token configured per company under Company settings -> WhatsApp). In a local/test environment these credentials are typically NOT real, so:
- "New chat" and "Send reply" will still create the conversation/message rows in the UI, but the outbound send will FAIL and the message bubble will show status "failed" with a red error like "WhatsApp is not configured for this company." or a Meta API error. This is the EXPECTED test result locally - you are verifying the UI/recording behavior, not that a real WhatsApp message arrives on a phone.
- The inbound webhook (POST /api/whatsapp/webhook) is normally called by Meta's servers. To test inbound/conversation creation and the bot without a phone, you simulate Meta by sending a crafted request (a developer can run a curl command for you, or use a tool like Postman). Cases that require this are marked and include the exact payload.

Before starting: log in once as admin@bloomco.example to confirm credentials work, then log out. Use a private/incognito window when switching between the two accounts so sessions do not clash. For super-admin, after login you must pick a company in the "Active company" dropdown at the top of the back office before WhatsApp shows data.

Note the seeded company for the company admin is referred to here as "BloomCo"; adjust the name to whatever appears in your switcher/login.

#### `WA-01` WhatsApp inbox loads and lists conversations for a company admin  
*Type: happy · Priority: P0*

**Steps:**
1. In an incognito window, go to http://localhost:3000/login and sign in as admin@bloomco.example / ChangeMe123!.
2. In the left navigation, find the 'Marketing' group and click 'WhatsApp' (or go directly to http://localhost:3000/admin/whatsapp).
3. Observe the page heading and the list area below it.
4. If any conversations exist, note their layout: each row shows a name or phone number, an optional unread count badge, the last message snippet, and a short date/time on the right.

**Expected:** The page loads with the heading 'WhatsApp' and a 'New chat' form (a phone input placeholder '60123456789' and a 'New chat' button). Below it is a bordered list. If there are no conversations it reads 'No conversations yet.' Otherwise each conversation row is clickable, shows the contact name (or the raw phone if no name), a small accent badge with the unread count when unread > 0, the latest message text (or a dash if none), and a timestamp. No errors are shown.

#### `WA-02` Unconfigured-WhatsApp warning banner appears when no phone number ID is set  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in as admin@bloomco.example, open http://localhost:3000/admin/whatsapp.
2. Look just under the heading/New chat row for any amber-coloured notice.
3. If the banner is NOT shown, open Company settings -> WhatsApp (left nav 'Settings' for a company admin) and confirm the 'Phone number ID' field is filled. If it is filled, this banner is correctly hidden.
4. To positively test the banner: in Company settings -> WhatsApp clear the 'Phone number ID' field, save, then return to /admin/whatsapp.

**Expected:** When the company has no WhatsApp Phone number ID configured, an amber banner appears reading approximately: "WhatsApp isn't connected for this company yet. Add the Cloud API phone-number ID and access token in Company settings -> WhatsApp, and point your Meta webhook at /api/whatsapp/webhook." When a Phone number ID is configured, the banner is absent. The conversation list still renders either way.

#### `WA-03` Start a new chat by entering a phone number  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/whatsapp.
2. In the 'New chat' phone box type a number such as 60123456789.
3. Click 'New chat'.
4. Observe where the browser lands and the conversation header.

**Expected:** You are redirected into a conversation thread at a URL like /admin/whatsapp/<id>. The header shows the phone number (e.g. +60123456789) since there is no contact name yet. The message area shows 'No messages yet.' and a reply box ('Type a reply...') is present at the bottom. The new conversation also now appears in the inbox list.

#### `WA-04` New-chat phone input strips non-numeric characters and reuses an existing conversation  
*Type: edge · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/whatsapp.
2. In the 'New chat' box type a messy value like '+60 12-345 6789' (spaces, plus sign, dashes).
3. Click 'New chat' and note the resulting conversation's phone (it should be the digits only: 60123456789).
4. Go back to /admin/whatsapp and start a new chat again with the same number formatted differently (e.g. '60123456789').
5. Confirm you land in the SAME conversation, not a duplicate.

**Expected:** Non-digit characters are stripped, so '+60 12-345 6789' becomes the phone 60123456789. Starting a chat with the same underlying digits opens the existing conversation (upsert by company + phone) rather than creating a duplicate row; the inbox does not show two entries for the same number.

#### `WA-05` New chat with an empty phone is rejected (no conversation created)  
*Type: negative · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/whatsapp.
2. Leave the phone box blank (or type only spaces/letters like 'abc').
3. Click 'New chat'.
4. Observe the result and check the inbox list for any new junk entry.

**Expected:** No conversation is created. The page returns to /admin/whatsapp (the inbox). No empty or letters-only conversation row is added to the list. No error crash occurs.

#### `WA-06` Open a conversation: messages render and unread badge clears  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example, open http://localhost:3000/admin/whatsapp.
2. Identify a conversation that shows an unread count badge (a small accent-coloured number). If none exists, simulate an inbound message first via WA-12, then return here.
3. Note the unread number, then click the conversation row to open it.
4. Read the message bubbles, then click '<- WhatsApp' (top-left) to return to the inbox.
5. Look at that same conversation's row again.

**Expected:** The thread opens showing messages in time order. Inbound (customer) messages appear as left-aligned white/grey bubbles; outbound (staff/bot) messages appear as right-aligned accent-coloured bubbles. Each bubble shows a time; outbound bubbles also show a status (e.g. 'sent' or 'failed'). When you return to the inbox the unread badge for that conversation is gone (unread reset to 0).

#### `WA-07` Send a reply records an outbound message bubble  
*Type: happy · Priority: P0*

**Steps:**
1. As admin@bloomco.example, open any conversation under http://localhost:3000/admin/whatsapp.
2. In the reply box at the bottom type 'Hello, thanks for reaching out!'.
3. Click 'Send' (the button briefly shows 'Sending...').
4. Wait for the page to update and look at the message list and the button state.

**Expected:** A new right-aligned (outbound) accent bubble appears with your text. Because the local environment has no real Meta credentials, the bubble's status reads 'failed' and a red error line shows under the box (e.g. 'WhatsApp is not configured for this company.' or a Meta API error). With real, working credentials the status would read 'sent' and no error appears. Either way the message is recorded and the input is ready for the next message.

#### `WA-08` Empty / whitespace-only reply is rejected  
*Type: negative · Priority: P1*

**Steps:**
1. As admin@bloomco.example, open a conversation under http://localhost:3000/admin/whatsapp.
2. Click 'Send' without typing anything; the browser should block submit because the box is required.
3. Now type only spaces (e.g. press space a few times) and click 'Send'.
4. Observe whether any bubble is added and whether an error appears.

**Expected:** With a completely empty box the browser's required-field validation prevents submit. If a spaces-only value is submitted, the server trims it to empty and returns the error 'Message is empty.' (shown in red under the box). No outbound bubble is added for the empty/whitespace attempt.

#### `WA-09` Replying turns off the bot (botActive becomes false)  
*Type: happy · Priority: P1*

**Steps:**
1. Find or create a conversation where the enquiry bot is active (the thread shows a blue banner: '🤖 The enquiry bot is handling this chat...'). To create one, use WA-13 to drive a bot conversation, then open it.
2. Confirm the blue bot banner with a 'Take over' button is visible.
3. Type any reply (e.g. 'Hi, this is the team') and click 'Send'.
4. Reload the conversation page.

**Expected:** After sending a staff reply, the blue 'enquiry bot is handling this chat' banner disappears on reload, because sending a manual reply sets the conversation's bot to inactive. Subsequent inbound customer messages will no longer be auto-answered by the bot for this conversation.

#### `WA-10` 'Take over' button stops the bot without sending a message  
*Type: happy · Priority: P1*

**Steps:**
1. Open a conversation where the bot is active (blue banner present), per WA-09 step 1.
2. Click the 'Take over' button inside the blue banner.
3. Observe the page after it refreshes.

**Expected:** The blue bot banner disappears (bot set inactive) and NO new outbound bubble is added (Take over does not send a message). The reply box remains available so staff can now answer manually.

#### `WA-11` Opening a non-existent conversation returns Not Found  
*Type: negative · Priority: P1*

**Steps:**
1. As admin@bloomco.example, manually navigate to http://localhost:3000/admin/whatsapp/does-not-exist-123 (a made-up id).
2. Observe the response.

**Expected:** A 404 / 'Not Found' page is shown (the conversation lookup fails). The app does not crash and does not reveal any other company's data.

#### `WA-12` Cross-company access: company admin cannot open another company's conversation  
*Type: security · Priority: P0*

**Steps:**
1. Log in as super-admin owner@platform.local / ChangeMe123! in one incognito window. Pick a DIFFERENT company (not BloomCo) in the 'Active company' dropdown, open /admin/whatsapp, open or create a conversation in that other company, and copy its URL/id (e.g. /admin/whatsapp/<otherId>).
2. In a separate incognito window, log in as admin@bloomco.example / ChangeMe123! (BloomCo).
3. As the BloomCo admin, paste and visit that other company's conversation URL /admin/whatsapp/<otherId>.
4. Observe where you land.

**Expected:** The BloomCo admin is redirected to /admin/whatsapp (their own inbox) and CANNOT view the other company's conversation. None of the other company's messages, contact name, or phone are displayed. (Super-admin, by contrast, is allowed to view any company's conversation.)

#### `WA-13` Unauthenticated user cannot reach the WhatsApp inbox or threads  
*Type: security · Priority: P0*

**Steps:**
1. In a fresh incognito window with no login, go directly to http://localhost:3000/admin/whatsapp.
2. Note where you are sent.
3. Repeat with a thread URL such as http://localhost:3000/admin/whatsapp/<anyId>.

**Expected:** Both URLs redirect to /login (requireUser sends unauthenticated visitors to the login page). No conversation list, message content, or company data is exposed before logging in.

#### `WA-14` Webhook GET verification: correct token returns the challenge, wrong token is forbidden  
*Type: security · Priority: P0*

**Steps:**
1. Ask a developer (or use a browser/curl) to hit the webhook verification endpoint. With the CORRECT verify token configured in the server's WHATSAPP_VERIFY_TOKEN: open http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<CORRECT_TOKEN>&hub.challenge=12345 .
2. Note the response body and status.
3. Now hit it with a WRONG token: http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=12345 .
4. Note the response.

**Expected:** With the correct token and mode=subscribe, the response is HTTP 200 and the body echoes the challenge value (e.g. '12345'). With a wrong/missing token (or wrong mode), the response is HTTP 403 with body 'Forbidden'. This proves only Meta with the shared verify token can register the webhook.

#### `WA-15` Inbound webhook creates a conversation and increments unread (simulated Meta POST)  
*Type: happy · Priority: P0*

**Steps:**
1. Ensure a company has its WhatsApp 'Phone number ID' set (Company settings -> WhatsApp). Note that exact Phone number ID, e.g. 100000000000001.
2. Ask a developer to POST a simulated Meta payload to http://localhost:3000/api/whatsapp/webhook, for example:
   curl -X POST http://localhost:3000/api/whatsapp/webhook -H 'Content-Type: application/json' -d '{"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"100000000000001"},"contacts":[{"wa_id":"60123456789","profile":{"name":"Aisha Tan"}}],"messages":[{"from":"60123456789","id":"wamid.TEST1","type":"text","text":{"body":"Hi, I want a quote"}}]}}]}]}'
   (replace the phone_number_id with the one you noted).
3. The HTTP response should be 200 with body 'ok'.
4. Log into the back office for THAT company and open /admin/whatsapp.

**Expected:** The webhook responds 200 'ok'. A conversation with phone 60123456789 and contact name 'Aisha Tan' appears in that company's inbox, with an unread badge and the snippet 'Hi, I want a quote'. Opening it shows the inbound message as a left-aligned bubble. Sending the same payload again (same id wamid.TEST1) does not duplicate the message bubble (the duplicate-id insert is ignored), though unread still increments.

#### `WA-16` Webhook for an unknown phone number ID is ignored without error  
*Type: edge · Priority: P1*

**Steps:**
1. Ask a developer to POST a payload whose metadata.phone_number_id does NOT match any company, e.g.:
   curl -X POST http://localhost:3000/api/whatsapp/webhook -H 'Content-Type: application/json' -d '{"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"DOES-NOT-EXIST"},"messages":[{"from":"60999999999","id":"wamid.X","type":"text","text":{"body":"stray"}}]}}]}]}'
2. Also try a completely malformed body: curl -X POST http://localhost:3000/api/whatsapp/webhook -H 'Content-Type: application/json' -d 'not-json'.
3. Note responses, then check every company inbox.

**Expected:** Both requests return HTTP 200 'ok' (the webhook always returns 200 so Meta does not retry-storm). No new conversation or message is created for the unknown phone_number_id, and the malformed body is silently ignored. No conversation leaks into the wrong company.

#### `WA-17` Enquiry bot runs the question flow and creates a Lead (end-to-end simulated)  
*Type: happy · Priority: P1*

**Steps:**
1. In Company settings -> WhatsApp for a company, set a valid Phone number ID and Access token, and TICK 'Auto-reply enquiry bot...'. Save. (Without a real token the outbound bot replies will be recorded as 'failed', but the flow and lead creation still proceed.)
2. Have a developer POST a FIRST inbound message from a brand-new phone (per WA-15 format) using that company's phone_number_id and from '60111222333'. This is a new conversation, so the bot should start and ask for the name.
3. Open /admin/whatsapp for that company; confirm the conversation shows the blue 'enquiry bot is handling this chat' banner and an outbound bot question (the name prompt).
4. Have the developer POST successive inbound replies (each a new payload with a unique id) answering each question in order: name -> event type (e.g. 'Wedding') -> date (e.g. '2026-12-25') -> venue -> guest count (e.g. '120') -> budget (e.g. 'RM 20000') -> theme/details.
5. After the 7th answer, reload the conversation, then open /admin/leads for that company.

**Expected:** After the first inbound message the bot auto-asks the questions one at a time (each appears as an outbound bubble). After the final answer the bot sends a thank-you with a reference like '<PREFIX>-EVT-2026-####', the blue bot banner disappears (bot deactivates), and a new Lead appears under /admin/leads for that company with: customer name from the flow, event type WEDDING, event date 2026-12-25, venue, guest count 120, budget captured in the special request, status NEW, source WhatsApp. A staff_new_lead email is queued (if the company has an email).

#### `WA-18` Bot hands off to a human when the customer asks for an agent  
*Type: edge · Priority: P2*

**Steps:**
1. With the bot enabled (per WA-17 step 1) and a fresh conversation that the bot has started, have a developer POST an inbound reply whose text contains a handoff word, e.g. body 'I want to talk to a human' (or '人工').
2. Open /admin/whatsapp for that company and open the conversation.

**Expected:** The bot stops the automated flow: it sends one outbound message like 'No problem — I'll connect you with our team...' and the conversation's bot becomes inactive (blue banner gone), so a staff member can take over and reply manually. A staff notification email ('WhatsApp: customer asked for a human') is queued if the company has an email. No further bot questions are sent.

#### `WA-19` Super-admin must select a company before WhatsApp shows data  
*Type: security · Priority: P1*

**Steps:**
1. In an incognito window log in as super-admin owner@platform.local / ChangeMe123!.
2. Without choosing anything in the 'Active company' dropdown (group view), open http://localhost:3000/admin/whatsapp.
3. Observe the page.
4. Now pick a company in the 'Active company' dropdown at the top and let the page reload.

**Expected:** With no active company selected the WhatsApp page shows the heading and a notice 'Pick a company from the switcher above to view its data.' instead of a conversation list (no New chat form / no list). After selecting a company in the switcher, the inbox for that specific company loads with its conversations and the New chat form.

---

## 18. Background worker (queued email processing, balance reminder dedup, status sweep, SMTP-not-configured skip)

*Area: backend*

**Prerequisites:** Environment: the multi-company event/decoration platform running at http://localhost:3000 with the back office at /admin. Seeded logins: owner@platform.local (super-admin, sees all companies) and admin@bloomco.example (company admin, scoped to BloomCo), both password ChangeMe123!.

The background worker is a SEPARATE process from the website (source: apps/worker). It is NOT controlled from any screen in /admin — there is no "email log" or "run worker now" page in the UI. It polls the database on timers: it processes queued emails roughly every 15 seconds and runs the reminder + status-sweep job roughly every 1 hour; BOTH jobs also run once immediately when the worker starts. So to force a sweep/reminder run on demand you (or your developer) restart the worker.

Because the email outbox is not shown in the UI, several checks below need someone with database access (your developer) to either tail the worker's console log or run a one-line query against the EmailLog table. The exact instruction is given inline in each case. The owner can run all the click-by-click UI steps; the developer only confirms the queued/sent/skipped/failed outcome.

Worker controls (have your developer keep a terminal open):
- Start/dev: from the project root run "npm run worker:dev" (or "docker compose up worker"). Watch its console output — it prints lines like {"processed":N} "emails processed" and {"reminders":N,"executed":M} "sweep complete".
- Restart it = re-run that command. Restarting forces an immediate email tick AND an immediate reminder+sweep tick.
- DB peek (developer): connect to Postgres (DATABASE_URL in .env) and run e.g. SELECT "to",template,status,error,"createdAt" FROM "EmailLog" ORDER BY "createdAt" DESC LIMIT 25;

Default config in the seeded .env: SMTP_HOST is BLANK (email is not configured). This is intentional — the worker still drains the outbox but marks each real email "skipped" instead of actually sending. Tests that depend on "sent" vs "skipped" tell you which SMTP state they assume.

Seed data: at least one company (BloomCo) with a public site reachable under a locale path (e.g. http://localhost:3000/en/contact for the enquiry form). Have a saved customer with a valid email and an upcoming booking available, or create one during the test as instructed.

#### `WK-01` Queued enquiry emails are drained by the worker (SMTP blank → skipped)  
*Type: happy · Priority: P0*

**Steps:**
1. Confirm SMTP is unconfigured (default): ask your developer that SMTP_HOST is blank in .env, or just note the seeded default.
2. Open the public BloomCo enquiry form at http://localhost:3000/en/contact.
3. Fill every required field with a real-looking enquiry: customer name, a valid email like enquiry-test@example.com, phone, event type/date, and a message.
4. Click Submit/Send. Confirm you land on the thank-you page (URL contains /contact/thank-you?ref=...). Note the reference number shown.
5. Have your developer watch the worker console (or wait up to ~20 seconds for the next email tick).
6. Developer runs the EmailLog query and looks for the two new rows for this enquiry: one to enquiry-test@example.com (template enquiry_confirmation) and one staff alert (template staff_new_lead).

**Expected:** Submitting the enquiry queues two emails. Within ~15-20 seconds the worker picks them up; because SMTP_HOST is blank both rows end with status "skipped" (NOT failed). The worker console shows a line like {"processed":2} "emails processed". The website behaves normally regardless — the enquiry succeeds even though no real email is sent.

#### `WK-02` Queued emails are actually sent when SMTP is configured  
*Type: happy · Priority: P0*

**Steps:**
1. Ask your developer to point SMTP at a test inbox catcher (e.g. Mailpit/Mailhog: set SMTP_HOST, SMTP_PORT, SMTP_FROM) and restart the worker.
2. Open http://localhost:3000/en/contact and submit a fresh enquiry with a valid email (e.g. send-test@example.com).
3. Reach the thank-you page.
4. Wait up to ~20 seconds for the next worker email tick (or have the developer restart the worker to force an immediate tick).
5. Open the test inbox catcher UI and look for the confirmation email; have the developer also re-run the EmailLog query.

**Expected:** The confirmation and staff-alert emails arrive in the test inbox. The matching EmailLog rows now show status "sent" (not skipped/failed). The email subject matches what was queued (e.g. "We received your enquiry (REF...)") and the body is the branded HTML template for that template type.

#### `WK-03` Balance reminder is queued for an upcoming, partly-paid event in planning  
*Type: happy · Priority: P0*

**Steps:**
1. Log in to /admin as admin@bloomco.example.
2. Create or open an event that has all of: status IN_PLANNING (or READY), a customer WITH a valid email, a balance still owing (balance due greater than 0), and an event date within the next 7 days. Use the planning board: go to http://localhost:3000/planning, open or create the event (planning/new), set Event date to ~3 days from today, set a Total amount so a balance remains, and set Status to "in planning". Save.
3. Confirm on the event/booking screen that Balance due shows an amount greater than 0 and the status badge reads In planning.
4. Have your developer restart the worker (this forces an immediate reminder+sweep tick) or wait up to 1 hour for the scheduled sweep.
5. Developer checks the worker console for {"reminders":N} and runs the EmailLog query for a new row.

**Expected:** The reminder job finds the booking and queues exactly one EmailLog row: template balance_reminder, addressed to the customer's email, subject like "Balance reminder — <event title>", status queued (then drained to skipped/sent on the next email tick depending on SMTP). Worker console reports reminders count incremented by 1.

#### `WK-04` Reminder dedup — no second reminder within 3 days for the same customer/company  
*Type: edge · Priority: P0*

**Steps:**
1. Complete WK-03 so one balance_reminder has already been queued today for the test customer.
2. Do NOT change the booking — leave it IN_PLANNING with balance > 0 and the event date still within 7 days.
3. Have your developer restart the worker again (forces a second immediate reminder tick), or wait for the next scheduled sweep.
4. Developer re-runs the EmailLog query and counts balance_reminder rows for that customer email + BloomCo.

**Expected:** No new balance_reminder row is created on the second run. The job sees a balance_reminder to the same email within the same company in the last 3 days and skips it. The count of balance_reminder rows for that customer stays at 1. Worker console shows reminders:0 (for this booking).

#### `WK-05` No reminder for events more than 7 days away  
*Type: edge · Priority: P1*

**Steps:**
1. Log in to /admin as admin@bloomco.example.
2. On the planning board create/edit an event with status In planning, a customer with a valid email, balance due > 0, and Event date set to ~20 days from today (well outside the 7-day window). Save.
3. Confirm the booking shows In planning with a balance owing and the far-future date.
4. Have your developer restart the worker to force a reminder tick.
5. Developer checks EmailLog for any balance_reminder addressed to this customer.

**Expected:** No balance_reminder is queued for this event — it is outside the 7-day lead window. Only events with an event date between now and 7 days out are eligible.

#### `WK-06` No reminder when balance is fully paid  
*Type: edge · Priority: P1*

**Steps:**
1. Log in to /admin as admin@bloomco.example.
2. Take an event that is In planning with an event date within 7 days and a customer with a valid email.
3. Bring the balance to zero: either fully confirm payment so Balance due shows 0, or on the planning event edit set Total amount equal to the deposit already paid so the balance computes to 0. Save and confirm Balance due reads 0.
4. Have your developer restart the worker to force a reminder tick.
5. Developer checks EmailLog for a balance_reminder to this customer.

**Expected:** No balance_reminder is queued — the reminder job only targets bookings where balance due is strictly greater than 0. A fully-paid event is excluded.

#### `WK-07` No reminder for an event with no customer email  
*Type: edge · Priority: P1*

**Steps:**
1. Log in to /admin as admin@bloomco.example.
2. Create an event on the planning board (planning/new) directly (a manual event with no linked customer, or a customer that has no email on file), status In planning, balance due > 0, event date within 7 days. Save.
3. Confirm the event has no customer email associated.
4. Have your developer restart the worker to force a reminder tick.
5. Developer checks EmailLog and the worker console.

**Expected:** No reminder is queued for this event and the worker does NOT crash or error. The job silently skips bookings whose customer has no email address. Other eligible events in the same run are still processed normally.

#### `WK-08` Status sweep moves a past-date in-planning event to Executed  
*Type: happy · Priority: P0*

**Steps:**
1. Log in to /admin as admin@bloomco.example.
2. On the planning board create/edit an event, set Status to "in planning" (or "ready"), and set Event date to YESTERDAY (a date earlier than today). Save.
3. Confirm the status badge still reads In planning / Ready and the date is in the past.
4. Have your developer restart the worker to force an immediate sweep tick (or wait up to 1 hour for the scheduled sweep).
5. Refresh the event at http://localhost:3000/planning/<id> and at /admin/bookings/<id>.

**Expected:** After the sweep the booking's status automatically becomes Executed. The status badge now reads Executed on both the planning board and the booking detail page. The worker console shows {"executed":N} incremented. No email is involved in this transition.

#### `WK-09` Status sweep ignores future events and non-planning statuses  
*Type: edge · Priority: P1*

**Steps:**
1. Log in to /admin as admin@bloomco.example. Prepare three events on the planning board:
   a) In planning, event date in the FUTURE (e.g. +10 days).
   b) In planning, event date in the PAST (e.g. yesterday) — this one is the control that SHOULD flip.
   c) An event already marked Executed/Completed/Closed or Cancelled with a PAST date.
2. Save all three and note their statuses.
3. Have your developer restart the worker to force a sweep tick.
4. Refresh all three events on the planning board.

**Expected:** Only event (b) flips to Executed. Event (a) stays In planning (future date is not swept). Event (c) is untouched because its status is not IN_PLANNING/READY — the sweep only promotes in-planning/ready past-date events and never re-touches Executed/Completed/Closed/Cancelled bookings.

#### `WK-10` Email with an invalid recipient (no @) is marked skipped, not sent  
*Type: negative · Priority: P1*

**Steps:**
1. This case requires a queued email whose recipient address has no @ sign. Easiest path: have your developer queue a test row, e.g. insert an EmailLog with to = 'not-an-email', template = 'enquiry_confirmation', status = 'queued', companyId = the BloomCo id. (No UI path normally produces a malformed address.)
2. Have the developer ensure the worker is running, then wait ~20 seconds for an email tick or restart it.
3. Developer re-runs the EmailLog query for that row.

**Expected:** The worker detects the address has no @ and marks that row status "skipped" without ever attempting an SMTP send and without marking it failed. It does not block the other 24 rows in the same batch — valid recipients in the same tick are still processed.

#### `WK-11` Send failure is recorded as failed with a truncated error (bad SMTP)  
*Type: negative · Priority: P1*

**Steps:**
1. Ask your developer to set SMTP_HOST to an unreachable/garbage host (e.g. SMTP_HOST=127.0.0.1 with nothing listening, or an invalid hostname) and restart the worker.
2. Submit a fresh enquiry at http://localhost:3000/en/contact with a valid email so two emails get queued, OR have the developer queue one test row to a valid address.
3. Wait for the email tick (or restart the worker to force one).
4. Developer re-runs the EmailLog query for the affected rows.

**Expected:** Because SMTP_HOST is set but the connection fails, the send throws; the worker marks those rows status "failed" and stores a short error message (truncated to ~300 characters) in the error column. The worker stays alive and keeps polling — one bad send does not crash it. (Restore a valid/blank SMTP config afterward.)

#### `WK-12` Outbox batch is capped at 25 oldest-first per email tick  
*Type: edge · Priority: P2*

**Steps:**
1. Have your developer queue 30 valid test EmailLog rows (status queued) with staggered createdAt timestamps so order is clear, all to valid addresses, all for BloomCo.
2. Ensure the worker is running with SMTP blank (so each becomes skipped quickly) and observe a single email tick (restart the worker to capture exactly one immediate tick, then immediately stop it if you want to inspect mid-stream, or just read the console line).
3. Developer inspects the EmailLog rows and the worker console output.

**Expected:** A single email tick processes at most 25 rows, taken oldest-first (orderBy createdAt ascending). After the first tick ~25 rows are no longer queued and ~5 remain queued; the next tick (~15s later) drains the remaining ones. No row is lost and ordering is honoured.

#### `WK-13` Reminder dedup is scoped per company (cross-company isolation)  
*Type: security · Priority: P1*

**Steps:**
1. This verifies a customer email used in two different companies does not get cross-suppressed. Have your developer (or use owner@platform.local who can see all companies) ensure two companies exist (e.g. BloomCo and a second seeded/created company).
2. In BOTH companies, create an event that is In planning, balance due > 0, event date within 7 days, for a customer using the SAME email address (e.g. shared@example.com).
3. Have your developer restart the worker to force a reminder tick.
4. Developer queries EmailLog grouped by companyId for template balance_reminder to shared@example.com.

**Expected:** Each company gets its OWN balance_reminder row for that email (two rows total, one per companyId). The 3-day dedup is keyed on companyId + template + recipient, so a reminder already sent for company A does NOT suppress company B's reminder. This confirms reminders respect company boundaries.

#### `WK-14` Reminder fires after a status change makes a previously-ineligible event eligible  
*Type: edge · Priority: P2*

**Steps:**
1. Log in to /admin as admin@bloomco.example. Create an event with status CONFIRMED (not yet in planning), customer with a valid email, balance due > 0, event date within 7 days. Save.
2. Have your developer restart the worker to run a reminder tick. Developer confirms NO balance_reminder is queued (CONFIRMED is not an eligible status — only IN_PLANNING/READY qualify).
3. Now edit the same event and change Status to "in planning" (or confirm a payment, which auto-moves CONFIRMED → in planning). Save.
4. Have your developer restart the worker again to run another reminder tick.
5. Developer re-checks EmailLog.

**Expected:** On step 2 no reminder is queued because CONFIRMED bookings are outside the reminder job's status filter. After moving the event to In planning, the next reminder tick queues exactly one balance_reminder. This confirms only IN_PLANNING/READY events are reminded and the transition is picked up on the following run.

#### `WK-15` Worker survives an empty outbox / nothing-to-do tick  
*Type: edge · Priority: P2*

**Steps:**
1. Ensure there are no queued EmailLog rows and no eligible reminders or past-date in-planning events (clear the test data or run after WK-08 has already swept everything).
2. Have your developer restart the worker and watch the console for at least one email tick and one sweep tick.

**Expected:** The worker starts cleanly, logs its startup line ("worker started — polling Postgres..."), and runs both ticks with nothing to do. It does NOT print processed/reminders/sweep-complete lines when counts are zero (those logs are gated on count > 0) and it does NOT error or exit. It keeps polling on its timers.

#### `WK-16` Worker effects are not exposed or controllable from the back office (permission/surface check)  
*Type: security · Priority: P2*

**Steps:**
1. Log in to /admin as admin@bloomco.example.
2. Browse the back office navigation and the booking/planning screens looking for any 'email log', 'outbox', 'send reminders now', or 'run worker' control.
3. Try visiting plausible direct URLs such as http://localhost:3000/admin/emails and http://localhost:3000/admin/worker.
4. Log out and log back in as owner@platform.local and repeat the look-around.

**Expected:** There is no UI to read the email outbox or to manually trigger the worker — neither the company admin nor the super-admin can run the worker from the browser. Guessed URLs return not-found/redirect rather than exposing the outbox. This confirms email/reminder/sweep processing is an out-of-band backend job; the only owner-visible effects are queued emails eventually showing as sent/skipped (verified by the developer) and bookings auto-moving to Executed.

---

## 19. Cross-cutting (file uploads, error states, security headers, health endpoint, back-office language toggle)

*Area: both*

**Prerequisites:** App running at http://localhost:3000. Two seeded logins, both password ChangeMe123!: owner@platform.local (super-admin) and admin@bloomco.example (company admin for "Bloom Co"). For super-admin, after logging in you must pick a company in the top-left switcher before company-scoped screens show data. Have ready on your computer: (a) a real photo JPG/PNG under 8 MB, (b) a very small image, (c) a non-image file such as a PDF or .txt renamed so you can pick it, and (d) ideally one large image over 8 MB (or any large file). A browser that can show the Network/Developer tools (Chrome/Edge: press F12 then the Network tab) is needed only for the security-header and health-header cases; everything else is pure clicking. File uploads in this app accept only image types (JPEG, PNG, WebP, GIF) and silently skip anything else; the per-file size limit is 8 MB. The back-office language toggle is the small English/中文 dropdown at the top-right of every /admin and /planning screen.

#### `XC-01` Health endpoint returns OK JSON  
*Type: happy · Priority: P0*

**Steps:**
1. Open a new browser tab. 2. Go to http://localhost:3000/api/health . 3. Read the text/JSON shown on the page.

**Expected:** Page shows a small JSON object similar to {"status":"ok","service":"web","phase":0,"time":"..."}. The status field is "ok" and time is the current date/time. The page loads instantly without requiring a login.

#### `XC-02` Health endpoint rejects wrong HTTP method  
*Type: negative · Priority: P2*

**Steps:**
1. Open browser Developer tools (F12) on any page, go to the Console tab. 2. Paste and run: fetch('/api/health',{method:'POST'}).then(r=>alert('status '+r.status)) . 3. Read the alert that pops up.

**Expected:** The alert shows status 405 (Method Not Allowed). The health endpoint only answers normal GET page loads, not POST. (A plain browser visit in XC-01 is a GET and works.)

#### `XC-03` Security response headers are present on app pages (KNOWN GAP)  
*Type: security · Priority: P1*

**Steps:**
1. Open Chrome/Edge, press F12, click the Network tab, tick 'Preserve log'. 2. Go to http://localhost:3000/ . 3. In the Network list click the very first request (the document/redirect to /en). 4. Click the Headers sub-tab and read the Response Headers section. 5. Repeat for http://localhost:3000/login .

**Expected:** EXPECTED BEHAVIOUR FOR A SECURE APP: response should carry protective headers such as Content-Security-Policy, X-Frame-Options (or frame-ancestors), X-Content-Type-Options: nosniff, Referrer-Policy, and Strict-Transport-Security. ACTUAL TODAY: none of these are set (the app sends no custom security headers), AND it leaks 'X-Powered-By: Next.js'. Log this as a finding: missing security headers + technology disclosure. The app still functions; this is a hardening gap, not a crash.

#### `XC-04` Back office and planning require login (deep-link is bounced)  
*Type: security · Priority: P0*

**Steps:**
1. Make sure you are logged out (if a back office is showing, click 'Log out' top-right). 2. In the address bar go directly to http://localhost:3000/admin/companies . 3. Observe the page. 4. Now go directly to http://localhost:3000/planning .

**Expected:** Both times you are redirected to the Sign in page. The address bar shows /login?next=%2Fadmin%2Fcompanies (and then next=%2Fplanning), i.e. it remembers where you were heading. No back-office content is ever shown to a logged-out person.

#### `XC-05` Login redirects you back to the page you originally asked for  
*Type: happy · Priority: P1*

**Steps:**
1. While logged out, go to http://localhost:3000/admin/leads . 2. You land on the Sign in page. 3. Enter owner@platform.local / ChangeMe123! and click Sign in. 4. Observe which page opens after sign-in.

**Expected:** After signing in you are taken to /admin/leads (the page you originally requested), not the generic dashboard. The 'next' value carried through login correctly.

#### `XC-06` Tampered/garbage session cookie is treated as logged out  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local. 2. Press F12, open the Application tab (Chrome) > Storage > Cookies > http://localhost:3000 . 3. Find the cookie named ep_session and double-click its Value, replace it with the text not-a-real-token, press Enter. 4. In the address bar reload http://localhost:3000/admin .

**Expected:** You are redirected to /login?next=%2Fadmin instead of seeing the back office. An invalid/forged token never grants access; the app only trusts a properly signed session.

#### `XC-07` Back-office language toggle switches the whole UI to Chinese and back  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as owner@platform.local and pick a company in the top-left switcher. 2. Go to http://localhost:3000/admin/expenses . 3. Note the English labels (e.g. 'New claim', 'Pending approval'). 4. At the top-right, change the small language dropdown from English to 中文. 5. Watch the page. 6. Switch back to English.

**Expected:** Selecting 中文 immediately reloads the page in Chinese: sidebar groups, buttons and labels become Chinese (e.g. 报销, 待审批). No save button is needed — choosing the option submits automatically. Switching back to English restores English. Customer data, numbers and amounts stay unchanged (only the staff UI translates).

#### `XC-08` Language choice persists across pages, reloads and the planning area  
*Type: edge · Priority: P1*

**Steps:**
1. Logged in, set the language dropdown to 中文 on /admin. 2. Navigate to several screens via the sidebar (e.g. Quotations, Calendar, Companies). 3. Do a hard refresh (Ctrl/Cmd+Shift+R). 4. Go to http://localhost:3000/planning . 5. Log out and log back in as the same user.

**Expected:** Chinese stays selected everywhere — across page navigation, after a hard refresh, on the /planning board, and even after logging out and back in (the choice is stored in a one-year cookie, bo_lang). It does not silently reset to English.

#### `XC-09` Portfolio image upload — happy path  
*Type: happy · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example. 2. Go to http://localhost:3000/admin/portfolio . 3. Click the file chooser (the 'Choose files' control next to 'Upload images'). 4. Select one or two real JPG/PNG photos under 8 MB. 5. Click 'Upload images'. 6. Wait for the button to finish (it shows 'Uploading…' while busy).

**Expected:** A green 'Uploaded.' confirmation appears and the new image thumbnail(s) show in the portfolio grid below. Right-clicking a thumbnail and opening it loads from a /api/uploads/<company-id>/... URL. No error text appears.

#### `XC-10` Portfolio upload with no file selected is blocked  
*Type: negative · Priority: P1*

**Steps:**
1. On http://localhost:3000/admin/portfolio , do NOT choose any file. 2. Click 'Upload images'.

**Expected:** The form does not submit because the file field is required — the browser shows a 'Please select a file' style prompt and nothing is uploaded. No image is added and no server error occurs.

#### `XC-11` Non-image file is rejected / silently skipped on upload  
*Type: negative · Priority: P0*

**Steps:**
1. On http://localhost:3000/admin/portfolio click the file chooser. 2. If the picker filters to images, switch its filter to 'All files'. 3. Select a non-image file such as a .pdf or a renamed .txt. 4. Click 'Upload images'. 5. Wait for the result. 6. Repeat the same test on http://localhost:3000/admin/expenses (Step 1 receipt upload) with a PDF.

**Expected:** The non-image file is NOT saved. On portfolio you get the red error 'Upload failed — please try again.' (the only file was rejected as a disallowed type) and no new thumbnail appears. The app only accepts JPEG/PNG/WebP/GIF; other MIME types are dropped. No crash, and existing images are untouched.

#### `XC-12` Oversized file (over 8 MB) is rejected  
*Type: edge · Priority: P1*

**Steps:**
1. On http://localhost:3000/admin/portfolio click the file chooser. 2. Select an image (or any file) larger than 8 MB. 3. Click 'Upload images'. 4. Wait for the result.

**Expected:** The oversized file is not stored. Because it was the only file, you see the red 'Upload failed — please try again.' message and no new image appears in the grid. The 8 MB per-file limit is enforced. If you select one small valid image alongside the oversized one, only the small one is saved.

#### `XC-13` Uploaded files are private and isolated per company (cross-company check)  
*Type: security · Priority: P0*

**Steps:**
1. Log in as owner@platform.local (super-admin). 2. Pick 'Bloom Co' in the company switcher, go to /admin/portfolio, right-click an existing portfolio image and copy its image URL (looks like http://localhost:3000/api/uploads/<bloomco-id>/<random>-name.jpg). 3. Note the company-id segment. 4. Now imagine a second company exists; switch the company in the switcher to a different company and confirm its portfolio shows ONLY its own images, never Bloom Co's. 5. As a stricter check, log out, then in the address bar paste the Bloom Co image URL you copied.

**Expected:** Each company's portfolio screen shows only that company's images — Bloom Co's photos never appear under another company. Files live in a per-company folder (the company-id in the path). NOTE for the owner: the raw /api/uploads/... URL itself is NOT login-protected, so anyone holding the exact random URL can open the file (acceptable for public showcase images, but flag it as a risk for sensitive uploads like payment proofs/receipts). The path itself cannot be tampered to escape a company folder (see XC-14).

#### `XC-14` Upload URL cannot be abused to read other server files (path traversal)  
*Type: security · Priority: P0*

**Steps:**
1. In the address bar try to reach a file outside the uploads area, e.g. http://localhost:3000/api/uploads/some-company/..%2f..%2f..%2fpackage.json . 2. Also try http://localhost:3000/api/uploads/some-company/missing.png (a file that does not exist). 3. Also try http://localhost:3000/api/uploads/ with nothing after it.

**Expected:** None of these expose server files. The traversal attempt returns Bad request / Forbidden / Not found (an error page, never the contents of package.json or any system file). The missing file returns Not found. The empty path does not list any directory. No internal file content is ever shown.

#### `XC-15` Public payment-proof upload validates amount and image  
*Type: negative · Priority: P1*

**Steps:**
1. As staff, open an accepted quotation that has a customer proposal link, and copy that public link (it looks like http://localhost:3000/q/<token>). The customer must have accepted the quote so the 'Submit payment proof' form is visible. 2. Open that link in a private/incognito window (no login). 3. In the payment-proof section, clear the 'Amount paid (RM)' field or type 0 and click 'Submit payment proof'. 4. Then enter a valid positive amount, choose a method, optionally attach a real image as proof, and click submit again.

**Expected:** Step 3 (amount 0 or empty): a red error 'Enter a valid payment amount.' appears and nothing is recorded. Step 4 (valid amount): a green 'Thank you — we've received your payment proof…' confirmation appears. Attaching a non-image as proof results in the proof image being silently skipped while the payment amount is still recorded. The page never requires the customer to log in.

#### `XC-16` Group report CSV export is blocked for non-super-admins and logged-out users  
*Type: security · Priority: P0*

**Steps:**
1. Log in as admin@bloomco.example (company admin, NOT super-admin). 2. In the address bar go to http://localhost:3000/admin/reports/export . 3. Observe. 4. Log out completely. 5. While logged out, go to http://localhost:3000/admin/reports/export again. 6. Finally log in as owner@platform.local (super-admin) and visit the same URL.

**Expected:** Logged out (step 5): you are redirected to the Sign in page (/login?next=...), no CSV is downloaded. Company admin (step 2): you do NOT receive the consolidated group CSV — you get a Forbidden response, because cross-company group reporting is super-admin only. Super-admin (step 6): a file named group-report.csv downloads containing one row per company plus a Total row. Opening it in a spreadsheet shows no formula executes (cells starting with =, +, -, @ are neutralised), confirming CSV-injection protection.

---

## 20. Public quote acceptance + payment proof

*Area: both* · *(Logically belongs after module 6 — the customer-facing quote flow between "Quotations — AI Generation" and "Confirm payment". Appended here because its generator agent failed in the first run.)*

**Prerequisites:**
- A seeded company with a brand colour, bank details (`bankName` / `bankAccountName` / `bankAccountNo`) and ideally a DuitNow QR (`duitnowQrUrl`) configured, plus a company `email` (so change-request / payment-proof email logs are enqueued).
- A quotation in **SENT** status (use **Send proposal** from `/admin/quotations/{id}` — this sets `status = SENT`, stamps `sentAt`, and generates a fresh 6-digit `viewPin`). After sending, the share panel on the quotation detail page shows the public URL `{APP_BASE_URL}/q/{publicToken}` and the **Access code**. Note both.
- For the negative/edge cases you will also need (or will manufacture) quotes in **DRAFT**, **ACCEPTED**, **REJECTED** and **EXPIRED** states for the same or another company.
- A test image under 8 MB (`.jpg`/`.png`/`.webp`/`.gif`), one non-image file (e.g. a `.pdf`), and one image over 8 MB.

#### `PQ-01` Open a sent quote and unlock with the correct access code
*Type: happy · Priority: P0*

**Steps:**
1. Open `http://localhost:3000/q/{publicToken}` in a fresh browser (no cookies for this token).
2. Confirm the gate screen renders: company name, "Your proposal", and a "6-digit access code" input.
3. Type the exact 6-digit access code shown in the admin share panel.
4. Click **View proposal**.

**Expected:** The gate disappears and the full proposal loads — company header, status pill reading "sent", "Prepared for {customer}", any reference/demo images, the formal QUOTATION document (line items, subtotal/SST/total, Deposit and Balance rows), and an **Accept & Proceed to Payment** button plus **Request changes**. A `qv_{token}` cookie is set (HTTP-only, path `/q/{token}`, ~7-day life), so reloading skips the gate.

#### `PQ-02` Accept the quote and proceed to payment
*Type: happy · Priority: P0*

**Steps:**
1. On an unlocked SENT quote, click **Accept & Proceed to Payment**.

**Expected:** Page reloads; status pill now reads "accepted". The Accept/Request-changes controls are gone and a **Pay your deposit** section appears showing the deposit amount (`RM x.xx`), the Bank transfer block (company bank name/account), the DuitNow QR block (image if configured, else "QR not configured."), and a payment-proof form pre-filled with the deposit amount. A `Booking` (status CONFIRMED) is created and the linked lead, if any, moves to status ACCEPTED.

#### `PQ-03` Submit a payment proof via DuitNow QR
*Type: happy · Priority: P0*

**Steps:**
1. On an ACCEPTED quote, in **Pay your deposit**, leave **Amount paid (RM)** at the suggested deposit value.
2. Leave **Method** as "DuitNow QR".
3. Enter a reference, e.g. `TXN-DUITNOW-001`.
4. Choose a valid image under 8 MB for **Payment proof (screenshot/receipt)**.
5. Click **Submit payment proof** (button shows "Uploading…" while pending).

**Expected:** Form is replaced by the green confirmation "Thank you — we've received your payment proof and will confirm shortly." A `Payment` record (type DEPOSIT, method DUITNOW_QR, status PENDING) is created with a linked PAYMENT_PROOF attachment, and a `payment_proof_received` email log is queued for the company. Reloading the page lists the payment under the deposit section as `RM x.xx · duitnow_qr — pending`.

#### `PQ-04` Submit a payment proof via Bank transfer without an attachment
*Type: edge · Priority: P1*

**Steps:**
1. On an ACCEPTED quote, set **Method** to "Bank transfer", enter an amount and reference, but attach **no** file.
2. Click **Submit payment proof**.

**Expected:** Submission still succeeds (the proof file is optional). A PENDING Payment (method BANK_TRANSFER) is recorded with no attachment, and the green confirmation appears.

#### `PQ-05` Request changes with a comment and inspiration photos
*Type: happy · Priority: P1*

**Steps:**
1. On an unlocked SENT quote (not yet accepted), click **Request changes**.
2. In the expanded form, type a comment, e.g. "More greenery, blush-and-gold palette".
3. Attach one or two valid images (multiple allowed).
4. Click **Send change request**.

**Expected:** Form is replaced by the green "Thanks! Your requested changes were sent to our team…" message. The quotation's `customerFeedback` is stored, `changesRequested` flips true, `revisionCount` increments, the linked lead moves to REVIEWING, the images are saved as REFERENCE attachments, and a `changes_requested` email log is queued. On reload, the accept/request controls are replaced by the amber "we've received your change request…" banner.

#### `PQ-06` Request changes with an empty comment
*Type: negative · Priority: P2*

**Steps:**
1. Open the **Request changes** form on a SENT quote.
2. Submit with the comment box left blank (bypass the HTML `required` if needed, e.g. only whitespace).

**Expected:** Server rejects with the inline red error "Please tell us what you'd like changed." No feedback is stored and `changesRequested` stays false.

#### `PQ-07` Wrong access code is rejected
*Type: security · Priority: P0*

**Steps:**
1. Open `http://localhost:3000/q/{publicToken}` with no existing cookie for the token.
2. Enter an incorrect 6-digit code (e.g. `000000`).
3. Click **View proposal**.

**Expected:** The gate stays up with the red error "Incorrect access code." No `qv_{token}` cookie is set and the proposal contents are never rendered. **Fixed:** after 8 wrong attempts the gate locks with "Too many attempts. Try again in N minute(s)." and the compare is constant-time (see `FV-08`).

#### `PQ-08` Invalid / non-existent token returns 404
*Type: negative · Priority: P0*

**Steps:**
1. Navigate to `http://localhost:3000/q/not-a-real-token`.

**Expected:** Next.js 404 (not-found) page — the route never exposes any quote data for an unknown token. (If a token exists but the unlock action is hit for a non-existent token, it returns "This link is invalid.")

#### `PQ-09` Accepting an already-accepted quote is a no-op on data
*Type: edge · Priority: P1*

**Steps:**
1. Open an ACCEPTED quote's public link (unlocked).
2. Confirm the **Accept & Proceed to Payment** button is not shown (only the **Pay your deposit** section is).
3. If you reach `acceptQuoteAction` again (e.g. re-POST the accept form via the token), observe the result.

**Expected:** The UI offers no second accept path. **Fixed:** accept is now transactional + idempotent — a conditional claim (status must be SENT) means a double-click or replay creates exactly one booking, no 500, no forked state (see `FV-10`).

#### `PQ-10` Draft quote shows placeholder, cannot be accepted
*Type: edge · Priority: P1*

**Steps:**
1. Take a quote in DRAFT status (note: a DRAFT typically has no `viewPin`, so the gate is skipped) and open its `/q/{publicToken}` link.

**Expected:** No accept/payment UI. The page shows "This quotation is still being prepared. Please check back soon." `acceptQuoteAction` short-circuits for DRAFT (returns immediately), so no booking is created even if the action is invoked directly.

#### `PQ-11` Rejected / expired quote cannot be accepted or paid
*Type: edge · Priority: P1*

**Steps:**
1. Open the public link of a quote whose status is REJECTED, then repeat for one that is EXPIRED.

**Expected:** The status pill reads "rejected" / "expired". The accept/request UI renders only for `SENT` and payment only for `ACCEPTED`. **Fixed:** the server now also enforces this — `acceptQuoteAction` only acts when status is SENT (and not past `validUntil`), so a replayed request on a rejected/expired quote is a no-op (see `FV-09`/`FV-13`).

#### `PQ-12` Tampering with the payment amount
*Type: security · Priority: P1*

**Steps:**
1. On an ACCEPTED quote, change **Amount paid (RM)** to a value far below the deposit (e.g. `1.00`), or edit the field's value in dev tools to a huge number.
2. Submit the proof.

**Expected (fixed):** An amount **above the outstanding balance** is now **rejected** with "Amount exceeds the outstanding balance (RM …)." A valid amount (≤ balance) is recorded as a PENDING Payment for staff to verify. Payment is only accepted on an ACCEPTED quote (see `FV-11`/`FV-12`).

#### `PQ-13` Invalid payment amount is rejected
*Type: negative · Priority: P1*

**Steps:**
1. On an ACCEPTED quote, set **Amount paid (RM)** to `0` (or a non-numeric/empty value via dev tools) and submit.

**Expected:** Inline red error "Enter a valid payment amount." No `Payment` row is created. (Submitting a proof before any booking exists returns "Please accept the quote first.")

#### `PQ-14` Oversized or wrong-type file upload is silently dropped
*Type: security · Priority: P1*

**Steps:**
1. On an ACCEPTED quote, attach a non-image file (e.g. a `.pdf`) as the payment proof, or an image larger than 8 MB, then submit. (The input uses `accept="image/*"`, so rename a file or use dev tools to bypass the client filter.)
2. Repeat on the **Request changes** image upload.

**Expected:** The action does not error. `saveUpload` rejects files over 8 MB or outside jpeg/png/webp/gif, so no attachment is stored; the Payment is still created without a proof. **Fixed:** a blank/missing Content-Type is now also rejected (the old `file.type &&` bypass is gone), the stored extension is derived from the verified MIME, and files serve with `nosniff` (see `FV-20`).

---
