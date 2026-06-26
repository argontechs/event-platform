"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import { round2, round05 } from "../quotations/calc";

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

    // Atomic relative increment — never recompute the balance from a stale read.
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        depositPaid: { increment: Number(payment.amount) },
        status: booking.status === "CONFIRMED" ? "IN_PLANNING" : booking.status,
      },
      select: { depositPaid: true, totalAmount: true },
    });
    const totalAmount = Number(updated.totalAmount);
    const paid = Number(updated.depositPaid);
    const bookingBalance = Math.max(0, round2(totalAmount - paid));
    await tx.booking.update({ where: { id: booking.id }, data: { balanceDue: bookingBalance } });

    // Invoice money snapshot — rounded to 5 sen like every other invoice path,
    // copying the quote's discount / b2bExempt / SST breakdown so it reconciles.
    const invTotal = q ? round05(Number(q.total)) : round05(totalAmount);
    const money = q
      ? {
          subtotal: Number(q.subtotal),
          discount: Number(q.discount),
          sstApplied: q.sstApplied,
          b2bExempt: q.b2bExempt,
          sstRate: Number(q.sstRate),
          sstAmount: Number(q.sstAmount),
          rounding: round2(invTotal - Number(q.total)),
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

    // One invoice per booking: create on first confirm, update on later payments.
    const existing = await tx.invoice.findFirst({
      where: { bookingId: booking.id },
      select: { id: true, number: true },
    });
    if (existing) {
      await tx.invoice.update({
        where: { id: existing.id },
        data: { ...money, items, type: invType, status: invStatus, amountPaid: paid, balanceDue: invBalance },
      });
      return { status: "updated" as const };
    }

    // Allocate the number inside the txn so a failed create rolls it back (no gaps).
    const seqRow = await tx.company.update({
      where: { id: company.id },
      data: { invoiceNextSeq: { increment: 1 } },
      select: { invoiceNextSeq: true },
    });
    const number = `${company.invoicePrefix}-${String(seqRow.invoiceNextSeq - 1).padStart(4, "0")}`;
    await tx.invoice.create({
      data: {
        companyId: company.id,
        bookingId: booking.id,
        quotationId: q?.id ?? null,
        number,
        type: invType,
        status: invStatus,
        customerSnapshot,
        items,
        ...money,
        amountPaid: paid,
        balanceDue: invBalance,
      },
    });
    return { status: "issued" as const, number };
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
