import { z } from "zod";

// Bound every numeric field: a hallucinated or injected negative / NaN / huge
// cost or quantity must not become a real quote line. Non-finite coerces are
// clamped by .min/.max; .catch() keeps a bad value from throwing the whole parse.
export const AiMaterial = z.object({
  name: z.string().max(300),
  quantity: z.coerce.number().finite().min(0).max(100_000).catch(1),
  unit: z.string().max(50).default("unit"),
  estCost: z.coerce.number().finite().min(0).max(10_000_000).catch(0),
  analysis: z.string().max(2000).default(""),
});

export const AiDraftResult = z.object({
  plan: z.string().default(""),
  materials: z.array(AiMaterial).default([]),
  questions: z.array(z.string()).default([]),
});

export type AiMaterial = z.infer<typeof AiMaterial>;
export type AiDraftResult = z.infer<typeof AiDraftResult>;

// ── WhatsApp AI bot reply ────────────────────────────────────────────────
// The bot is told to return this exact shape. We never trust the raw model
// output: keys are coerced to strings and clamped, the action enum falls back
// to "ask", and a bad leadData collapses to {} rather than throwing — same
// "validate-everything" net as AiDraftResult. `reply` must be non-empty (an
// empty WhatsApp body is rejected by Meta), so a missing reply fails the parse
// and generateBotReply substitutes a safe default.
const botField = z.coerce.string().trim().max(2000).optional().catch(undefined);

export const BotLeadData = z.object({
  name: botField,
  eventType: botField,
  eventDate: botField,
  venue: botField,
  guests: botField,
  budget: botField,
  details: botField,
});

export const BotReply = z.object({
  reply: z.string().trim().min(1).max(4000),
  action: z.enum(["ask", "finalize", "handoff"]).catch("ask"),
  leadData: BotLeadData.catch({}),
});

export type BotLeadData = z.infer<typeof BotLeadData>;
export type BotReply = z.infer<typeof BotReply>;
