"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import {
  generateQuotationDraft,
  generateConceptImage,
  editConceptFromImages,
  analyzeReferencesToBrief,
} from "../ai/openai";
import { resolveAiKey, resolveImageKey } from "../ai/resolve";
import { computeTotals, unitPrice, lineTotal } from "./calc";
import { saveUpload, saveBuffer, readUploadBytes } from "../storage";
import { isRateLimited, recordFailure } from "../rate-limit";
import type { SessionUser } from "../auth/session";

// Per-user burst cap on (expensive) image generation: 12 renders / 15 min.
const AI_IMAGE_LIMIT = { max: 12, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };

function canAccess(user: SessionUser, companyId: string): boolean {
  return isSuperAdmin(user) || user.companyId === companyId;
}

const LineSchema = z.object({
  description: z.string().min(1),
  category: z.string().optional().default(""),
  quantity: z.coerce.number().finite().min(0).default(1),
  unit: z.string().default("unit"),
  costPrice: z.coerce.number().finite().min(0).default(0),
  // Floor at -100 so a line can't be priced below zero (paired with the
  // lineTotal floor in calc.ts); finite() rejects NaN/Infinity.
  profitPercent: z.coerce.number().finite().min(-100).default(0),
  referenceImageUrl: z.string().optional().default(""),
});

export type QuotationActionState = { error: string; ok?: boolean };
export type AiActionState = { error: string; ok?: boolean };

// ── Create an empty quotation from a lead (manual or AI mode chosen later) ──
export async function createQuotationForLead(
  leadId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireSalesRole();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !canAccess(user, lead.companyId)) redirect("/admin/leads");

  const company = await prisma.company.findUnique({ where: { id: lead.companyId } });
  if (!company) redirect("/admin/leads");

  // Atomically allocate the next quote number to avoid duplicate-number races.
  const seqRow = await prisma.company.update({
    where: { id: company.id },
    data: { quoteNextSeq: { increment: 1 } },
    select: { quoteNextSeq: true },
  });
  const number = `${company.quotePrefix}-${String(seqRow.quoteNextSeq - 1).padStart(4, "0")}`;

  // Auto-apply the B2B exemption if this customer is already flagged exempt.
  const customer = lead.customerId
    ? await prisma.customer.findUnique({ where: { id: lead.customerId }, select: { sstB2bExempt: true } })
    : null;

  const quotation = await prisma.quotation.create({
    data: {
      companyId: company.id,
      leadId: lead.id,
      customerId: lead.customerId,
      number,
      status: "DRAFT",
      profitPercentDefault: company.defaultProfitPercent,
      depositPercent: company.defaultDepositPercent,
      sstApplied: company.sstRegistered,
      sstRate: company.sstRegistered ? company.sstRate : 0,
      b2bExempt: company.sstRegistered ? Boolean(customer?.sstB2bExempt) : false,
      preparedBy: user.name,
      eventDate: lead.eventDate,
      startTime: lead.eventTime,
      venue: lead.venueText,
    },
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { status: "REVIEWING" } });

  redirect(`/admin/quotations/${quotation.id}`);
}

// ── Create a manual quotation under a chosen company (no lead required) ──
export async function createManualQuotationAction(formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId || !canAccess(user, companyId)) redirect("/admin/quotations");

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) redirect("/admin/quotations");

  const seqRow = await prisma.company.update({
    where: { id: company.id },
    data: { quoteNextSeq: { increment: 1 } },
    select: { quoteNextSeq: true },
  });
  const number = `${company.quotePrefix}-${String(seqRow.quoteNextSeq - 1).padStart(4, "0")}`;

  const quotation = await prisma.quotation.create({
    data: {
      companyId: company.id,
      number,
      status: "DRAFT",
      profitPercentDefault: company.defaultProfitPercent,
      depositPercent: company.defaultDepositPercent,
      sstApplied: company.sstRegistered,
      sstRate: company.sstRegistered ? company.sstRate : 0,
      preparedBy: user.name,
    },
  });

  redirect(`/admin/quotations/${quotation.id}`);
}

