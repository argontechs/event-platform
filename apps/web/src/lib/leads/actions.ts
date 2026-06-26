"use server";

import { randomBytes, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "../auth/rbac";
import { saveUpload } from "../storage";
import { getCompanyByHost } from "../tenant";
import { isRateLimited, recordFailure, clearAttempts } from "../rate-limit";
import { EnquirySchema, BUDGET_MAP } from "./schema";

export type EnquiryState = { error: string; fieldErrors?: Record<string, string> };

// Public-form abuse controls (in-memory; per-process).
const LEAD_PIN_LIMIT = { max: 8, windowMs: 10 * 60 * 1000, lockMs: 15 * 60 * 1000 };
const ENQUIRY_LIMIT = { max: 6, windowMs: 10 * 60 * 1000, lockMs: 10 * 60 * 1000 };
async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const LEAD_STATUSES = [
  "NEW", "REVIEWING", "QUOTED", "ACCEPTED", "REJECTED", "CONVERTED", "LOST",
] as const;

export type UploadMoreState = { error: string; ok?: boolean; count?: number };

/** Public: customer adds more reference photos via the password-gated link. */
export async function addLeadImagesAction(
  token: string,
  _prev: UploadMoreState,
  formData: FormData,
): Promise<UploadMoreState> {
  const rlKey = `lead-pin:${token}`;
  const gate = isRateLimited(rlKey, LEAD_PIN_LIMIT);
  if (gate.limited) {
    return { error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minute(s).` };
  }

  const lead = await prisma.lead.findUnique({ where: { uploadToken: token } });
  if (!lead) return { error: "This link is invalid." };

  const pin = String(formData.get("pin") ?? "").trim();
  // Rate-limited + constant-time compare (the PIN is a short numeric code).
  const ok =
    !!lead.uploadPin &&
    pin.length === lead.uploadPin.length &&
    timingSafeEqual(Buffer.from(pin), Buffer.from(lead.uploadPin));
  if (!ok) {
    recordFailure(rlKey, LEAD_PIN_LIMIT);
    return { error: "Incorrect access code." };
  }
  clearAttempts(rlKey);

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 10); // cap per submission
  if (files.length === 0) return { error: "Please choose at least one photo." };

  let saved = 0;
  for (const file of files) {
    try {
      const stored = await saveUpload(lead.companyId, file);
      if (!stored) continue;
      await prisma.attachment.create({
        data: {
          companyId: lead.companyId,
          kind: "REFERENCE",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          leadId: lead.id,
        },
      });
      saved++;
    } catch {
      // skip bad file
    }
  }
  if (saved === 0) return { error: "Upload failed — please try again." };
  return { error: "", ok: true, count: saved };
}

/** Staff advances a lead through its pipeline. */
export async function updateLeadStatusAction(leadId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  if (!isSuperAdmin(user) && user.companyId !== lead.companyId) return;
  const status = String(formData.get("status") ?? "");
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) return;
  await prisma.lead.update({ where: { id: leadId }, data: { status: status as never } });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
}

function s(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function companyCode(company: { quotePrefix: string; name: string }): string {
  const base = (company.quotePrefix || company.name || "EVT").replace(
    /[^A-Za-z0-9]/g,
    "",
  );
  return (base || "EVT").toUpperCase().slice(0, 6);
}

export async function submitEnquiryAction(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  // Anti-spam / anti-amplification: cap enquiries per client IP.
  const ip = await clientIp();
  if (isRateLimited(`enquiry:${ip}`, ENQUIRY_LIMIT).limited) {
    return { error: "Too many submissions. Please try again in a few minutes." };
  }
  recordFailure(`enquiry:${ip}`, ENQUIRY_LIMIT);

  const parsed = EnquirySchema.safeParse({
    eventType: s(formData, "eventType"),
    eventDate: s(formData, "eventDate"),
    eventTime: s(formData, "eventTime"),
    venue: s(formData, "venue"),
    theme: s(formData, "theme"),
    budget: s(formData, "budget"),
    purpose: s(formData, "purpose"),
    guestCount: s(formData, "guestCount"),
    specialRequest: s(formData, "specialRequest"),
    name: s(formData, "name"),
    email: s(formData, "email"),
    phone: s(formData, "phone"),
    preferredLanguage: (s(formData, "preferredLanguage") || "EN") as "EN" | "MS" | "ZH",
    locale: (s(formData, "locale") || "en") as "en" | "ms" | "zh",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { error: "Please complete the required fields.", fieldErrors };
  }
  const d = parsed.data;

  // Resolve tenant by host; fall back to first active company (dev convenience).
  const host = (await headers()).get("host");
  let company = await getCompanyByHost(host).catch(() => null);
  if (!company) {
    company = await prisma.company.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!company) return { error: "No company is configured yet." };

  const email = d.email.toLowerCase();
  let customer = await prisma.customer.findFirst({
    where: { companyId: company.id, email },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: d.name,
        email,
        phone: d.phone,
        language: d.preferredLanguage,
        source: "website",
      },
    });
  }

  // Reference number: <CODE>-EVT-<year>-<seq>. The referenceNo is @unique, so
  // a plain count()+1 can collide under concurrency or after deletions — retry
  // with the next sequence on a unique-constraint violation.
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));

  const [budgetMin, budgetMax] = d.budget
    ? BUDGET_MAP[d.budget]
    : [null, null];
  // Accept only a sane non-negative integer; reject negatives/garbage like "-5".
  const guestParsed = d.guestCount ? parseInt(d.guestCount, 10) : NaN;
  const guestCount = Number.isFinite(guestParsed) && guestParsed >= 0 ? guestParsed : null;

  const baseData = {
    companyId: company.id,
    customerId: customer.id,
    eventType: d.eventType,
    eventDate: d.eventDate ? new Date(d.eventDate) : null,
    eventTime: d.eventTime || null,
    venueText: d.venue || null,
    guestCount,
    budgetMin: budgetMin != null ? String(budgetMin) : null,
    budgetMax: budgetMax != null ? String(budgetMax) : null,
    theme: d.theme || null,
    purpose: d.purpose || null,
    specialRequest: d.specialRequest || null,
    preferredLanguage: d.preferredLanguage,
    status: "NEW" as const,
  };

  let lead = null;
  for (let attempt = 0; attempt < 6 && !lead; attempt++) {
    const count = await prisma.lead.count({
      where: { companyId: company.id, createdAt: { gte: yearStart } },
    });
    const referenceNo = `${companyCode(company)}-EVT-${year}-${String(count + 1 + attempt).padStart(4, "0")}`;
    try {
      lead = await prisma.lead.create({ data: { ...baseData, referenceNo } });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "P2002") throw err; // not a duplicate-number clash → real error
    }
  }
  if (!lead) {
    // Last resort: a guaranteed-unique suffix so the enquiry is never lost.
    const referenceNo = `${companyCode(company)}-EVT-${year}-${Date.now().toString().slice(-6)}`;
    lead = await prisma.lead.create({ data: { ...baseData, referenceNo } });
  }

  // Persist reference images — one bad file must not fail the whole enquiry.
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    try {
      const stored = await saveUpload(company.id, file);
      if (!stored) continue;
      await prisma.attachment.create({
        data: {
          companyId: company.id,
          kind: "REFERENCE",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          leadId: lead.id,
        },
      });
    } catch {
      // skip this file, keep the lead + remaining images
    }
  }

  // Password-gated "add more photos" link + an auto-created DRAFT proposal so
  // staff always have a proposal waiting to review (AI-fill or build manually).
  const uploadToken = randomBytes(16).toString("hex");
  const uploadPin = (parseInt(randomBytes(4).toString("hex"), 16) % 1000000)
    .toString()
    .padStart(6, "0");
  await prisma.lead
    .update({ where: { id: lead.id }, data: { uploadToken, uploadPin } })
    .catch(() => undefined);

  try {
    const seqRow = await prisma.company.update({
      where: { id: company.id },
      data: { quoteNextSeq: { increment: 1 } },
      select: { quoteNextSeq: true },
    });
    const number = `${company.quotePrefix}-${String(seqRow.quoteNextSeq - 1).padStart(4, "0")}`;
    await prisma.quotation.create({
      data: {
        companyId: company.id,
        leadId: lead.id,
        customerId: customer.id,
        number,
        status: "DRAFT",
        profitPercentDefault: company.defaultProfitPercent,
        depositPercent: company.defaultDepositPercent,
        sstApplied: company.sstRegistered,
        sstRate: company.sstRegistered ? company.sstRate : 0,
        eventDate: lead.eventDate,
        startTime: lead.eventTime,
        venue: lead.venueText,
      },
    });
  } catch {
    // never fail the enquiry if the draft proposal can't be created
  }

  // Queue confirmation + staff alert (sent by the worker in Phase 10).
  await prisma.emailLog
    .createMany({
      data: [
        {
          companyId: company.id,
          to: email,
          subject: `We received your enquiry (${lead.referenceNo})`,
          template: "enquiry_confirmation",
          status: "queued",
        },
        {
          companyId: company.id,
          to: company.email ?? email,
          subject: `New enquiry ${lead.referenceNo}`,
          template: "staff_new_lead",
          status: "queued",
        },
      ],
    })
    .catch(() => undefined);

  redirect(`/${d.locale}/contact/thank-you?ref=${encodeURIComponent(lead.referenceNo)}`);
}
