"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "../auth/rbac";
import { encryptSecret, decryptSecret } from "../crypto";
import { testOpenAiKey } from "../ai/openai";
import { CompanySchema } from "./schema";

export type CompanyFormState = {
  error: string;
  fieldErrors?: Record<string, string>;
};

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}
function bool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true";
}

function parse(formData: FormData) {
  return CompanySchema.safeParse({
    name: str(formData, "name"),
    legalName: str(formData, "legalName"),
    ssmRegNo: str(formData, "ssmRegNo"),
    sstRegistered: bool(formData, "sstRegistered"),
    sstRegNo: str(formData, "sstRegNo"),
    sstRate: str(formData, "sstRate") || "0",
    logoUrl: str(formData, "logoUrl"),
    brandPrimary: str(formData, "brandPrimary"),
    brandSecondary: str(formData, "brandSecondary"),
    brandFont: str(formData, "brandFont"),
    addressLine1: str(formData, "addressLine1"),
    addressLine2: str(formData, "addressLine2"),
    city: str(formData, "city"),
    state: str(formData, "state"),
    postcode: str(formData, "postcode"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    bankName: str(formData, "bankName"),
    bankAccountName: str(formData, "bankAccountName"),
    bankAccountNo: str(formData, "bankAccountNo"),
    duitnowQrUrl: str(formData, "duitnowQrUrl"),
    quotePrefix: str(formData, "quotePrefix") || "Q",
    invoicePrefix: str(formData, "invoicePrefix") || "INV",
    defaultProfitPercent: str(formData, "defaultProfitPercent") || "0",
    defaultDepositPercent: str(formData, "defaultDepositPercent") || "0",
    defaultLanguage: (str(formData, "defaultLanguage") || "EN") as "EN" | "MS" | "ZH",
    customDomains: str(formData, "customDomains"),
    aiEnabled: bool(formData, "aiEnabled"),
    aiModel: str(formData, "aiModel") || "gpt-4o",
    aiApiKey: str(formData, "aiApiKey"),
    waPhoneNumberId: str(formData, "waPhoneNumberId"),
    waBusinessId: str(formData, "waBusinessId"),
    waAccessToken: str(formData, "waAccessToken"),
    waBotEnabled: bool(formData, "waBotEnabled"),
    termsAndConditions: str(formData, "termsAndConditions"),
    seoTitle: str(formData, "seoTitle"),
    seoDescription: str(formData, "seoDescription"),
    ogImageUrl: str(formData, "ogImageUrl"),
    facebookUrl: str(formData, "facebookUrl"),
    instagramUrl: str(formData, "instagramUrl"),
    tiktokUrl: str(formData, "tiktokUrl"),
    youtubeUrl: str(formData, "youtubeUrl"),
    cloudflareZoneId: str(formData, "cloudflareZoneId"),
    cloudflareApiToken: str(formData, "cloudflareApiToken"),
  });
}

function flattenErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

type Parsed = z.infer<typeof CompanySchema>;

function parseDomains(raw?: string): string[] {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase().replace(/^www\./, ""))
    .filter(Boolean);
}

/**
 * Reject a domain already owned by another company — custom domains decide
 * which tenant a public hostname resolves to, so they must be globally unique.
 * Returns the first conflicting domain, or null if all are free.
 */
async function domainConflict(domains: string[], exceptCompanyId: string | null): Promise<string | null> {
  for (const domain of domains) {
    const other = await prisma.company.findFirst({
      where: {
        ...(exceptCompanyId ? { id: { not: exceptCompanyId } } : {}),
        customDomains: { has: domain },
      },
      select: { id: true },
    });
    if (other) return domain;
  }
  return null;
}

