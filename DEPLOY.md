# Deployment & Operations Runbook

Self-hosted via Docker Compose (Postgres · Redis · MinIO · Caddy · web · worker).
This is the **final infra step** — run it on your server once you're ready.

## 1. Prerequisites
- A Linux server with Docker + Docker Compose.
- Your company domain(s) pointed (A record) at the server's IP.

## 2. Configure env
```bash
cp .env.example .env
# Edit .env — set at minimum:
#   AUTH_SECRET           (openssl rand -base64 48)
#   APP_ENCRYPTION_KEY    (openssl rand -base64 32)  ← encrypts per-company AI keys
#   DATABASE_URL=postgresql://eventapp:eventapp@postgres:5432/eventapp?schema=public
#   REDIS_URL, S3_* (MinIO), SMTP_* (email), OPENAI_API_KEY and/or ANTHROPIC_API_KEY (dev AI fallbacks)
```
> Inside Docker, host is `postgres` / `minio` (service names), not `localhost`.

## 3. Domains
Edit `infra/Caddyfile` — replace the example domains with your real company
domains and the admin domain. Caddy issues HTTPS automatically.

## 4. Bring it up
```bash
cd infra
docker compose up -d postgres redis minio       # data services
docker compose run --rm web npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
docker compose run --rm web npm run seed -w @event/db   # optional demo data
docker compose up -d --build web worker caddy   # app + proxy
```

## 5. Verify
- `https://admin.yourdomain` → back office login (seeded super-admin: `owner@platform.local` / `ChangeMe123!` — change immediately).
- `https://<company-domain>` → that company's 3D site.
- `docker compose logs -f web worker` → structured pino logs.

## 6. First-run checklist
- [ ] Change seeded passwords.
- [ ] Create your companies (Back office → Companies) with branding, bank, DuitNow QR, SST, AI key, custom domains.
- [ ] Add each new domain to `infra/Caddyfile` and `docker compose restart caddy`.

---

## Onboarding a NEW company
1. Back office (super-admin) → **Companies → New company**: fill branding, SST, bank, DuitNow QR, default profit %, invoice/quote prefixes, AI key, and the **custom domain(s)**.
2. Point the new domain's DNS at the server.
3. Add a site block for it in `infra/Caddyfile`, then `docker compose restart caddy`.
4. (Bespoke design) build that company's site variant if it needs a distinct layout — it plugs into the same backend with no rework.

---

## Notes / future seams (no rework needed)
- **Payments gateway** (Billplz/ToyyibPay): add alongside the manual deposit flow.
- **LHDN MyInvois (e-Invoice)**: hook into invoice issuance in `lib/bookings/actions.ts`.
- **Storage**: swap the local-disk adapter in `lib/storage.ts` for MinIO/S3.
- **Queues**: the worker currently polls Postgres; Redis/BullMQ can be added if volume grows.
