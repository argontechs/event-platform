import { z } from "zod";

const numeric = (label: string) =>
  z
    .string()
    .refine((v) => v === "" || Number.isFinite(Number(v)), `${label} must be a number`)
    .refine((v) => v === "" || Number(v) >= 0, `${label} cannot be negative`);

// Percentage capped at 0..100 (tax / deposit rates).
const percent = (label: string) =>
  z.string().refine((v) => {
    if (v === "") return true;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, `${label} must be between 0 and 100`);

// CSS colour (hex or rgb/hsl functional). Blocks CSS injection: these values are
// interpolated into inline style attributes on public + customer-facing pages.
const cssColor = (label: string) =>
  z.string().refine(
    (v) =>
      v === "" ||
      /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
      /^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/.test(v),
    `${label} must be a valid colour (e.g. #2f6fed)`,
  );

export const CompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  legalName: z.string().optional(),
  ssmRegNo: z.string().optional(),

  sstRegistered: z.boolean(),
  sstRegNo: z.string().optional(),
  sstRate: percent("SST rate"),

  logoUrl: z.string().optional(),
  brandPrimary: cssColor("Primary colour").optional(),
  brandSecondary: cssColor("Secondary colour").optional(),
  brandFont: z
    .string()
    .regex(/^[a-zA-Z0-9 ,'"\-]*$/, "Invalid font name")
    .optional(),

  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),

  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  duitnowQrUrl: z.string().optional(),

  quotePrefix: z.string().min(1, "Quote prefix is required"),
  invoicePrefix: z.string().min(1, "Invoice prefix is required"),
  defaultProfitPercent: numeric("Default profit %"),
  defaultDepositPercent: percent("Default deposit %"),
  defaultLanguage: z.enum(["EN", "MS", "ZH"]),

  customDomains: z.string().optional(), // comma / newline separated

  aiEnabled: z.boolean(),
  aiProvider: z.enum(["openai", "anthropic"]),
  aiModel: z.string().min(1, "AI model is required"),
  aiApiKey: z.string().optional(), // plaintext; blank on update = keep existing

  // WhatsApp Business (Meta Cloud API)
  waPhoneNumberId: z.string().optional(),
  waBusinessId: z.string().optional(),
  waAccessToken: z.string().optional(), // plaintext; blank on update = keep existing
  waBotEnabled: z.boolean(),
  waBotContext: z.string().optional(),

  termsAndConditions: z.string().optional(),

  // SEO / marketing
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),

  // Social links
  facebookUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  tiktokUrl: z.string().optional(),
  youtubeUrl: z.string().optional(),

  // Cloudflare DNS
  cloudflareZoneId: z.string().optional(),
  cloudflareApiToken: z.string().optional(), // plaintext; blank on update = keep existing
});

export type CompanyInput = z.infer<typeof CompanySchema>;

export type CompanyFormValues = Omit<
  CompanyInput,
  "aiApiKey" | "waAccessToken" | "cloudflareApiToken"
>;
