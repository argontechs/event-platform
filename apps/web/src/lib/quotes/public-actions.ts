"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { saveUpload } from "../storage";
import { round05 } from "../quotations/calc";
import { isRateLimited, recordFailure, clearAttempts } from "../rate-limit";

export type UnlockState = { error: string };

// 8 wrong PINs in 10 min → locked out for 15 min (the PIN is only 6 digits).
const PIN_LIMIT = { max: 8, windowMs: 10 * 60 * 1000, lockMs: 15 * 60 * 1000 };

// Token-bound write actions (accept / pay / request-changes) are rate-limited
// per token to stop email-amplification / DB churn from a single leaked link.
const WRITE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000, lockMs: 10 * 60 * 1000 };

// A mutating public action must prove the caller actually opened the proposal
// with the access code (the qv_<token> cookie === viewPin), not just hold the
// token. No-op when the quote has no PIN configured.
async function pinUnlocked(token: string, viewPin: string | null): Promise<boolean> {
  if (!viewPin) return true;
  const store = await cookies();
  const c = store.get(`qv_${token}`)?.value;
  return !!c && c.length === viewPin.length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(viewPin));
}

/** Customer enters the access code to open a password-protected proposal. */
export async function unlockQuoteAction(
  token: string,
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const rlKey = `quote-pin:${token}`;
  const gate = isRateLimited(rlKey, PIN_LIMIT);
  if (gate.limited) {
    return { error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minute(s).` };
  }

  const q = await prisma.quotation.findUnique({
    where: { publicToken: token },
    select: { viewPin: true },
  });
  if (!q) return { error: "This link is invalid." };
  const pin = String(formData.get("pin") ?? "").trim();
  // Constant-time compare on equal-length buffers (timingSafeEqual throws otherwise).
  const ok =
    !!q.viewPin &&
    pin.length === q.viewPin.length &&
    crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(q.viewPin));
  if (!ok) {
    recordFailure(rlKey, PIN_LIMIT);
    return { error: "Incorrect access code." };
  }
  clearAttempts(rlKey);

  const store = await cookies();
  store.set(`qv_${token}`, pin, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: `/q/${token}`,
    maxAge: 60 * 60 * 24 * 7,
  });
  revalidatePath(`/q/${token}`);
  return { error: "" };
}

export type ChangeState = { error: string; ok?: boolean };

/** Customer requests changes: comment + optional images → back to the BO. */
export async function requestChangesAction(
  token: string,
  _prev: ChangeState,
  formData: FormData,
): Promise<ChangeState> {
  const q = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: { company: true },
  });
  if (!q) return { error: "Not found." };
  if (isRateLimited(`quote-write:${token}`, WRITE_LIMIT).limited) {
    return { error: "Too many requests. Please try again in a few minutes." };
  }
  if (!(await pinUnlocked(token, q.viewPin))) {
    return { error: "Please open the proposal with your access code first." };
  }
  recordFailure(`quote-write:${token}`, WRITE_LIMIT);
  // Only a live (sent, not yet accepted) proposal can be revised.
  if (q.status !== "SENT") return { error: "This proposal can no longer be changed." };

  const comment = String(formData.get("comment") ?? "").trim();
  if (!comment) return { error: "Please tell us what you'd like changed." };

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    try {
      const stored = await saveUpload(q.companyId, file);
      if (!stored) continue;
      await prisma.attachment.create({
        data: {
          companyId: q.companyId,
          kind: "REFERENCE",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          leadId: q.leadId ?? undefined,
          quotationId: q.id,
        },
      });
    } catch {
      // skip bad file
    }
  }

  await prisma.quotation.update({
    where: { id: q.id },
    data: {
      customerFeedback: comment,
      changesRequested: true,
      revisionCount: { increment: 1 },
    },
  });
  if (q.leadId) {
    await prisma.lead.update({ where: { id: q.leadId }, data: { status: "REVIEWING" } });
  }
  if (q.company.email) {
    await prisma.emailLog
      .create({
        data: {
          companyId: q.companyId,
          to: q.company.email,
          subject: `Changes requested on ${q.number}`,
          template: "changes_requested",
          status: "queued",
        },
      })
      .catch(() => undefined);
  }

  revalidatePath(`/q/${token}`);
  return { error: "", ok: true };
}

/** Customer accepts the quote → a booking is created (awaiting deposit). */
export async function acceptQuoteAction(token: string): Promise<void> {
  const q = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: { lead: true, booking: true },
  });
  // Only an in-flight, unexpired proposal can be accepted — never a
  // rejected/expired/draft one, and never re-accept an already-accepted one.
  if (!q || q.status !== "SENT") return;
  if (q.validUntil && q.validUntil < new Date()) return;
  if (isRateLimited(`quote-write:${token}`, WRITE_LIMIT).limited) return;
  if (!(await pinUnlocked(token, q.viewPin))) return; // token alone can't accept
  recordFailure(`quote-write:${token}`, WRITE_LIMIT);

  const total = round05(Number(q.total));

  await prisma.$transaction(async (tx) => {
    // Conditional claim doubles as the lock: a concurrent/double-click accept
    // matches 0 rows here and bails, so the booking is created exactly once.
    const claim = await tx.quotation.updateMany({
      where: { id: q.id, status: "SENT" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claim.count === 0) return;

    if (!q.booking) {
      await tx.booking.create({
        data: {
          companyId: q.companyId,
          quotationId: q.id,
          customerId: q.customerId,
          title: q.lead ? `${q.lead.eventType} — ${q.number}` : q.number,
          eventType: q.lead?.eventType ?? "OTHER",
          eventDate: q.lead?.eventDate ?? null,
          venueText: q.lead?.venueText ?? null,
          status: "CONFIRMED",
          totalAmount: total,
          depositPaid: 0,
          balanceDue: total,
        },
      });
    }
    if (q.leadId) {
      await tx.lead.update({ where: { id: q.leadId }, data: { status: "ACCEPTED" } });
    }
  });

  revalidatePath(`/q/${token}`);
}

export type ProofState = { error: string; ok?: boolean };

/** Customer uploads proof of the deposit payment (pending staff confirmation). */
export async function submitPaymentProofAction(
  token: string,
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const q = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: { booking: true, company: true },
  });
  if (!q) return { error: "Quote not found." };
  if (isRateLimited(`quote-write:${token}`, WRITE_LIMIT).limited) {
    return { error: "Too many requests. Please try again in a few minutes." };
  }
  if (!(await pinUnlocked(token, q.viewPin))) {
    return { error: "Please open the proposal with your access code first." };
  }
  recordFailure(`quote-write:${token}`, WRITE_LIMIT);
  if (q.status !== "ACCEPTED") return { error: "This proposal is not open for payment." };
  if (!q.booking) return { error: "Please accept the quote first." };

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid payment amount." };
  }
  // Cap against the outstanding balance (small tolerance for cash rounding) so
  // a customer can't record an arbitrarily large "paid" figure.
  const balanceDue = Number(q.booking.balanceDue);
  if (balanceDue > 0 && amount > balanceDue + 0.05) {
    return { error: `Amount exceeds the outstanding balance (RM ${balanceDue.toFixed(2)}).` };
  }
  const method = String(formData.get("method") ?? "BANK_TRANSFER");
  const reference = String(formData.get("reference") ?? "");
  // First money in is the deposit; anything after a deposit exists is a balance payment.
  const paymentType = Number(q.booking.depositPaid) > 0 ? "BALANCE" : "DEPOSIT";

  const payment = await prisma.payment.create({
    data: {
      companyId: q.companyId,
      bookingId: q.booking.id,
      type: paymentType,
      method: method === "DUITNOW_QR" ? "DUITNOW_QR" : "BANK_TRANSFER",
      amount,
      reference: reference || null,
      status: "PENDING",
    },
  });

  const proof = formData.get("proof");
  if (proof instanceof File && proof.size > 0) {
    const stored = await saveUpload(q.companyId, proof);
    if (stored) {
      await prisma.attachment.create({
        data: {
          companyId: q.companyId,
          kind: "PAYMENT_PROOF",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          paymentId: payment.id,
        },
      });
    }
  }

  if (q.company.email) {
    await prisma.emailLog
      .create({
        data: {
          companyId: q.companyId,
          to: q.company.email,
          subject: `Payment proof received for ${q.number}`,
          template: "payment_proof_received",
          status: "queued",
        },
      })
      .catch(() => undefined);
  }

  revalidatePath(`/q/${token}`);
  return { error: "", ok: true };
}
