# Event & Decoration Platform (Malaysia)

Multi-company platform for an event & decoration business:

- **Bespoke 3D customer websites** — one per company, each on its own custom domain.
- **One Back Office** — group super-admin sees all companies + consolidated reports; per-company staff are scoped to their company.
- **AI planning & smart quotation** — reads customer reference images, drafts an event plan, an analyzed materials list, clarifying questions, and ready-to-price quotation lines (you set profit %).
- **Quotation → payment → invoice** — manual deposit (DuitNow QR / bank transfer + proof), then auto-issued invoices with per-company branding, numbering, and SST.
- **Event planning dashboard** — calendar, checklists, suppliers, inventory, run-sheet, budget, and event locations.

## Stack

| Layer | Tech |
|-------|------|
| Frontend + backend | Next.js (App Router, TypeScript) |
| 3D / motion | React Three Fiber, GSAP/Framer (from Phase 4) |
| i18n | next-intl — EN / Bahasa Malaysia / 中文 |
| Database | PostgreSQL + Prisma (from Phase 1) |
| Auth | Auth.js credentials + RBAC (from Phase 2) |
| Jobs | BullMQ + Redis (from Phase 10) |
| Storage | MinIO (S3-compatible) |
| AI | OpenAI (pluggable) — from Phase 6 |
| Reverse proxy | Caddy (automatic HTTPS per custom domain) |
| Deploy | Docker Compose (self-hosted) |

## Repository layout

```
event-platform/
  apps/
    web/         # Next.js — customer sites + /admin (BO) + /planning
    worker/      # Background jobs (BullMQ) — Phase 10
  packages/
    db/          # Prisma schema + tenant-scoped data layer — Phase 1
    ui/          # Shared UI + 3D components — Phase 4+
  infra/
    docker-compose.yml   # Postgres, Redis, MinIO, Caddy
    Caddyfile            # Per-company custom domains + auto-HTTPS
  BUILD_LOG.md   # Running build log — check here for progress
```

## Local development

```bash
npm install          # install all workspaces
npm run dev          # start the Next.js app on http://localhost:3000
npm run worker:dev   # (optional) start the background worker
```

Health check: `GET http://localhost:3000/api/health`

> **Docker** is required to run Postgres/Redis/MinIO/Caddy (used from Phase 1
> onward). Install Docker Desktop, then:
> `cd infra && docker compose up -d postgres redis minio`

## Build status

See [BUILD_LOG.md](./BUILD_LOG.md) for phase-by-phase progress.
