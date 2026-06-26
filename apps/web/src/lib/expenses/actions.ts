"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin, canManageCompany } from "../auth/rbac";
import { getActiveCompanyId } from "../tenant";
import { decryptSecret } from "../crypto";
import { saveUpload } from "../storage";
import { extractReceipt, type ReceiptData } from "../ai/openai";
import type { SessionUser } from "../auth/session";

const CATEGORIES = ["MATERIALS", "TRANSPORT", "RENTAL", "FOOD", "MARKETING", "SALARY", "MISC"];

function canAccess(user: SessionUser, companyId: string): boolean {
  return isSuperAdmin(user) || user.companyId === companyId;
}
async function resolveCompanyId(user: SessionUser): Promise<string | null> {
  return isSuperAdmin(user) ? await getActiveCompanyId(user) : user.companyId;
}

// ── Step 1: OCR an uploaded receipt → prefill data ──
export type ExpenseExtractState = {
  error: string;
  ok?: boolean;
  data?: ReceiptData;
  receiptUrls?: string; // comma-separated saved upload urls (reused on submit)
};

export async function extractReceiptAction(
  _prev: ExpenseExtractState,
  formData: FormData,
): Promise<ExpenseExtractState> {
  const user = await requireUser();
  const companyId = await resolveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };

  const files = formData
    .getAll("receipts")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one receipt image." };

  const urls: string[] = [];
  for (const f of files) {
    const stored = await saveUpload(companyId, f);
    if (stored) urls.push(stored.url);
  }
  if (urls.length === 0) return { error: "Upload failed — try a clearer photo." };

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  // Respect the aiEnabled flag and never silently bill the platform key when a
  // company's stored key won't decrypt — fall back to manual entry instead.
  let apiKey: string | null = null;
  if (company?.aiEnabled) {
    apiKey = company.aiApiKeyEnc
      ? decryptSecret(company.aiApiKeyEnc)
      : process.env.OPENAI_API_KEY ?? null;
  }
  if (!apiKey) {
    // No usable AI key — still return the saved receipts so the user can fill manually.
    return { error: "", ok: true, receiptUrls: urls.join(",") };
  }
  try {
    const data = await extractReceipt({
      apiKey,
      model: company?.aiModel ?? "gpt-4o",
      imageUrls: urls,
    });
    return { error: "", ok: true, data, receiptUrls: urls.join(",") };
  } catch (err) {
    // Keep the uploaded receipts even if OCR fails, so nothing is lost.
    return {
      error: err instanceof Error ? err.message : "Could not read the receipt — fill it in manually.",
      ok: true,
      receiptUrls: urls.join(","),
    };
  }
}

// ── Step 2: submit the claim ──
export type ExpenseSubmitState = { error: string };

export async function submitExpenseAction(
  _prev: ExpenseSubmitState,
  formData: FormData,
): Promise<ExpenseSubmitState> {
  const user = await requireUser();
  const companyId = await resolveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };

  const vendor = String(formData.get("vendor") ?? "").trim();
  if (!vendor) return { error: "Vendor / shop name is required." };
  const amountRaw = Number(formData.get("amount"));
  const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
  if (amount <= 0) return { error: "Enter the amount paid." };

  const dateStr = String(formData.get("expenseDate") ?? "");
  const expenseDate = dateStr ? new Date(dateStr) : new Date();
  const catRaw = String(formData.get("category") ?? "MISC").toUpperCase();
  const category = CATEGORIES.includes(catRaw) ? catRaw : "MISC";
  // Only link a booking that belongs to this company (no cross-tenant FK).
  const bookingIdRaw = String(formData.get("bookingId") ?? "") || null;
  let bookingId: string | null = null;
  if (bookingIdRaw) {
    const b = await prisma.booking.findFirst({ where: { id: bookingIdRaw, companyId }, select: { id: true } });
    bookingId = b ? b.id : null;
  }
  const receiptUrls = String(formData.get("receiptUrls") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const expense = await prisma.expense.create({
    data: {
      companyId,
      submittedById: user.id,
      bookingId,
      vendor,
      expenseDate,
      category: category as never,
      amount,
      sstAmount: (() => { const n = Number(formData.get("sstAmount")); return Number.isFinite(n) && n > 0 ? n : 0; })(),
      paymentMethod: String(formData.get("paymentMethod") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
      status: "SUBMITTED",
    },
  });

  for (const url of receiptUrls.slice(0, 6)) {
    await prisma.attachment.create({
      data: { companyId, kind: "RECEIPT", url, expenseId: expense.id, uploadedById: user.id },
    });
  }

  revalidatePath("/admin/expenses");
  redirect(`/admin/expenses/${expense.id}`);
}

// ── Approve / reject / reimburse (managers only) ──
async function setStatus(
  expenseId: string,
  status: "APPROVED" | "REJECTED" | "REIMBURSED",
): Promise<void> {
  const user = await requireUser();
  if (!canManageCompany(user)) return;
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || !canAccess(user, expense.companyId)) return;

  // Enforce legal transitions atomically: approve/reject only from SUBMITTED,
  // reimburse only from APPROVED. The conditional WHERE is the guard, so a
  // REJECTED claim can't be re-approved and SUBMITTED can't jump to REIMBURSED.
  const from = status === "REIMBURSED" ? "APPROVED" : "SUBMITTED";
  const data =
    status === "REIMBURSED"
      ? { status } // preserve the original approver on reimburse
      : { status, approvedById: user.id, approvedAt: new Date() };
  const res = await prisma.expense.updateMany({
    where: { id: expenseId, status: from },
    data: data as never,
  });
  if (res.count === 0) return;

  revalidatePath(`/admin/expenses/${expenseId}`);
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/finance");
}

export async function approveExpenseAction(expenseId: string, _fd: FormData): Promise<void> {
  await setStatus(expenseId, "APPROVED");
}
export async function rejectExpenseAction(expenseId: string, _fd: FormData): Promise<void> {
  await setStatus(expenseId, "REJECTED");
}
export async function markReimbursedAction(expenseId: string, _fd: FormData): Promise<void> {
  await setStatus(expenseId, "REIMBURSED");
}