// ── Generate (or regenerate) line items + plan with AI ──
export async function runAiDraftAction(
  quotationId: string,
  _prev: AiActionState,
  formData: FormData,
): Promise<AiActionState> {
  const user = await requireSalesRole();
  const instructions = String(formData.get("instructions") ?? "");
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { company: true, lead: { include: { attachments: true } } },
  });
  if (!quotation || !canAccess(user, quotation.companyId)) {
    return { error: "Not found." };
  }
  if (!quotation.lead) return { error: "This quotation has no linked lead/images." };

  const keyRes = resolveAiKey(quotation.company);
  if (!keyRes.ok) return { error: keyRes.error };

  const lead = quotation.lead;
  const imageUrls = lead.attachments
    .filter((a) => a.kind === "REFERENCE")
    .map((a) => a.url);

  let draft;
  try {
    draft = await generateQuotationDraft({
      apiKey: keyRes.key,
      model: keyRes.model,
      lead: {
        eventType: lead.eventType,
        eventDate: lead.eventDate?.toISOString().slice(0, 10) ?? null,
        eventTime: lead.eventTime,
        venue: lead.venueText,
        guestCount: lead.guestCount,
        theme: lead.theme,
        purpose: lead.purpose,
        budgetMin: lead.budgetMin ? Number(lead.budgetMin) : null,
        budgetMax: lead.budgetMax ? Number(lead.budgetMax) : null,
        specialRequest: lead.specialRequest,
        message: lead.message,
      },
      imageUrls,
      instructions,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI request failed." };
  }

  const profit = Number(quotation.profitPercentDefault);

  await prisma.$transaction([
    prisma.aiDraft.create({
      data: {
        companyId: quotation.companyId,
        leadId: lead.id,
        status: "GENERATED",
        model: keyRes.model,
        planDraft: draft.result.plan,
        materials: draft.result.materials,
        questions: draft.result.questions,
        tokenInput: draft.usage.input,
        tokenOutput: draft.usage.output,
        createdById: user.id,
      },
    }),
    prisma.quotationItem.deleteMany({ where: { quotationId } }),
    prisma.quotationItem.createMany({
      data: draft.result.materials.map((m, i) => ({
        quotationId,
        companyId: quotation.companyId,
        description: m.name,
        category: "",
        quantity: m.quantity,
        unit: m.unit,
        costPrice: m.estCost,
        profitPercent: profit,
        unitPrice: unitPrice(m.estCost, profit),
        lineTotal: lineTotal(m.quantity, m.estCost, profit),
        sortOrder: i,
      })),
    }),
  ]);

  await recomputeQuotation(quotationId);
  revalidatePath(`/admin/quotations/${quotationId}`);
  return { error: "", ok: true };
}

// ── Attach design/reference images to a quotation (shown on the proposal) ──
export type QuotationImageState = { error: string; ok?: boolean };

export async function uploadQuotationImagesAction(
  quotationId: string,
  _prev: QuotationImageState,
  formData: FormData,
): Promise<QuotationImageState> {
  const user = await requireSalesRole();
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation || !canAccess(user, quotation.companyId)) return { error: "Not found." };

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one image." };

  let saved = 0;
  for (const file of files) {
    try {
      const stored = await saveUpload(quotation.companyId, file);
      if (!stored) continue;
      await prisma.attachment.create({
        data: {
          companyId: quotation.companyId,
          kind: "MOODBOARD",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          quotationId: quotation.id,
        },
      });
      saved++;
    } catch {
      // skip bad file
    }
  }
  if (saved === 0) return { error: "Upload failed — please try again." };
  revalidatePath(`/admin/quotations/${quotationId}`);
  return { error: "", ok: true };
}

// ── Generate a decoration concept image with gpt-image-1 ──
export type ConceptImageState = { error: string; ok?: boolean };

