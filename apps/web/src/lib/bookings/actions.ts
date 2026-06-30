"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@event/db";
import type { BookingStatus, PaymentType, PaymentMethod } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import { round2, round05 } from "../quotations/calc";
import { saveUpload } from "../storage";

async function seedPlanningTasks(
  bookingId: string,
  companyId: string,
  eventType: string,
): Promise<void> {
  const existing = await prisma.planningTask.count({ where: { bookingId } });
  if (existing > 0) return;

  const tpl =
    (await prisma.checklistTemplate.findFirst({
      where: { companyId, eventType: eventType as never },
    })) ??
    (await prisma.checklistTemplate.findFirst({
      where: { companyId: null, eventType: eventType as never },
    })) ??
    (await prisma.checklistTemplate.findFirst({
      where: { companyId: null, eventType: "OTHER" as never },
    }));
  if (!tpl) return;

  const items = Array.isArray(tpl.items)
    ? (tpl.items as { title: string; category?: string }[])
    : [];
  if (items.length === 0) return;

  await prisma.planningTask.createMany({
    data: items.map((it, i) => ({
      companyId,
      bookingId,
      title: it.title,
      category: it.category ?? null,
      sortOrder: i,
    })),
  });
}

/**
 * Shared money effects of a CONFIRMED payment, run inside a transaction by both
 * confirmPaymentAction and recordPaymentAction — single source of truth so the
 * two paths can never diverge.
 *
 * Ordering matters: the `depositPaid` increment takes an exclusive row lock on
 * the booking BEFORE the invoice lookup, serialising concurrent confirm/record
 * transactions so only one invoice is ever created per booking. Do not move the
 * invoice.findFirst ahead of the increment.
 */
async function applyConfirmedPayment(
  tx: Prisma.TransactionClient,
  args: {
    bookingId: string;
    bookingStatus: BookingStatus;
    companyId: string;
    invoicePrefix: string;
    quote: {
      id: string;
      subtotal: number;
      discount: number;
      sstApplied: boolean;
      b2bExempt: boolean;
      sstRate: number;
      sstAmount: number;
      total: number;
    } | null;
    customerSnapshot: { name: string; email?: string; phone?: string } | undefined;
    items: { description: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }[];
    amount: number;
  },
): Promise<{ status: "updated" } | { status: "issued"; number: string }> {
  const updated = await tx.booking.update({
    where: { id: args.bookingId },
    data: {
      depositPaid: { increment: args.amount },
      status: args.bookingStatus === "CONFIRMED" ? "IN_PLANNING" : args.bookingStatus,
    },
    select: { depositPaid: true, totalAmount: true },
  });
  const totalAmount = Number(updated.totalAmount);
  const paid = Number(updated.depositPaid);
  const bookingBalance = Math.max(0, round2(totalAmount - paid));
  await tx.booking.update({ where: { id: args.bookingId }, data: { balanceDue: bookingBalance } });

  const q = args.quote;
  const invTotal = q ? round05(q.total) : round05(totalAmount);
  const money = q
    ? {
        subtotal: q.subtotal,
        discount: q.discount,
        sstApplied: q.sstApplied,
        b2bExempt: q.b2bExempt,
        sstRate: q.sstRate,
        sstAmount: q.sstAmount,
        rounding: round2(invTotal - q.total),
        total: invTotal,
      }
    : {
        subtotal: invTotal,
        discount: 0,
        sstApplied: false,
        b2bExempt: false,
        sstRate: 0,
        sstAmount: 0,
        rounding: round2(invTotal - totalAmount),
        total: invTotal,
      };
  const invBalance = Math.max(0, round2(invTotal - paid));
  const invType = invBalance <= 0 ? "FULL" : "DEPOSIT";
  const invStatus = invBalance <= 0 ? "PAID" : "PARTIAL";

  // Reuse an invoice already on this booking, OR one issued earlier from the same
  // quotation via the "Create invoice" button (bookingId still null) — so the two
  // paths can't produce duplicate invoices. On reuse, link it to the booking.
  const existing = await tx.invoice.findFirst({
    where: q
      ? { OR: [{ bookingId: args.bookingId }, { quotationId: q.id }] }
      : { bookingId: args.bookingId },
    select: { id: true },
  });
  if (existing) {
    await tx.invoice.update({
      where: { id: existing.id },
      data: {
        ...money,
        items: args.items,
        type: invType,
        status: invStatus,
        amountPaid: paid,
        balanceDue: invBalance,
        bookingId: args.bookingId,
      },
    });
    return { status: "updated" };
  }

  const seqRow = await tx.company.update({
    where: { id: args.companyId },
    data: { invoiceNextSeq: { increment: 1 } },
    select: { invoiceNextSeq: true },
  });
  const number = `${args.invoicePrefix}-${String(seqRow.invoiceNextSeq - 1).padStart(4, "0")}`;
  await tx.invoice.create({
    data: {
      companyId: args.companyId,
      bookingId: args.bookingId,
      quotationId: q?.id ?? null,
      number,
      type: invType,
      status: invStatus,
      customerSnapshot: args.customerSnapshot,
      items: args.items,
      ...money,
      amountPaid: paid,
      balanceDue: invBalance,
    },
  });
  return { status: "issued", number };
}

