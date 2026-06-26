import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { InvoiceEditor, type InvoiceLine } from "@/components/admin/invoice-editor";

export const dynamic = "force-dynamic";

type CustomerSnapshot = { name?: string; email?: string; phone?: string; sstNumber?: string };

export default async function InvoiceEditPage({
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

  const rawItems = Array.isArray(inv.items) ? (inv.items as unknown as InvoiceLine[]) : [];
  const lines: InvoiceLine[] = rawItems.map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
  }));
  const cust = (inv.customerSnapshot ?? {}) as CustomerSnapshot;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/admin/invoices/${inv.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to invoice
        </Link>
        <h1 className="text-lg font-semibold">Edit {inv.number}</h1>
      </div>
      <InvoiceEditor
        invoiceId={inv.id}
        sstRate={Number(inv.company.sstRate)}
        sstRegistered={inv.company.sstRegistered}
        amountPaid={Number(inv.amountPaid)}
        initial={{
          lines,
          sstApplied: inv.sstApplied,
          b2bExempt: inv.b2bExempt,
          customerSstNumber: cust.sstNumber ?? "",
          discount: Number(inv.discount),
          remarks: inv.remarks ?? "",
          customer: {
            name: cust.name ?? "",
            email: cust.email ?? "",
            phone: cust.phone ?? "",
          },
          doc: {
            preparedBy: inv.preparedBy ?? "",
            eventDate: inv.eventDate ? inv.eventDate.toISOString().slice(0, 10) : "",
            setupTime: inv.setupTime ?? "",
            startTime: inv.startTime ?? "",
            dismantleTime: inv.dismantleTime ?? "",
            venue: inv.venue ?? "",
          },
        }}
      />
    </section>
  );
}
