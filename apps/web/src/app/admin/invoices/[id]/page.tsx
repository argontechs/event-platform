import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PrintButton } from "@/components/admin/print-button";
import { BrandedDocument, type DocLine } from "@/components/admin/branded-document";

export const dynamic = "force-dynamic";

type CustomerSnapshot = { name?: string; email?: string; phone?: string; sstNumber?: string };

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`;
}
// Invoice header month-year, e.g. "MAY 2026".
function fmtMonthYear(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toUpperCase();
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

  const billLines = [
    inv.eventDate ? `EVENT DATE: ${fmtDate(inv.eventDate)}` : null,
    inv.setupTime ? `EVENT SETUP TIME: ${inv.setupTime}` : null,
    inv.startTime ? `EVENT START TIME: ${inv.startTime}` : null,
    inv.dismantleTime ? `DISMANTLE TIME: ${inv.dismantleTime}` : null,
    inv.venue ? `VENUE: ${inv.venue}` : null,
  ].filter(Boolean) as string[];

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
        <BrandedDocument
          title="INVOICE"
          variant="invoice"
          termsTitle=""
          company={inv.company}
          customer={{ name: cust.name ?? "", phone: cust.phone }}
          billLines={billLines}
          headerRight={[`INVOICE NO. ${inv.number}`, fmtMonthYear(inv.issuedAt)]}
          items={items}
          subtotal={Number(inv.subtotal)}
          grandTotal={Number(inv.total)}
          amountPaid={Number(inv.amountPaid)}
          balanceDue={Number(inv.balanceDue)}
          sstApplied={inv.sstApplied}
          sstRate={Number(inv.sstRate)}
          sstAmount={Number(inv.sstAmount)}
          footerRight={inv.company.ssmRegNo}
        />
      </div>
    </section>
  );
}
