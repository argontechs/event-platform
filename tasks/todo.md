# Plan: Anthropic (Claude) provider + LLM-driven WhatsApp bot

Status: **BUILT — two adversarial review passes incorporated; typecheck clean, 31/31 tests pass.**
Date: 2026-06-29
Remaining: run `cd packages/db && npx prisma db push` once the event-platform Postgres is up (additive columns — non-destructive). Pre-existing: DEPLOY.md uses `migrate deploy` but the repo has no migrations baseline — flagged, separate task.

## Implementation review (v3) — fixes applied

Second adversarial review of the actual diff found 9 confirmed issues; all fixed:
- **Duplicate Customer/Lead after finalize/handoff** (high): webhook now gates the AI enqueue on `(isNew || convo.botActive)` (mirrors scripted gate); finalize resets `botData`/`botTurns`; `finalizeLead` reuses an existing customer by phone (idempotent).
- **Anthropic JSON fences/prose** (med): `callChat` strips fences / extracts the JSON value on the Claude branch when `jsonMode`.
- **Transient-error fallback clobbered AI state** (med): `scriptedFallback` re-asks safely (no questionnaire restart) for AI-driven convos.
- **Non-text first message ignored under AI** (med): first contact of any type now gets a greeting.
- **Batched-delivery handoff** (low): handoff flag accumulated across all messages in a delivery.
- **Key-tester image message** (low): no longer aiEnabled-gated false negative.

## Self-review corrections applied (v2)