export async function generateConceptImageAction(
  quotationId: string,
  _prev: ConceptImageState,
  formData: FormData,
): Promise<ConceptImageState> {
  const user = await requireSalesRole();
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { company: true, lead: true },
  });
  if (!quotation || !canAccess(user, quotation.companyId)) return { error: "Not found." };

  const keyRes = resolveImageKey(quotation.company);
  if (!keyRes.ok) return { error: keyRes.error };
  const apiKey = keyRes.key;
  if (isRateLimited(`ai-image:${user.id}`, AI_IMAGE_LIMIT).limited) {
    return { error: "Too many image generations — please wait a few minutes." };
  }
  recordFailure(`ai-image:${user.id}`, AI_IMAGE_LIMIT);

  const desc = String(formData.get("prompt") ?? "").trim();
  if (!desc) return { error: "Describe the decoration you want to generate." };
  const size = String(formData.get("size") || "1024x1024");

  // Blend the staff brief with the linked event context for an on-brief render.
  const lead = quotation.lead;
  const ctx = lead
    ? [
        lead.eventType ? `Event: ${lead.eventType.replace(/_/g, " ").toLowerCase()}` : null,
        lead.theme ? `Theme: ${lead.theme}` : null,
        lead.venueText ? `Venue: ${lead.venueText}` : null,
      ]
        .filter(Boolean)
        .join(". ")
    : "";
  const prompt = `Professional, photorealistic event & decoration concept render for a Malaysian events company. ${desc}. ${ctx}. Elegant styling with balloons, florals and backdrops as appropriate, beautiful lighting, high-end editorial event photography. No text, no watermark, no logos.`;

  let buf: Buffer;
  try {
    buf = await generateConceptImage({ apiKey, prompt, size, quality: "medium" });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Image generation failed." };
  }

  const stored = await saveBuffer(quotation.companyId, buf, "image/png", "ai-concept");
  await prisma.attachment.create({
    data: {
      companyId: quotation.companyId,
      kind: "MOODBOARD",
      url: stored.url,
      filename: `AI concept — ${desc.slice(0, 48)}`,
      mimeType: stored.mimeType,
      sizeBytes: stored.size,
      quotationId: quotation.id,
    },
  });
  revalidatePath(`/admin/quotations/${quotationId}`);
  return { error: "", ok: true };
}

