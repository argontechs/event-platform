---
name: Event & Decoration Platform
description: Per-tenant 3D event sites on a dark glowing stage, with a crisp light back office and white A4 documents.
colors:
  celebration-blue: "#2f6fed"
  deep-royal: "#0e3a8a"
  evening-navy: "#060c1c"
  moonlight: "#eef3ff"
  sky-glow: "#7cc0ff"
  sidebar-navy: "#0c1c44"
  admin-canvas: "#f1f5f9"
  admin-surface: "#ffffff"
  admin-ink: "#0f172a"
  admin-border: "#e2e8f0"
typography:
  display:
    fontFamily: "Roxborough CF, Georgia, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.04em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(2.5rem, 1rem + 6vw, 5.5rem)"
    fontWeight: 600
    lineHeight: 1.02
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.35em"
rounded:
  control: "6px"
  media: "8px"
  panel: "12px"
  card: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.celebration-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "rgba(255,255,255,0.9)"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  card-glass:
    backgroundColor: "rgba(255,255,255,0.03)"
    textColor: "{colors.moonlight}"
    rounded: "{rounded.card}"
    padding: "24px"
  button-admin:
    backgroundColor: "{colors.celebration-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input-admin:
    backgroundColor: "{colors.admin-surface}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: Event & Decoration Platform

## 1. Overview

**Creative North Star: "The Venue at Dusk"**

