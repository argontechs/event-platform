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
