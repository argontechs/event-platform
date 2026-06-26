import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PrintButton } from "@/components/admin/print-button";
import { BusinessDocument, type DocLine, type DocRow } from "@/components/admin/business-document";

export const dynamic = "force-dynamic";

type CustomerSnapshot = { name?: string; email?: string; phone?: string; sstNumber?: string };

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!inv) notFound();
  if (!isSuperAdmin(user) && user.companyId !== inv.companyId) redirect("/admin/invoices");

  const items = (Array.isArray(inv.items) ? (inv.items as unknown as DocLine[]) : []).map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    lineTotal: Number(it.lineTotal),
  }));
  const cust = (inv.customerSnapshot ?? {}) as CustomerSnapshot;

  const term = inv.paymentTerm || "NET30";
  const due = new Date(inv.issuedAt);
  due.setDate(due.getDate() + (parseInt(term.replace(/\D/g, ""), 10) || 30));

  const meta: [string, string][] = [
    ["No.", inv.number],
    ["Date", fmtDate(inv.issuedAt)],
    ["Payment Term", term],
    ["Due Date", fmtDate(due)],
    ["Prepared by", inv.preparedBy ?? ""],
  ];
  const billLines = [
    inv.eventDate ? `EVENT DATE : ${fmtDate(inv.eventDate)}` : null,
    inv.setupTime ? `EVENT SETUP TIME: ${inv.setupTime}` : null,
    inv.startTime ? `EVENT START TIME: ${inv.startTime}` : null,
    inv.dismantleTime ? `DISMANTLE TIME: ${inv.dismantleTime}` : null,
    inv.venue ? `VENUE: ${inv.venue}` : null,
  ].filter(Boolean) as string[];
  const extraRows: DocRow[] =
    Number(inv.amountPaid) > 0
      ? [
          { label: "Less: Paid", value: `-RM${money(Number(inv.amountPaid))}` },
          { label: "Balance Due", value: `RM${money(Number(inv.balanceDue))}`, strong: true },
        ]
      : [];

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/invoices" className="text-sm text-slate-500 hover:text-slate-900">
          ← Invoices
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link
            href={`/admin/invoices/${inv.id}/edit`}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
          >
            Edit invoice
          </Link>
        </div>
      </div>

      <div className="print-document">
        <BusinessDocument
          title="INVOICE"
          company={inv.company}
          meta={meta}
          customer={{ name: cust.name ?? "", phone: cust.phone ?? "" }}
          billLines={billLines}
          items={items}
          totals={{
            subtotal: Number(inv.subtotal),
            discount: Number(inv.discount),
            sstApplied: inv.sstApplied,
            b2bExempt: inv.b2bExempt,
            sstRate: Number(inv.sstRate),
            sstAmount: Number(inv.sstAmount),
            rounding: Number(inv.rounding),
            total: Number(inv.total),
          }}
          extraRows={extraRows}
          remarks={inv.remarks}
        />
      </div>
    </section>
  );
}
