# System Documentation — Event & Decoration Platform

Complete technical reference so anyone can understand, run, and deploy this system.
Companion docs: **README.md** (quick start), **HANDBOOK.md** (operator guide),
**DEPLOY.md** (go-live runbook), **BUILD_LOG.md** (build history).

---

## 1. Overview
A **multi-tenant** platform for an events & decoration business operating multiple
companies. Each company gets a branded, trilingual, 3D marketing site on its own
domain; all companies are managed from **one back office** with a group super-admin
and per-company staff. Core capabilities:

- Public 3D sites (EN / Bahasa Malaysia / 中文) with a multi-step enquiry form.
- Leads → **AI-assisted or manual** quotations (cost → profit% → SST → deposit).
- Public quote acceptance → manual deposit (DuitNow/bank) + proof → **invoice**.
- Planning dashboard (locations, checklist, suppliers, run-sheet, budget).
- Group consolidated reporting + CSV.
- Background worker for emails/reminders.

## 2. Tech stack
| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS v3 + CSS custom properties (per-company brand tokens) |
| 3D | three.js + @react-three/fiber (lazy, client-only, reduced-motion fallback) |
| i18n | Locale-prefixed routes + JSON dictionaries (`src/lib/i18n`) |
| DB / ORM | PostgreSQL + Prisma 6 |
| Auth | Custom JWT sessions (`jose`) in an httpOnly cookie + bcrypt |
| AI | OpenAI Chat Completions (vision) via `fetch` (no SDK) |
| Jobs | Standalone Node worker polling Postgres (nodemailer for email) |
| Storage | Local-disk adapter (`src/lib/storage.ts`), swappable for S3/MinIO |
| Proxy/TLS | Caddy (automatic HTTPS per custom domain) |
| Runtime/deploy | Docker Compose (self-hosted) |

## 3. Repository structure
```
event-platform/
├─ apps/
│  ├─ web/                      # Next.js app (sites + back office + planning + API)
│  │  ├─ src/app/
│  │  │  ├─ page.tsx            # → redirects to default locale
│  │  │  ├─ [locale]/           # PUBLIC company site (home/services/portfolio/about/contact)
│  │  │  ├─ q/[token]/          # PUBLIC tokenised quote page
│  │  │  ├─ login/              # staff login
│  │  │  ├─ admin/              # BACK OFFICE (companies, leads, quotations,
│  │  │  │                      #   bookings, invoices, reports, handbook)
│  │  │  ├─ planning/           # PLANNING dashboard (events, locations, board)
│  │  │  └─ api/                # health, uploads serving
│  │  ├─ src/components/        # site/ admin/ planning/ UI
│  │  ├─ src/lib/               # auth, tenant, companies, leads, quotations,
│  │  │                         #   quotes, bookings, planning, ai, reports,
│  │  │                         #   i18n, storage, crypto
│  │  └─ src/middleware.ts      # protects /admin + /planning
│  └─ worker/                   # background jobs (emails, reminders, sweeps)
├─ packages/
│  ├─ db/                       # Prisma schema + client singleton + seed
│  └─ ui/                       # (reserved) shared UI
├─ infra/                       # docker-compose.yml, Caddyfile
├─ docs/ARCHITECTURE.md         # this file
├─ README.md HANDBOOK.md DEPLOY.md BUILD_LOG.md
```

## 4. Multi-tenancy model
- Every business row carries a **`companyId`**. (`Company` is the tenant.)
- **Public sites** resolve their tenant by **hostname** → `getCompanyByHost()`
  (`src/lib/tenant.ts`) matches `Company.customDomains`.
- **Back office** scoping (`getActiveCompanyId()`):
  - company users → always their own `companyId`;
  - super-admin → the company chosen in the **switcher** (cookie), or "group" view.
- Every detail action re-checks access (`isSuperAdmin(user) || user.companyId === row.companyId`).

## 5. Auth (`src/lib/auth`)
- `session.ts` — signs/verifies a JWT (`jose`, HS256) stored in the `ep_session`
  httpOnly cookie; payload = `{id,email,name,role,companyId}`.
- `password.ts` — bcrypt hash/verify.
- `rbac.ts` — `requireUser`, `requireRole`, `requireSuperAdmin`, `canManageCompany`.
- `middleware.ts` — verifies the cookie for `/admin/*` and `/planning/*`.
- Roles: `SUPER_ADMIN`, `COMPANY_ADMIN`, `SALES`, `PLANNER`.

## 6. Data model (Prisma — `packages/db/prisma/schema.prisma`)
Key entities and relations:
- **Company** → users, customers, leads, quotations, bookings, invoices, payments,
  locations, suppliers, inventory, planningTasks, runSheet, attachments, aiDrafts,
  checklistTemplates. Holds branding, **SST (registered+rate)**, bank/DuitNow,
  **defaultProfitPercent/DepositPercent**, quote/invoice number sequences,
  `customDomains[]`, encrypted `aiApiKeyEnc`.