The public sites feel like stepping into a beautifully lit event hall just before guests arrive: a deep evening-navy room (#060c1c) washed with soft blue radial light, glass surfaces that catch a glow on touch, and a 3D centerpiece slowly turning under the lights. The magic is anticipation, not noise. Each tenant company brings its own spotlight: `--brand` and `--brand-2` CSS variables re-skin every call-to-action, focus ring, and gradient wash per company, so the platform recedes and the company's identity carries the room.

Behind the ballroom is the backstage: the back office is a separate, deliberately unglamorous light system (slate-on-white, one deep navy sidebar #0c1c44) built for daily lead-to-invoice work. The third world is paper: quotations and invoices render as white A4 documents with a Roxborough CF serif title, presented on the dark public quote page like a lit sheet of paper on a stage table.

This system explicitly rejects the generic AI/SaaS template look (gradient-text heroes, identical icon-card grids), cheap party-store energy (clip-art, loud primaries), corporate sterility, and cluttered directory layouts.

**Key Characteristics:**
- Dark, cinematic customer surfaces; light, utilitarian staff surfaces; white printable documents.
- One tenant spotlight color drives all action states via CSS variables.
- Depth from light (glows) on the public site; depth from borders (flat) in admin.
- Translucent white-opacity ladder (`bg-white/[0.03]`, `border-white/10`, `text-white/60`) instead of gray scales on dark.
- Motion is staged: fade-up reveals with expo easing, floating accents, 3D hero; all honor `prefers-reduced-motion`.

## 2. Colors: The Evening Navy / Celebration Blue Palette

A dark stage lit by one tenant-configurable spotlight, with a separate daylight palette backstage.

### Primary
- **Celebration Blue** (#2f6fed): the default tenant spotlight. Every public CTA, active pill, stepper state, and input focus uses `var(--brand)` with this as fallback. In admin it is the `accent` token on primary buttons, links, and focus borders.

### Secondary
- **Deep Royal** (#0e3a8a): the default `--brand-2`. Only appears inside `color-mix()` gradient washes and ambient background light; never on text or controls.

### Neutral
- **Evening Navy** (#060c1c): the public page background, always under two blue radial gradients. Never used flat.
- **Moonlight** (#eef3ff): public body text at full strength; dimmed via white-opacity utilities (`text-white/75` body, `/60` secondary, `/40` small print).
- **Sky Glow** (#7cc0ff): hover border tint on glowing cards and eyebrow text (`text-sky-300`).
- **White-opacity ladder**: surfaces `bg-white/[0.02–0.05]`, borders `border-white/10–15`, hovers `bg-white/10`. This ladder IS the dark-theme neutral scale; there are no gray hexes on the public site.
- **Admin slate family**: canvas #f1f5f9 (`slate-100`), surfaces white, ink #0f172a (`slate-900`), borders #e2e8f0 (`slate-200`), muted text `slate-500/600`. Status badges use tonal pairs: emerald (paid/success), blue (sent/quoted), amber (pending), red (error/lost) in `-100` background / `-700` text.

### Named Rules
**The Tenant Spotlight Rule.** Never hardcode Celebration Blue on a customer-facing surface. Actions use `var(--brand)`, ambience uses `color-mix(in oklab, var(--brand) N%, transparent)`. A company with a rose or gold brand must re-skin completely with zero code changes.

**The Two Rooms Rule.** The ballroom (dark public) and the backstage (light admin) never blend. A light slate input on a dark customer page is a defect, not a variation.

**The White Paper Rule.** Money documents (quotes, invoices) always render as white paper: on screen inside `rounded-xl shadow-2xl` on the dark stage, and in print as clean A4 with zero app chrome.

**The Signature Gradient Exception.** The animated blue-violet gradient headline (`.gradient-text`, #7cc0ff → #a78bfa) is a deliberate Party Eventilicious identity choice (owner decision, 2026-07-02), kept despite the general gradient-text ban. It is an exception, not a pattern: do not add new gradient-clipped text elsewhere, and the treatment must eventually route through `var(--brand)` so other tenants don't inherit Party Eventilicious blue-violet.

## 3. Typography

**Display Font:** Roxborough CF (with Georgia, serif fallback) — print documents only today
**Body Font:** System sans stack (`ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`)
**Document Body:** Inter (loaded via `next/font`, used inside A4 documents)

**Character:** The screen voice is a clean, anonymous sans that lets imagery, light, and the tenant's brand carry personality; the serif appears exactly where ceremony matters, on the printed quotation and invoice, like a letterhead.

### Hierarchy
- **Display** (Roxborough 400, ~30px, 0.04em tracking): document titles ("QUOTATION", "INVOICE") and the closing "Thank you for your business." line on A4 documents.
- **Headline** (600, `clamp(2.5rem, 1rem+6vw, 5.5rem)`, line-height 1.02): the hero title only.
- **Title** (600, 30–48px): page H1s (`text-4xl sm:text-5xl`) and section H2s (`text-3xl sm:text-4xl`).
- **Body** (400, 16px): public copy in `text-white/60–75`; admin copy in `slate-600` on white. Cap at 65–75ch.
- **Label** (500, 12px, `tracking-[0.35em]` uppercase): eyebrows in `sky-300`; admin sidebar section labels at `tracking-wider text-white/35`.

### Named Rules
**The Letterhead Rule.** Roxborough CF is reserved for moments of ceremony (printed documents; at most one on-screen brand moment). It never becomes a general heading font, and it has no bold cut, so never fake-bold it.

**The Shared Stack Rule.** EN, Bahasa Malaysia, and 中文 all render in the system stack (PingFang/Microsoft YaHei resolve CJK). Any future display-font use on customer surfaces must define an explicit CJK fallback before shipping.

## 4. Elevation

**Doctrine: light, not shadow.** On the dark public site, depth is emitted, not cast: cards glow blue on hover, CTAs carry a colored glow, and ambience comes from radial gradient light. The admin is flat: depth from `border-slate-200` lines and background steps (canvas → white surface), with at most `shadow-sm` on hover. Neutral dark shadows exist only to lift white paper off the dark stage.

### Shadow Vocabulary
- **Card glow** (`box-shadow: 0 24px 50px -24px rgba(47,111,237,0.55)` + border shift to `rgba(124,192,255,0.5)` + `translateY(-6px)`): hover response on public glass cards (`.card-glow`).
- **CTA glow** (`shadow-lg shadow-blue-500/30`): resting state of primary pill buttons.
- **Paper lift** (`shadow-2xl shadow-black/30`): the quote/invoice document container on the dark quote page; also `shadow-blue-950/40` under white auth cards.
- **Backstage hint** (`shadow-sm`): admin KPI card hover only.

### Named Rules
**The Stage Light Rule.** Shadows on the public site are always tinted with the brand hue, never neutral gray. If an element needs neutral elevation, it should probably be white paper (see The White Paper Rule).

## 5. Components

Feel: **celebratory but composed** — energy concentrates at actions (pills that lift and glow); surfaces stay calm glass.

### Buttons
- **Shape:** full pill (9999px) on public; small radius (6px) in admin.
- **Primary (public):** `var(--brand)` background, white text, `px-6 py-3`, resting CTA glow, hover `-translate-y-0.5` + `brightness-110`.
- **Ghost (public):** transparent with `border-white/20`, `text-white/90`, `backdrop-blur`, hover `bg-white/10` + same lift.
- **Admin primary:** `bg-accent` (#2f6fed), white text, `rounded-md px-4 py-2 text-sm`, hover `brightness-110`. Secondary: `border-slate-200 text-slate-700 hover:bg-slate-100`. Destructive: `text-red-600 hover:bg-red-50`.

### Cards / Containers
- **Public glass card:** `rounded-2xl border border-white/10 bg-white/[0.03] p-6` with `.card-glow` hover; nested tier variants step down to `bg-white/[0.02]`. Feature panels go `rounded-3xl p-8 sm:p-12` with `color-mix` brand washes.
- **Admin panel:** `rounded-xl border border-slate-200 bg-white p-5`; KPI variant hovers to `border-accent/50 shadow-sm`.
- **Image cards:** `overflow-hidden rounded-2xl border-white/10`, `aspect-[4/3] object-cover`, hover `scale-105` over 500ms.

### Inputs / Fields
- **Public (dark):** `rounded-lg border border-white/15 bg-white/5 px-3 py-2.5`, focus `border-white/40` or `border-[var(--brand)]`. PIN entry: centered, `text-lg tracking-widest`.
- **Admin (light):** `rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent`; login adds `focus:ring-2 ring-accent/30`.

### Navigation
- **Public:** fixed transparent bar with `backdrop-blur-md`, links `text-white/70 hover:text-white`, pill Enquire CTA in `var(--brand)`; mobile panel `rounded-xl bg-[#0a1430]/95`.
- **Admin:** fixed `w-60 bg-[#0c1c44]` navy sidebar, links `rounded-md text-white/70 hover:bg-white/10`; mobile becomes a horizontal pill strip.

### Status Badges (admin)
- `rounded-full px-2 py-0.5 text-xs font-medium` tonal pairs: `emerald-100/700`, `blue-100/700`, `amber-100/700`, `red-100/700`, default `slate-100/600`.

### ZoomableImage (signature)
- Native `<dialog>` lightbox: trigger `cursor-zoom-in`, dialog `bg-transparent backdrop:bg-black/85`, image `max-h-[90vh] max-w-[92vw] rounded-lg cursor-zoom-out`. Free Esc/backdrop dismiss; reuses the card's `src` for instant open.

### BrandedDocument (signature)
- White A4 sheet: Roxborough serif title + Inter `text-[12px] text-zinc-900` body, per-company logo/colors/numbering/SST, paginates with repeated table headers and `break-inside: avoid` rows.

## 6. Do's and Don'ts

### Do:
- **Do** route every customer-facing action color through `var(--brand)` / `var(--brand-2)` (The Tenant Spotlight Rule).
- **Do** keep public depth as brand-tinted glow (`rgba(47,111,237,0.55)` family) and admin depth as `slate-200` borders.
- **Do** render money moments as white paper on the dark stage with `shadow-2xl shadow-black/30`.
- **Do** honor `prefers-reduced-motion` on every animation, including the R3F hero and reveal staggers.
- **Do** dim text with the white-opacity ladder (`/75` body, `/60` secondary, `/40` fine print) and verify ≥4.5:1 contrast for body sizes.

### Don't:
- **Don't** build "generic AI/SaaS template" surfaces: gradient-clipped text, identical icon-card grids, or hero-metric blocks (PRODUCT.md anti-reference, verbatim).
- **Don't** drift toward "cheap party-store": clip-art, balloon icons, loud primary color mixes.
- **Don't** go "corporate & sterile" or "cluttered directory": no stock-suit imagery, no dense ad-like listings.
- **Don't** hardcode #2f6fed on customer surfaces; a rose-gold tenant must never leak blue.
- **Don't** mix the rooms: no light slate controls on dark customer pages (the current `lead-upload-form` is a known defect, not a pattern).
- **Don't** use neutral gray shadows on the public site; tint with the brand hue or use borders.
- **Don't** fake-bold Roxborough CF (only the Regular cut exists) or use it on CJK text without a defined fallback.
