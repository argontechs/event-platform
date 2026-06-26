# Quickstart — Event & Decoration Platform

Get it running in ~5 minutes. For deeper detail see `docs/ARCHITECTURE.md`
(technical), `HANDBOOK.md` (how to operate it) and `DEPLOY.md` (production).

## Prerequisites
- **Node.js 20+** and npm
- A **PostgreSQL** database (pick one option in step 2)

## 1. Install
```bash
cd event-platform
npm install
```

## 2. Get a database (choose one)

**A — Native PostgreSQL (no Docker)**
Install PostgreSQL 17 from https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
(port `5432`, remember the `postgres` password), then use:
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/eventapp?schema=public
```

**B — Docker (just the database)**
```bash
docker run -d --name eventpg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=eventapp -p 5432:5432 postgres:17-alpine
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eventapp?schema=public
```

**C — Free cloud (Neon)**
Create a database at https://neon.tech and copy its connection string into `DATABASE_URL`.

## 3. Configure environment
```bash
cp .env.example .env
```
Then set in `.env`:
- `DATABASE_URL` — from step 2
- `AUTH_SECRET` — any long random string (`openssl rand -base64 48`)
- `APP_ENCRYPTION_KEY` — 32-byte base64 (`openssl rand -base64 32`) — encrypts per-company AI keys
- `OPENAI_API_KEY` — optional (only needed for AI quoting; manual quoting works without it)

> On Windows PowerShell, generate secrets with:
> ```powershell
> $r=[System.Security.Cryptography.RandomNumberGenerator]::Create()
> $b=New-Object byte[] 48; $r.GetBytes($b); [Convert]::ToBase64String($b)
> ```

## 4. Create tables + demo data
```bash
npm run -w @event/db generate
npm run -w @event/db migrate     # creates the database tables
npm run -w @event/db seed        # demo company + super-admin + sample data
```

## 5. Run
```bash
npm run dev          # app on http://localhost:3000
npm run worker:dev   # (optional) background emails/reminders
```

## First login (from the seed)
- Super-admin: **owner@platform.local** / **ChangeMe123!**
- Company admin: **admin@bloomco.example** / **ChangeMe123!**

Back office: `http://localhost:3000/admin` · Public site: `http://localhost:3000/en`
(on `localhost` the public site uses the first seeded company since there's no domain match).

## Try the full flow
1. Public site `/en` → **Plan your event** → submit the enquiry form.
2. Back office → **Leads** → open it → **Create quotation** → add lines (or **Generate with AI** if you set an OpenAI key) → **Mark as sent**.
3. Open the quote's public link → **Accept** → upload a payment proof.
4. Back office → **Bookings** → **Confirm payment** → an **Invoice** is issued + the event appears in **Planning**.
5. **Planning** → open the event → tick checklist, add suppliers/run-sheet; manage **Locations**.
6. Super-admin → **Group reports** for consolidated numbers.

## Useful commands
```bash
npm run build            # production build
npm run test -w web      # unit tests (pricing math)
npm run typecheck -w web # type checking
```

## Troubleshooting
- **Pages error / can't connect** → `DATABASE_URL` wrong or DB not running; redo step 2–4.
- **AI button errors** → no OpenAI key on the company (Companies → edit) or `OPENAI_API_KEY` in `.env`.
- **Public site shows generic brand on localhost** → expected (no custom-domain match locally).
- **Emails not sending** → SMTP not set in `.env`; the worker safely marks them skipped.