function toData(d: Parsed, includeKey: boolean, includeDomains: boolean) {
  const domains = parseDomains(d.customDomains);

  const data: Record<string, unknown> = {
    name: d.name,
    legalName: d.legalName || null,
    ssmRegNo: d.ssmRegNo || null,
    sstRegistered: d.sstRegistered,
    sstRegNo: d.sstRegNo || null,
    sstRate: d.sstRate || "0",
    logoUrl: d.logoUrl || null,
    brandPrimary: d.brandPrimary || null,
    brandSecondary: d.brandSecondary || null,
    brandFont: d.brandFont || null,
    addressLine1: d.addressLine1 || null,
    addressLine2: d.addressLine2 || null,
    city: d.city || null,
    state: d.state || null,
    postcode: d.postcode || null,
    phone: d.phone || null,
    email: d.email || null,
    bankName: d.bankName || null,
    bankAccountName: d.bankAccountName || null,
    bankAccountNo: d.bankAccountNo || null,
    duitnowQrUrl: d.duitnowQrUrl || null,
    quotePrefix: d.quotePrefix,
    invoicePrefix: d.invoicePrefix,
    defaultProfitPercent: d.defaultProfitPercent || "0",
    defaultDepositPercent: d.defaultDepositPercent || "0",
    defaultLanguage: d.defaultLanguage,
    customDomains: domains,
    aiEnabled: d.aiEnabled,
    aiModel: d.aiModel,
    waPhoneNumberId: d.waPhoneNumberId || null,
    waBusinessId: d.waBusinessId || null,
    waBotEnabled: d.waBotEnabled,
    termsAndConditions: d.termsAndConditions || null,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    ogImageUrl: d.ogImageUrl || null,
    facebookUrl: d.facebookUrl || null,
    instagramUrl: d.instagramUrl || null,
    tiktokUrl: d.tiktokUrl || null,
    youtubeUrl: d.youtubeUrl || null,
    cloudflareZoneId: d.cloudflareZoneId || null,
  };

  // Only SUPER_ADMIN may change which hostnames resolve to this tenant; for
  // everyone else we drop the field so existing domains are left untouched.
  if (!includeDomains) {
    delete data.customDomains;
  }

  if (includeKey && d.aiApiKey) {
    data.aiApiKeyEnc = encryptSecret(d.aiApiKey);
  }
  if (d.waAccessToken) {
    data.waAccessTokenEnc = encryptSecret(d.waAccessToken);
  }
  if (d.cloudflareApiToken) {
    data.cloudflareApiTokenEnc = encryptSecret(d.cloudflareApiToken);
  }
  return data;
}

export async function createCompanyAction(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) {
    return { error: "Only the group super-admin can create companies." };
  }
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error) };
  }
  const clash = await domainConflict(parseDomains(parsed.data.customDomains), null);
  if (clash) {
    return { error: "Domain already in use.", fieldErrors: { customDomains: `"${clash}" is already claimed by another company.` } };
  }
  const company = await prisma.company.create({
    data: toData(parsed.data, true, true) as never,
  });
  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${company.id}?saved=1`);
}

export async function updateCompanyAction(
  companyId: string,
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const user = await requireUser();
  const allowed =
    isSuperAdmin(user) ||
    (user.role === "COMPANY_ADMIN" && user.companyId === companyId);
  if (!allowed) {
    return { error: "You don't have permission to edit this company." };
  }
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error) };
  }
  // Custom domains are a SUPER_ADMIN-only field (they decide tenant routing).
  const canSetDomains = isSuperAdmin(user);
  if (canSetDomains) {
    const clash = await domainConflict(parseDomains(parsed.data.customDomains), companyId);
    if (clash) {
      return { error: "Domain already in use.", fieldErrors: { customDomains: `"${clash}" is already claimed by another company.` } };
    }
  }
  await prisma.company.update({
    where: { id: companyId },
    data: toData(parsed.data, Boolean(parsed.data.aiApiKey), canSetDomains) as never,
  });
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${companyId}?saved=1`);
}

// ── Test the OpenAI key (auth + capability report) ──
export type AiKeyTestState = { status: "idle" | "ok" | "error"; message: string };

export async function testAiKeyAction(
  companyId: string,
  _prev: AiKeyTestState,
  formData: FormData,
): Promise<AiKeyTestState> {
  const user = await requireUser();
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  // Admins only — a SALES/PLANNER user must not probe the company's AI key.
  const canTest =
    isSuperAdmin(user) || (user.role === "COMPANY_ADMIN" && user.companyId === companyId);
  if (!company || !canTest) {
    return { status: "error", message: "Not found." };
  }

  // Prefer a freshly pasted key; fall back to the company's saved key. The
  // platform-wide OPENAI_API_KEY is only ever testable by the super-admin so a
  // tenant can never probe (or confirm the validity of) the owner's key.
  const typed = str(formData, "aiApiKey").trim();
  const key =
    typed ||
    decryptSecret(company.aiApiKeyEnc) ||
    (isSuperAdmin(user) ? process.env.OPENAI_API_KEY : "") ||
    "";
  if (!key) return { status: "error", message: "Enter an API key first, or save one." };

  const model = company.aiModel || "gpt-4o";
  const res = await testOpenAiKey(key);
  if (!res.ok) return { status: "error", message: res.error ?? "Key rejected by OpenAI." };

  const hasChat = res.ids.includes(model);
  const hasImage = res.ids.includes("gpt-image-1");
  const parts = [
    "✓ API key works.",
    hasChat
      ? `Quoting model "${model}" available.`
      : `⚠ Quoting model "${model}" not found on this account — check the model name.`,
    hasImage
      ? "Photo generator (gpt-image-1) available."
      : "⚠ gpt-image-1 not enabled yet — image generation needs organisation verification at platform.openai.com.",
  ];
  return { status: "ok", message: parts.join(" ") };
}
