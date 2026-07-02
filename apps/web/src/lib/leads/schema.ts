import { z } from "zod";

export const EVENT_TYPES = [
  "WEDDING",
  "CORPORATE",
  "BIRTHDAY",
  "ENGAGEMENT",
  "FESTIVAL",
  "PRODUCT_LAUNCH",
  "OTHER",
] as const;

export const BUDGET_RANGES = [
  "UNDER_10K",
  "RM10_30K",
  "RM30_50K",
  "RM50_100K",
  "ABOVE_100K",
] as const;

export type BudgetRange = (typeof BUDGET_RANGES)[number];

/** Maps a budget bucket to [min, max] in MYR (null = open-ended). */
export const BUDGET_MAP: Record<BudgetRange, [number | null, number | null]> = {
  UNDER_10K: [null, 10000],
  RM10_30K: [10000, 30000],
  RM30_50K: [30000, 50000],
  RM50_100K: [50000, 100000],
  ABOVE_100K: [100000, null],
};

export const EnquirySchema = z.object({
  eventType: z.enum(EVENT_TYPES),
  eventDate: z.string().optional(),
  eventTime: z.string().optional(),
  venue: z.string().optional(),
  theme: z.string().optional(),
  budget: z.enum(BUDGET_RANGES).optional().or(z.literal("")),
  purpose: z.string().optional(),
  guestCount: z.string().optional(),
  specialRequest: z.string().optional(),
  // Messages are stable `form.errors` dictionary keys, translated at render.
  name: z.string().min(1, "nameRequired"),
  email: z.string().email("emailInvalid"),
  phone: z.string().min(3, "phoneRequired"),
  preferredLanguage: z.enum(["EN", "MS", "ZH"]),
  locale: z.enum(["en", "ms", "zh"]),
});

export type EnquiryInput = z.infer<typeof EnquirySchema>;