// ── Step 1: analyse the customer's reference photos → 3 fresh concept designs ──
export async function generateConceptFromReferencesAction(
  quotationId: string,
  _prev: ConceptImageState,
  formData: FormData,
): Promise<ConceptImageState> {
  const user = await requireSalesRole();
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      company: true,
      lead: { include: { attachments: { where: { kind: "REFERENCE" } } } },
    },
  });
  if (!quotation || !canAccess(user, quotation.companyId)) return { error: "Not found." };

  // Two keys: the text/vision provider key for the brief (may be Claude), and an
  // OpenAI key for the renders (images are OpenAI-only). Resolve both up front so
  // we never spend the brief call when the render step can't run.
  const aiRes = resolveAiKey(quotation.company);
  if (!aiRes.ok) return { error: aiRes.error };
  const imgRes = resolveImageKey(quotation.company);
  if (!imgRes.ok) return { error: imgRes.error };
  if (isRateLimited(`ai-image:${user.id}`, AI_IMAGE_LIMIT).limited) {
    return { error: "Too many image generations — please wait a few minutes." };
  }
  // This action fans out to 3 gpt-image-1 renders, so it costs 3 limit units.
  for (let i = 0; i < 3; i++) recordFailure(`ai-image:${user.id}`, AI_IMAGE_LIMIT);

  const lead = quotation.lead;
  const references = (lead?.attachments ?? []).map((a) => a.url);
  const context = lead
    ? [
        `Event type: ${lead.eventType?.replace(/_/g, " ").toLowerCase() ?? ""}`,
        lead.theme ? `Theme / preferences: ${lead.theme}` : null,
        lead.purpose ? `Purpose: ${lead.purpose}` : null,
        lead.venueText ? `Venue: ${lead.venueText}` : null,
        lead.guestCount ? `Guests: ${lead.guestCount}` : null,
        lead.specialRequest ? `Special requests: ${lead.specialRequest}` : null,
        lead.message ? `Message: ${lead.message}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  if (references.length === 0 && !context.trim()) {
    return {
      error:
        "The customer hasn't uploaded reference photos or a description yet. Add them on the lead first.",
    };
  }

  const steer = String(formData.get("steer") ?? "");
  const size = String(formData.get("size") || "1024x1024");

  // Step 1 — analyse references + notes into a single design brief.
  let brief: string;
  try {
    brief = await analyzeReferencesToBrief({
      apiKey: aiRes.key,
      model: aiRes.model,
      imageUrls: references,
      context,
      steer,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not analyse the references." };
  }

  // Load the customer's actual reference photos as bytes so gpt-image-1 can
  // use them as the visual base (image-to-image). Falls back to text-only when
  // the customer didn't upload any photos.
  const refImages = (
    await Promise.all(references.slice(0, 4).map(readUploadBytes))
  )
    .filter((x): x is { buf: Buffer; mime: string } => Boolean(x))
    .map((x, i) => ({
      ...x,
      name: `ref${i}.${x.mime === "image/png" ? "png" : x.mime === "image/webp" ? "webp" : "jpg"}`,
    }));

  // Step 2 — render 3 distinct variations from that brief, in parallel.
  const angles = [
    "balanced hero composition, symmetrical centrepiece",
    "alternative colour balance with warmer accent lighting",
    "different layout with an asymmetric, editorial focal arrangement",
  ];
  const renders = await Promise.allSettled(
    angles.map((a) => {
      const prompt = `${brief}\n\nStyling variation: ${a}. Professional, photorealistic event & decoration render, beautiful lighting, high-end editorial photography. No text, no watermark, no logos.`;
      return refImages.length > 0
        ? editConceptFromImages({ apiKey: imgRes.key, prompt, images: refImages, size, quality: "medium" })
        : generateConceptImage({ apiKey: imgRes.key, prompt, size, quality: "medium" });
    }),
  );

  let saved = 0;
  for (let i = 0; i < renders.length; i++) {
    const r = renders[i];
    if (r.status !== "fulfilled") continue;
    const stored = await saveBuffer(quotation.companyId, r.value, "image/png", "ai-concept");
    await prisma.attachment.create({
      data: {
        companyId: quotation.companyId,
        kind: "MOODBOARD",
        url: stored.url,
        filename: `AI concept (from references) v${i + 1}`,
        mimeType: stored.mimeType,
        sizeBytes: stored.size,
        quotationId: quotation.id,
      },
    });
    saved++;
  }

  if (saved === 0) {
    const firstErr = renders.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    const reason = firstErr?.reason;
    return {
      error: reason instanceof Error ? reason.message : "Image generation failed.",
    };
  }

  revalidatePath(`/admin/quotations/${quotationId}`);
  return { error: "", ok: true };
}

export async function deleteQuotationImageAction(attachmentId: string, _formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att || !att.quotationId) return;
  if (!canAccess(user, att.companyId)) return;
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/admin/quotations/${att.quotationId}`);
}

