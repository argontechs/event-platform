"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import { round2, round05 } from "../quotations/calc";

const ItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().finite().min(0).max(1_000_000).default(1),
  unit: z.string().default("unit"),
  unitPrice: z.coerce.number().finite().min(0).max(10_000_000).default(0),
});

export type InvoiceActionState = { error: string; ok?: boolean };

function canAccess(user: { role: string; companyId: string | null }, companyId: string): boolean {
  return user.role === "SUPER_ADMIN" || user.companyId === companyId;
}

// ── Create a blank invoice under a chosen company (then edit its lines) ──
export async function createManualInvoiceAction(formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId || !canAccess(user, companyId)) redirect("/admin/invoices");

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) redirect("/admin/invoices");

  // Atomically allocate the next invoice number.
  const seqRow = await prisma.company.update({
    where: { id: company.id },
    data: { invoiceNextSeq: { increment: 1 } },
    select: { invoiceNextSeq: true },
  });
  const number = `${company.invoicePrefix}-${String(seqRow.invoiceNextSeq - 1).padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      companyId: company.id,
      number,
      type: "FULL",
      status: "ISSUED",
      items: [],
      sstApplied: company.sstRegistered,
      sstRate: company.sstRegistered ? company.sstRate : 0,
    },
  });

  redirect(`/admin/invoices/${invoice.id}/edit`);
}

// ── Generate a draft invoice from a quotation (for staff review before send) ──
export async function createInvoiceFromQuotationAction(
  quotationId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireSalesRole();
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      company: true,
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      booking: { select: { id: true } },
    },
  });
  if (!q || !canAccess(user, q.companyId)) redirect("/admin/quotations");

  // Idempotent: if an invoice already exists for this quote (or for its booking,
  // e.g. one auto-issued when a payment was confirmed), open that one instead of
  // issuing a duplicate. ponytail: manual admin button, no lock — add a unique
  // index on quotationId if rapid double-submit ever produces dupes in practice.
  const existingInvoice = await prisma.invoice.findFirst({
    where: { OR: [{ quotationId: q.id }, ...(q.booking ? [{ bookingId: q.booking.id }] : [])] },
    select: { id: true },
  });
  if (existingInvoice) redirect(`/admin/invoices/${existingInvoice.id}`);

  const company = q.company;
  const items = q.items.map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    lineTotal: Number(it.lineTotal),
  }));

  // The findFirst above handles the sequential case. The real backstop against a
  // concurrent double-submit (or a payment auto-issuing at the same instant) is
  // the unique index on Invoice.quotationId: at most one invoice per quote.
  // Increment the seq + create atomically so a lost race wastes no invoice number,
  // then turn the P2002 collision into an idempotent redirect to the winner.
  let invoiceId: string;
  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const seqRow = await tx.company.update({
        where: { id: company.id },
        data: { invoiceNextSeq: { increment: 1 } },
        select: { invoiceNextSeq: true },
      });
      const number = `${company.invoicePrefix}-${String(seqRow.invoiceNextSeq - 1).padStart(4, "0")}`;
      return tx.invoice.create({
        data: {
          companyId: company.id,
          quotationId: q.id,
          number,
          type: "FULL",
          status: "ISSUED",
          customerSnapshot: q.customer
            ? {
                name: q.customer.name,
                email: q.customer.email ?? undefined,
                phone: q.customer.phone ?? undefined,
                sstNumber: q.customer.sstNumber ?? undefined,
              }
            : undefined,
          items,
          subtotal: Number(q.subtotal),
          discount: Number(q.discount),
          sstApplied: q.sstApplied,
          b2bExempt: q.b2bExempt,
          sstRate: Number(q.sstRate),
          sstAmount: Number(q.sstAmount),
          rounding: round2(round05(Number(q.total)) - Number(q.total)),
          total: round05(Number(q.total)),
          amountPaid: 0,
          balanceDue: round05(Number(q.total)),
          preparedBy: q.preparedBy,
          eventDate: q.eventDate,
          setupTime: q.setupTime,
          startTime: q.startTime,
          dismantleTime: q.dismantleTime,
          venue: q.venue,
        },
        select: { id: true },
      });
    });
    invoiceId = invoice.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const won = await prisma.invoice.findFirst({ where: { quotationId: q.id }, select: { id: true } });
      if (won) redirect(`/admin/invoices/${won.id}`);
    }
    throw e;
  }

  redirect(`/admin/invoices/${invoiceId}`);
}

// ── Edit an issued invoice (line items, customer, SST) and recompute totals ──
export async function updateInvoiceAction(
  invoiceId: string,
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const user = await requireSalesRole();
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true },
  });
  if (!inv || (!isSuperAdmin(user) && user.companyId !== inv.companyId)) {
    return { error: "Not found." };
  }

  const number = String(formData.get("number") ?? "").trim();
  if (!number) return { error: "Invoice number cannot be empty." };
  if (number.length > 50) return { error: "Invoice number is too long (max 50 characters)." };
  if (number !== inv.number) {
    const clash = await prisma.invoice.findFirst({ where: { number, NOT: { id: invoiceId } }, select: { id: true } });
    if (clash) return { error: "That invoice number is already used by another invoice." };
  }

  let rawItems;
  try {
    rawItems = z.array(ItemSchema).parse(JSON.parse(String(formData.get("items") ?? "[]")));
  } catch {
    return { error: "Could not read the line items." };
  }

  const items = rawItems.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    lineTotal: round2(it.quantity * it.unitPrice),
  }));

  // SST only for SST-registered companies; rate from current company settings.
  // The Malaysia B2B same-category exemption voids the SST entirely.
  const sstApplied = inv.company.sstRegistered && formData.get("sstApplied") === "on";
  const b2bExempt = inv.company.sstRegistered && formData.get("b2bExempt") === "on";
  const customerSstNumber = String(formData.get("customerSstNumber") ?? "").trim();
  const sstRate = sstApplied ? Number(inv.company.sstRate) : 0;
  const discRaw = Number(formData.get("discount"));
  const discount = round2(Math.max(0, Number.isFinite(discRaw) ? discRaw : 0));
  const subtotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
  const afterDiscount = round2(Math.max(0, subtotal - discount));
  const sstAmount = sstApplied && !b2bExempt ? round2((afterDiscount * sstRate) / 100) : 0;
  const preRound = round2(afterDiscount + sstAmount);
  const total = round05(preRound);
  const rounding = round2(total - preRound);
  const amountPaid = Number(inv.amountPaid);
  const balanceDue = Math.max(0, round2(total - amountPaid));
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  const customer = {
    name: String(formData.get("custName") ?? "").trim() || undefined,
    email: String(formData.get("custEmail") ?? "").trim() || undefined,
    phone: String(formData.get("custPhone") ?? "").trim() || undefined,
    sstNumber: customerSstNumber || undefined,
  };

  const docStr = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const eventDateRaw = docStr("eventDate");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      number,
      items,
      customerSnapshot: customer,
      subtotal,
      discount,
      sstApplied,
      b2bExempt,
      sstRate,
      sstAmount,
      rounding,
      total,
      balanceDue,
      remarks,
      // Only PAID when money actually covers a positive total — a zero-total
      // (or edited-to-zero) invoice must not auto-flip to PAID with nothing paid.
      status:
        total > 0 && balanceDue <= 0 && amountPaid >= total
          ? "PAID"
          : amountPaid > 0
            ? "PARTIAL"
            : inv.status,
      preparedBy: docStr("preparedBy"),
      eventDate: eventDateRaw ? new Date(eventDateRaw) : null,
      setupTime: docStr("setupTime"),
      startTime: docStr("startTime"),
      dismantleTime: docStr("dismantleTime"),
      venue: docStr("venue"),
    },
  });

  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(`/admin/invoices/${invoiceId}`);
}
