# Security — penetration test remediation & go-live checklist

Last reviewed: 2026-06-26. A full code+security review and an 11-category penetration
test were performed; all code-level findings were remediated. This file is the
operator's pre-production checklist for the remaining **deployment/config** items
that cannot be fixed in code.

## Remediated in code (no action needed)

- **Public-endpoint rate limiting** — enquiry form, lead-photo upload, quote
  request-changes / payment-proof are throttled; lead & quote PINs use
  constant-time compare with lockout.
- **Quote PIN gate enforced on mutations** — accept / pay / request-changes now
  require the access code (cookie), not just the link token.
- **Uploads serve route fails closed** — payment proofs / receipts (and any file
  not provably public) require a staff session of the owning company.
- **Vertical privilege escalation closed** — PLANNER can no longer invoke
  sales/finance server actions (quotations, invoices, confirm-payment, packages,
  portfolio, WhatsApp).
- **Stored CSS injection** — brand colour / font fields are validated.
- **Login lockout** — keyed per-email as well as per-IP (X-Forwarded-For can't be
  spoofed to bypass it).
- **Session invalidation** — a `tokenVersion` is embedded in the JWT and bumped on
  password reset, so a reset immediately invalidates all of that user's sessions.
- **Security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy; `X-Powered-By` disabled (`next.config.mjs`).
  HSTS also set at the edge (`infra/Caddyfile`).
- **Financial input hardening** — finite/upper bounds on invoice/expense/petty-cash
  amounts; petty-cash approval uses a serializable transaction; AI image cost
  counted correctly.

## ⚠️ Required before go-live (operator / deployment)

1. **Serve over HTTPS.** Caddy issues TLS automatically (`infra/Caddyfile`). The
   session cookie only gets the `Secure` flag in production — do **NOT** set
   `COOKIE_SECURE=false` in the production `.env` (the sample `.env` uses plain
   HTTP for local testing only). Use an `https://…` `APP_BASE_URL`.
2. **Rotate all secrets.** Set strong random `AUTH_SECRET` (`openssl rand -base64 48`)
   and `APP_ENCRYPTION_KEY` (`openssl rand -base64 32`). Never run on the dev
   fallback secret.
3. **Change every seeded password.** The demo seed creates accounts with
   `ChangeMe123!` (incl. the super-admin) and is for local/demo use only. In
   production, change them immediately (Staff → Reset password) or don't seed.
4. **Set `WHATSAPP_APP_SECRET`** if using WhatsApp — the inbound webhook fails
   closed (403) without it.
5. **Update dependencies** with known CVEs before release:
   - `nodemailer` 6.10.1 → ≥ 7 (runtime; review send API)
   - `postcss` 8.4.31 → ≥ 8.5.10
   - dev-only: `vite` / `vitest` / `esbuild` (bump at convenience)
6. **Rate limiting is per-process (in-memory).** Fine for a single instance; if you
   run multiple app instances, move the limiter (`apps/web/src/lib/rate-limit.ts`)
   to Redis/Postgres so limits are shared.
7. **Consider a managed object store** for uploads at scale (the local-disk volume
   works, but swap `lib/storage.ts` to S3/MinIO for redundancy).

## Re-running the checks

- Unit + Playwright: `npm run test -w web` and `cd apps/web && npx playwright test`
- SAST / secrets / deps: `semgrep scan --config p/security-audit .`,
  `gitleaks detect --source . --no-git`, `osv-scanner scan --lockfile package-lock.json`