// ── Save manual edits to lines + settings ──
export async function updateQuotationAction(
  quotationId: string,
  _prev: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  const user = await requireSalesRole();
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { company: true },
  });
  if (!quotation || !canAccess(user, quotation.companyId)) return { error: "Not found." };

  let lines;
  try {
    lines = z.array(LineSchema).parse(JSON.parse(String(formData.get("lines") ?? "[]")));
  } catch {
    return { error: "Could not read the line items." };
  }

  // Finite-guard + clamp every numeric field so a non-numeric form value can't
  // write NaN into the quotation's Decimal columns (and through computeTotals).
  const num = (k: string, min: number, max: number): number => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  };
  const profitDefault = num("profitPercentDefault", -100, 100000);
  const discount = num("discount", 0, 100000000);
  const depositPercent = num("depositPercent", 0, 100);
  // SST only applies for SST-registered companies; the rate always comes from
  // the company's current billing settings, never a stale stored value.
  const sstApplied =
    quotation.company.sstRegistered && formData.get("sstApplied") === "on";
  const sstRate = sstApplied ? Number(quotation.company.sstRate) : 0;
  // Malaysia B2B same-category service-tax exemption — voids the SST.
  const b2bExempt =
    quotation.company.sstRegistered && formData.get("b2bExempt") === "on";
  const customerSstNumber = String(formData.get("customerSstNumber") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");

  const docStr = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const eventDateRaw = docStr("eventDate");

  await prisma.quotationItem.deleteMany({ where: { quotationId } });
  if (lines.length > 0) {
    await prisma.quotationItem.createMany({
      data: lines.map((l, i) => ({
        quotationId,
        companyId: quotation.companyId,
        description: l.description,
        category: l.category || null,
        quantity: l.quantity,
        unit: l.unit,
        costPrice: l.costPrice,
        profitPercent: l.profitPercent,
        unitPrice: unitPrice(l.costPrice, l.profitPercent),
        lineTotal: lineTotal(l.quantity, l.costPrice, l.profitPercent),
        referenceImageUrl: l.referenceImageUrl || null,
        sortOrder: i,
      })),
    });
  }

  await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      profitPercentDefault: profitDefault,
      discount,
      depositPercent,
      sstApplied,
      sstRate,
      b2bExempt,
      notes: notes || null,
      preparedBy: docStr("preparedBy"),
      eventDate: eventDateRaw ? new Date(eventDateRaw) : null,
      setupTime: docStr("setupTime"),
      startTime: docStr("startTime"),
      dismantleTime: docStr("dismantleTime"),
      venue: docStr("venue"),
    },
  });

  // Remember the B2B exemption on the customer so future documents auto-apply.
  if (quotation.customerId && (b2bExempt || customerSstNumber)) {
    await prisma.customer.update({
      where: { id: quotation.customerId },
      data: {
        sstB2bExempt: b2bExempt,
        ...(customerSstNumber ? { sstNumber: customerSstNumber } : {}),
      },
    });
  }

  await recomputeQuotation(quotationId);
  revalidatePath(`/admin/quotations/${quotationId}`);
  return { error: "", ok: true };
}

export async function sendQuotationAction(
  quotationId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireSalesRole();
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { customer: true, company: true, lead: { include: { customer: true } } },
  });
  if (!quotation || !canAccess(user, quotation.companyId)) redirect("/admin/quotations");

  // Fresh access code on every send (each version gets a new password).
  const viewPin = (parseInt(randomBytes(4).toString("hex"), 16) % 1000000)
    .toString()
    .padStart(6, "0");
  await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      viewPin,
      changesRequested: false,
    },
  });
  if (quotation.leadId) {
    await prisma.lead.update({ where: { id: quotation.leadId }, data: { status: "QUOTED" } });
  }
  // Resolve a real recipient; only enqueue if we have a deliverable address.
  const recipient =
    quotation.customer?.email ?? quotation.lead?.customer?.email ?? null;
  if (recipient) {
    await prisma.emailLog
      .create({
        data: {
          companyId: quotation.companyId,
          to: recipient,
          subject: `Quotation ${quotation.number} from ${quotation.company.name}`,
          template: "quotation_sent",
          status: "queued",
        },
      })
      .catch(() => undefined);
  }

  revalidatePath(`/admin/quotations/${quotationId}`);
}

// ── Recompute & persist totals from stored line items ──
async function recomputeQuotation(quotationId: string): Promise<void> {
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { items: true },
  });
  if (!q) return;

  const totals = computeTotals({
    lines: q.items.map((it) => ({
      quantity: Number(it.quantity),
      costPrice: Number(it.costPrice),
      profitPercent: Number(it.profitPercent),
    })),
    discount: Number(q.discount),
    sstApplied: q.sstApplied,
    sstRate: Number(q.sstRate),
    depositPercent: Number(q.depositPercent),
    b2bExempt: q.b2bExempt,
  });

  await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      subtotal: totals.subtotal,
      sstAmount: totals.sstAmount,
      total: totals.total,
      depositAmount: totals.depositAmount,
    },
  });
}