/**
 * Staff confirms a (pending) payment:
 *  - mark payment CONFIRMED, update booking deposit/balance
 *  - move booking into planning + seed checklist tasks
 *  - issue a branded invoice (per-company numbering + SST snapshot)
 */
export async function confirmPaymentAction(
  paymentId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireSalesRole();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          company: true,
          customer: true,
          quotation: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      },
    },
  });
  if (!payment) redirect("/admin/bookings");
  if (!isSuperAdmin(user) && user.companyId !== payment.companyId) {
    redirect("/admin/bookings");
  }
  const booking = payment.booking;
  if (!booking) redirect("/admin/bookings");

  const company = booking.company;
  const q = booking.quotation;
  const customerSnapshot = booking.customer
    ? {
        name: booking.customer.name,
        email: booking.customer.email ?? undefined,
        phone: booking.customer.phone ?? undefined,
      }
    : undefined;
  const items = q
    ? q.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      }))
    : [];

  // Whole confirmation is atomic + idempotent. The conditional updateMany is the
  // lock: only the first caller flips PENDING→CONFIRMED (count===1), so a
  // double-click / retry / concurrent confirm can never double-issue or
  // double-count the deposit.
  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById: user.id },
    });
    if (claim.count === 0) return { status: "already" as const };

    return applyConfirmedPayment(tx, {
      bookingId: booking.id,
      bookingStatus: booking.status,
      companyId: company.id,
      invoicePrefix: company.invoicePrefix,
      quote: q
        ? {
            id: q.id,
            subtotal: Number(q.subtotal),
            discount: Number(q.discount),
            sstApplied: q.sstApplied,
            b2bExempt: q.b2bExempt,
            sstRate: Number(q.sstRate),
            sstAmount: Number(q.sstAmount),
            total: Number(q.total),
          }
        : null,
      customerSnapshot,
      items,
      amount: Number(payment.amount),
    });
  });

  if (result.status === "already") {
    redirect(`/admin/bookings/${booking.id}`);
  }

  // Idempotent; safe to run after commit.
  await seedPlanningTasks(booking.id, booking.companyId, booking.eventType);

  if (result.status === "issued") {
    const invoiceRecipient = booking.customer?.email ?? company.email ?? null;
    if (invoiceRecipient) {
      await prisma.emailLog
        .create({
          data: {
            companyId: company.id,
            to: invoiceRecipient,
            subject: `Invoice ${result.number} from ${company.name}`,
            template: "invoice_issued",
            status: "queued",
          },
        })
        .catch(() => undefined);
    }
  }

  revalidatePath(`/admin/bookings/${booking.id}`);
}

export type RecordPaymentState = { error: string; ok?: boolean };

const PAYMENT_TYPES = ["DEPOSIT", "BALANCE", "OTHER"];
const PAYMENT_METHODS = ["BANK_TRANSFER", "DUITNOW_QR", "CASH", "OTHER"];

/**
 * Staff records an offline payment (bank transfer / DuitNow / cash) directly —
 * the counterpart to confirmPaymentAction for money that arrives off-platform.
 * Creates a CONFIRMED payment and applies the same effects via the shared helper.
 */
