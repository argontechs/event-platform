# Product

## Register

brand

## Surfaces (register overrides)

Both surfaces carry equal weight. Pick register by the surface being worked on:

- **Public per-company customer sites** (`/[locale]`, `/q/<token>` quote pages, lead/enquiry form): **brand** — design IS the product. This is what convinces a customer to trust a company with their wedding or event.
- **Back office** (`/admin`, `/planning`): **product** — design serves staff workflows (leads, quotations, bookings, invoices, planning).

## Users

Two distinct audiences:

1. **Event customers (Malaysia)** — people planning weddings, tea ceremonies, birthdays, and corporate events. Mostly on mobile, often referred via WhatsApp/Instagram. They browse a company's site (portfolio, packages, prices in RM), submit an enquiry with reference images, later open a quote link, accept, and pay a deposit (DuitNow QR / bank transfer). High emotional stakes: this is their big day.
2. **Staff** — super-admin (group-wide, switches companies), company admins, sales, and planners. Desktop-first back office, used daily: lead → AI/manual quotation → payment confirmation → invoice → event planning (checklists, run-sheets, suppliers, budget).

## Product Purpose

Multi-tenant platform running several event & decoration companies from one system. Each company gets its own branded 3D website on its own domain; all share one back office, billing (SST, MYR), and planning pipeline. Success looks like: site visitors convert to enquiries, enquiries convert to accepted quotes and paid deposits, and staff run events end-to-end without spreadsheets.

## Brand Personality

Magical, premium, warm. The public sites should evoke "they can make my event unforgettable" (spectacle) backed by "safe hands, worth the price" (trust). Celebratory confidence without gimmicks; elegance with a personal touch. Not playful/party-store energy — festive is delivered through imagery of real events, not loud UI.

## Anti-references

- **Generic AI/SaaS template** — gradient-text heroes, identical icon-card grids, stock startup look.
- **Cheap party-store** — clip-art balloons, loud primary colors, bargain-bin feel.
- **Corporate & sterile** — stocky photos, navy-suit agency tone, no personality.
- **Cluttered directory** — dense listings, ad-like layouts, information overload.

## Design Principles

1. **Show the work, not the words** — real event photos and 3D scenes sell; portfolio evidence over marketing claims.
2. **Per-company identity is sacred** — each tenant's colors/logo/fonts carry through site, quotes, and invoices; the platform never overshadows the company.
3. **One clear next step** — every customer page drives toward enquiry → quote → payment; every back-office screen has one primary task.
4. **Premium is restraint** — elegance from typography, spacing, and imagery, not from stacking effects.
5. **Trust at money moments** — quotes, deposits, and invoices need clarity and reassurance (line items, SST, proof upload, reference numbers) more than flair.

## Accessibility & Inclusion

- WCAG 2.1 AA as the baseline (contrast ≥4.5:1 body text).
- Trilingual: EN / Bahasa Malaysia / 中文 — layouts must survive longer Malay strings and CJK line-breaking; fonts must cover Chinese.
- `prefers-reduced-motion` respected on all animation (already established in globals.css).
- Customer surface is mobile-first; back office keyboard-friendly for daily staff use.