- **User** — role + optional `companyId` (null for super-admin).
- **Lead** — enquiry (eventType/date/time, venue, theme, budget, purpose,
  specialRequest, reference no.) + `Attachment[]` (reference images) + `AiDraft[]`.
- **AiDraft** — AI plan, materials (JSON), questions (JSON), token usage.
- **Quotation** + **QuotationItem** — costing (`costPrice`, `profitPercent`,
  `unitPrice`, `lineTotal`), `sstApplied`/`sstRate`, deposit, `publicToken`.
- **Booking** — created on quote acceptance (or manually in planning;
  `quotationId` is optional). Totals + balance; links Location.
- **Invoice** — issued on payment confirm; per-company numbering; JSON snapshots of
  items + customer; SST snapshot.
- **Payment** — deposit/balance, method, proof attachment, status.
- **Location, Supplier, BookingSupplier, InventoryItem, InventoryAllocation,
  PlanningTask, RunSheetEntry, ChecklistTemplate** — planning.
- **EmailLog, AuditLog** — ops.
> Money = `Decimal(12,2)`; rates/percent = `Decimal(5,2)`; arrays/JSON are
> Postgres-native. Enums are used throughout.

## 7. Key flows → where the code lives
| Flow | Files |
|---|---|
| Public 3D site + i18n | `app/[locale]/*`, `components/site/*`, `lib/i18n/*` |
| Enquiry → Lead | `components/site/enquiry-form.tsx`, `lib/leads/*`, `lib/storage.ts` |
| AI / manual quotation | `app/admin/quotations/*`, `components/admin/quotation-editor.tsx`, `lib/quotations/*`, `lib/ai/*` |
| Pricing math | `lib/quotations/calc.ts` (+ `calc.test.ts`) |
| Public quote → pay | `app/q/[token]/page.tsx`, `lib/quotes/public-actions.ts`, `components/site/payment-proof-form.tsx` |
| Confirm payment → booking + invoice | `lib/bookings/actions.ts`, `app/admin/bookings/*`, `app/admin/invoices/*` |
| Planning + locations | `app/planning/*`, `lib/planning/actions.ts`, `components/planning/*` |
| Group reports | `app/admin/reports/*`, `lib/reports/group.ts` |
| Companies (settings) | `app/admin/companies/*`, `lib/companies/*`, `lib/crypto.ts` |
| Worker jobs | `apps/worker/src/*` |

## 8. Environment variables (`.env`)
| Var | Used for |
|---|---|
| `DATABASE_URL` | Postgres connection (Prisma) |
| `AUTH_SECRET` | JWT signing — required |
| `APP_ENCRYPTION_KEY` | AES-256-GCM key for per-company AI keys (base64, 32 bytes) |
| `OPENAI_API_KEY` | OpenAI AI fallback (per-company key preferred) |
| `OPENAI_MODEL` | unused — model comes from per-company settings (`Company.aiModel`) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | worker email sending (optional) |
| `S3_*` | object storage (when MinIO/S3 adapter is used) |
| `UPLOAD_DIR` | local-disk upload root (default `<cwd>/uploads`) |
| `LOG_LEVEL` | pino level |

## 9. Local development
```bash
npm install
# Provide a Postgres DATABASE_URL in .env (native install, container, or cloud)
npm run -w @event/db generate
npm run -w @event/db migrate          # prisma migrate dev
npm run -w @event/db seed             # demo company + super-admin
npm run dev                           # http://localhost:3000
npm run worker:dev                    # (optional) background worker
```
- Health: `GET /api/health`. Back office: `/admin` (after login). Public site: `/en`.
- On `localhost` the public site falls back to the first active company (no domain match).

## 10. Testing & quality
- `npm run test -w web` — Vitest (pricing math covered; extend per module).
- `npm run typecheck -w web` and `npm run typecheck -w worker`.
- `npm run build` — production build (also the per-phase verification gate).

## 11. Deployment
See **DEPLOY.md**. Summary: configure `.env`, set domains in `infra/Caddyfile`,
`docker compose up -d postgres redis minio`, `prisma migrate deploy`, seed, then
`docker compose up -d --build web worker caddy`. Caddy issues HTTPS per domain.

## 12. Conventions & extension seams
- Server Actions for mutations; zod validation at boundaries; `revalidatePath` after writes.
- Immutable updates; small focused modules; tenant check on every entity action.
- **Seams (no rework):** payment gateway (Billplz/ToyyibPay) beside the manual flow;
  LHDN MyInvois e-Invoice at invoice issuance (`lib/bookings/actions.ts`); swap
  `lib/storage.ts` to S3/MinIO; add Redis/BullMQ if job volume grows.

## 13. Troubleshooting
- **Pages error locally** → no reachable `DATABASE_URL` (start Postgres + migrate).
- **AI button errors** → no OpenAI key on the company or `OPENAI_API_KEY`.
- **Public site shows fallback brand** → hostname doesn't match any `customDomains`
  (expected on `localhost`).
- **Emails not sending** → SMTP not configured; the worker marks them `skipped`.