export async function recordPaymentAction(
  bookingId: string,
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const user = await requireSalesRole();
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      company: true,
      customer: true,
      quotation: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!booking || (!isSuperAdmin(user) && user.companyId !== booking.companyId)) {
    return { error: "Not found." };
  }
  if (booking.status === "CANCELLED") {
    return { error: "This booking is cancelled — payments can't be recorded." };
  }

  const amount = round2(Number(formData.get("amount")));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid payment amount." };
  }
  if (amount > 9_999_999.99) {
    return { error: "That amount looks too large — please check it." };
  }
  // Cap against the outstanding balance (parity with the customer flow) so a
  // fat-finger can't over-collect. Skipped when nothing is outstanding.
  const remaining = Number(booking.balanceDue);
  if (remaining > 0 && amount > remaining + 0.05) {
    return { error: `Amount exceeds the outstanding balance (RM ${remaining.toFixed(2)}).` };
  }

  const rawType = String(formData.get("type") ?? "DEPOSIT");
  const type: PaymentType = (PAYMENT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as PaymentType)
    : "DEPOSIT";
  const rawMethod = String(formData.get("method") ?? "BANK_TRANSFER");
  const method: PaymentMethod = (PAYMENT_METHODS as readonly string[]).includes(rawMethod)
    ? (rawMethod as PaymentMethod)
    : "BANK_TRANSFER";
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 200) || null;

  const company = booking.company;
  const q = booking.quotation;
  const customerSnapshot = booking.customer
    ? {
        name: booking.customer.name,
        email: booking.customer.email ?? undefined,
        phone: booking.customer.phone ?? undefined,
      }
    : undefined;
  const items = q
    ? q.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      }))
    : [];

  const result = await prisma.$transaction(async (tx) => {
    // Dedupe: if this staff member just recorded an identical payment (network
    // retry / double-tab), don't create + double-count it.
    const dup = await tx.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: "CONFIRMED",
        amount,
        type,
        reference,
        recordedById: user.id,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      select: { id: true },
    });
    if (dup) return { status: "duplicate" as const, paymentId: dup.id };

    const created = await tx.payment.create({
      data: {
        companyId: booking.companyId,
        bookingId: booking.id,
        type,
        method,
        amount,
        reference,
        status: "CONFIRMED",
        recordedById: user.id,
        confirmedById: user.id,
        confirmedAt: new Date(),
      },
      select: { id: true },
    });
    const applied = await applyConfirmedPayment(tx, {
      bookingId: booking.id,
      bookingStatus: booking.status,
      companyId: company.id,
      invoicePrefix: company.invoicePrefix,
      quote: q
        ? {
            id: q.id,
            subtotal: Number(q.subtotal),
            discount: Number(q.discount),
            sstApplied: q.sstApplied,
            b2bExempt: q.b2bExempt,
            sstRate: Number(q.sstRate),
            sstAmount: Number(q.sstAmount),
            total: Number(q.total),
          }
        : null,
      customerSnapshot,
      items,
      amount,
    });
    return { ...applied, paymentId: created.id };
  });

  if (result.status === "duplicate") {
    return { error: "", ok: true };
  }

  // Post-commit work is best-effort: once the payment is committed it must never
  // surface as a client error (which would induce a retry → a duplicate payment).
  try {
    await seedPlanningTasks(booking.id, booking.companyId, booking.eventType);
  } catch {
    /* planning seed is non-critical */
  }
  const proof = formData.get("proof");
  if (proof instanceof File && proof.size > 0) {
    try {
      const stored = await saveUpload(booking.companyId, proof);
      if (stored) {
        await prisma.attachment.create({
          data: {
            companyId: booking.companyId,
            kind: "PAYMENT_PROOF",
            url: stored.url,
            filename: stored.filename,
            mimeType: stored.mimeType,
            sizeBytes: stored.size,
            paymentId: result.paymentId,
          },
        });
      }
    } catch {
      /* proof is optional */
    }
  }
  if (result.status === "issued") {
    const invoiceRecipient = booking.customer?.email ?? company.email ?? null;
    if (invoiceRecipient) {
      await prisma.emailLog
        .create({
          data: {
            companyId: company.id,
            to: invoiceRecipient,
            subject: `Invoice ${result.number} from ${company.name}`,
            template: "invoice_issued",
            status: "queued",
          },
        })
        .catch(() => undefined);
    }
  }
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { error: "", ok: true };
}