- **Migration**: repo has NO `migrations/` dir → use `prisma db push`, NOT `migrate dev`. (DEPLOY.md's `migrate deploy` is a pre-existing gap, flagged, out of scope — prod not provisioned yet.)
- **No `temperature` to Claude** — `claude-opus-4-8` 400s on sampling params. Shared `callChat` applies `temperature` only on the OpenAI branch.
- **Provider-aware model reconciliation** in `resolveAiKey`: an OpenAI model id (`gpt-4o`) can never reach the Claude branch; defaults to `claude-opus-4-8`.
- **`resolveImageKey`** (separate, always-OpenAI) for concept-image actions — the provider key must not be POSTed to OpenAI's image endpoint. Handles the MIXED `generateConceptFromReferencesAction` (Claude brief + OpenAI render).
- **`testAiKeyAction` NOT folded** into shared `resolveAiKey` — keeps typed-key-first, super-admin-gated env, no `aiEnabled` gate; made provider-aware separately.
- **JSON via prompt + Zod** (not `output_config.format`); new `BotReply` Zod validator for the bot.
- **`max_tokens` required** on every Claude call; Anthropic key test sends `anthropic-version`.
- **WhatsApp**: webhook SELECT gains the AI fields; one LLM call per conversation per POST (text only); first-message activation; `botTurns` counter (new column) for the handoff cap; scripted fallback on LLM error INSIDE the handler; history normalization; deterministic HANDOFF backstop; empty-body guard in client.ts; finalize gated server-side on name+eventType.
- **Key bound to provider**: cleared on provider change; prefix sanity check in resolve.

## Goal

1. Let each company use **Anthropic (Claude)** instead of / alongside OpenAI for the existing AI features.
2. Upgrade the existing **scripted** WhatsApp enquiry bot into an **LLM-driven** conversation, reusing the bot plumbing that already exists.

## Hard constraints (decide nothing around these — they're facts)

- **Claude cannot generate images.** OpenAI's `gpt-image-1` (concept image gen/edit) has no Anthropic equivalent. So image features stay on OpenAI regardless of a company's provider choice. Only the **text/vision** features can move to Claude.
- Anthropic Messages API: `POST https://api.anthropic.com/v1/messages`, headers `x-api-key: <key>` + `anthropic-version: 2023-06-01`. Vision images are base64 blocks `{type:"image", source:{type:"base64", media_type, data}}` — **not** OpenAI's `{type:"image_url"}`.
- Current code is SDK-less raw `fetch`. We mirror that (no new dependency) unless we later need streaming. WhatsApp + the 4 features are all non-streaming, so raw `fetch` is fine.
- Suggested Claude models: `claude-opus-4-8` (default/highest), `claude-sonnet-4-6` and `claude-haiku-4-5` (cheap/fast — the right pick for high-volume receipt OCR and the WhatsApp bot). Company-settable via `Company.aiModel`.

---

## Phase 0 — Shared groundwork

- [ ] **Schema**: in `model Company` (`packages/db/prisma/schema.prisma`, next to the AI fields) add:
  - `aiProvider String @default("openai")` — one key slot stays (`aiApiKeyEnc`), holds whichever provider's key.
  - `waBotContext String?` — per-company free-text FAQ / services / pricing fed into the bot's system prompt (D3).
- [ ] **Migration**: `prisma migrate dev` (existing rows default to `"openai"`, `waBotContext` null → zero behaviour change on deploy).
- [ ] **Extract `resolveAiKey(company)`** into a shared helper (today it's duplicated in `quotations/actions.ts:35-49`, `expenses/actions.ts:53-57`, `companies/actions.ts:251-262`). Return `{ provider, apiKey, model }`. Keep the precedence: per-company `aiEnabled` → decrypt `aiApiKeyEnc` → env fallback. Env fallback becomes provider-aware: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
- [ ] **New module `apps/web/src/lib/ai/anthropic.ts`** with a `callClaude()` helper:
  - builds Messages API request (`system`, `messages`, `max_tokens`, optional `output_config.format` for JSON).
  - converts our `data:` URLs (from `readUploadAsDataUrl`) into base64 image blocks.
  - returns text + usage, mirroring the shape `openai.ts` returns.

## Phase 1 — Anthropic for the 4 existing features

Route by `company.aiProvider`. Text/vision → Claude when selected; image gen → always OpenAI.

- [ ] `generateQuotationDraft` (`openai.ts:56`) — branch: Claude path reuses the same `SYSTEM` prompt + fenced `<customer_request>`, returns JSON, **reuse the existing `AiDraftResult` Zod validation** (`schema.ts`) unchanged. (We already don't trust raw model JSON, so the safety net is identical.)
- [ ] `analyzeReferencesToBrief` (`openai.ts:169`) — branch: Claude vision pass, returns brief text.
- [ ] `extractReceipt` (`openai.ts:239`) — branch: Claude vision + JSON; keep the same category clamp + date regex. (Recommend `claude-haiku-4-5` for cost here.)
- [ ] `generateConceptImage` / `editConceptFromImages` (`openai.ts:126`, `:297`) — **unchanged.** When `aiProvider="anthropic"`: use the company's OpenAI key if present, else env `OPENAI_API_KEY`, else surface "concept images require an OpenAI key" in the UI. (Decision D1 below.)
- [ ] `testOpenAiKey` (`openai.ts:341`) — add an Anthropic branch (`GET https://api.anthropic.com/v1/models` with `x-api-key`); rename caller-side to a provider-aware `testAiKey`.
- [ ] **UI**: add an `aiProvider` selector to `components/admin/company-form.tsx` (near `aiModel`/`aiEnabled`); update model-field hints (gpt-4o vs claude-*). Update the key tester component `admin/ai-key-tester.tsx` label.
- [ ] **Plumbing**: `ANTHROPIC_API_KEY` in `.env.example`; add `https://api.anthropic.com` to CSP `connect-src` (`next.config.mjs:14`) for parity (note: server actions are server-to-server, so CSP doesn't actually gate them — harmless consistency); i18n strings (`lib/i18n/t.ts`) and handbook copy (`admin/handbook/page.tsx`) mention OpenAI — generalise wording.

## Phase 2 — LLM-driven WhatsApp bot

Reuses ALL existing plumbing: `sendWhatsappText` (client.ts), OUT-message storage + `sendBotMessage` pattern (bot.ts:37), `botActive`/`botData` state, Lead/Customer finalize (bot.ts:94-128), staff-email handoff (bot.ts:63-71), `waBotEnabled` gate, webhook wiring (route.ts:131-144).

- [ ] **New AI fn `generateBotReply()`** (provider-aware, via Phase 0/1): inputs = company context (name + `waBotContext` FAQ) + recent conversation history (reconstruct from `whatsappMessage` rows, cap to last ~15) + accumulated `botData`. Output (structured, via `output_config.format` / OpenAI json mode): `{ reply: string, leadData: {...partial}, action: "ask" | "finalize" | "handoff" }`. The bot both **answers free-form questions** (from `waBotContext`) and captures the lead. System prompt fences customer text as untrusted (reuse the hardening pattern from `openai.ts:13`).
- [ ] **New `handleBotAnswerAI()`** in `bot.ts` (or a sibling): call `generateBotReply` → `sendBotMessage(reply)` (auto-reply) → merge `leadData` into `botData`; on `finalize` reuse the existing Customer+Lead creation block; on `handoff` reuse the existing deactivate + staff-email block.
- [ ] **Webhook branch** (route.ts:132-144): if `company.aiEnabled` + key configured → use the AI bot; **else fall back to the existing scripted `startBot`/`handleBotAnswer`** (working, zero-cost path). The webhook already swallows bot errors, so AI failure degrades gracefully.
- [ ] **Handoff cap (auto-reply guard)**: count inbound messages per conversation; after N (e.g. 12) bot-handled turns without finalize, force `action:"handoff"` (deactivate + staff email) so a stuck/abusive thread can't run up unbounded LLM cost. `waBotEnabled` is the per-company off switch.
- [ ] Model recommendation for the bot: `claude-haiku-4-5` or `claude-sonnet-4-6` (latency + cost on every inbound message).

---

## Decisions (locked 2026-06-29)

- **D1 — Anthropic-only companies + concept images**: ✅ single key slot + OpenAI env fallback for images; disable image buttons (with a clear message) if no OpenAI key is available.
- **D2 — WhatsApp bot mode**: ✅ **auto-reply** with a hard handoff cap (see Phase 2 "Handoff cap").
- **D3 — Bot knowledge**: ✅ add per-company `waBotContext` free-text FAQ field; bot answers questions from it AND captures the lead.
- **D4 — Scripted bot**: ✅ keep it as the fallback path (used when AI is disabled/unconfigured or errors).

## Verification (per CLAUDE.md: never mark done without verifying)

- [ ] `schema.test.ts` still green; add Claude-path unit coverage for the JSON parse/validate.
- [ ] Manual: company on `aiProvider="anthropic"` → quote draft, receipt OCR, reference brief all work; concept image gen behaves per D1.
- [ ] Manual: WhatsApp inbound → AI bot replies, captures a lead, hands off on "talk to a human"; with AI disabled → scripted bot still works.
- [ ] Key tester works for both providers.
