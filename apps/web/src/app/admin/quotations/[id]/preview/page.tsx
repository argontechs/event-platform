import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PrintButton } from "@/components/admin/print-button";
import { BusinessDocument, type DocLine, type DocRow } from "@/components/admin/business-document";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

export default async function QuotationPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      company: true,
      customer: true,
      lead: { include: { attachments: true } },
      items: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!q) notFound();
  if (!isSuperAdmin(user) && user.companyId !== q.companyId) redirect("/admin/quotations");

  const items: DocLine[] = q.items.map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    lineTotal: Number(it.lineTotal),
  }));

  const eventDate = q.eventDate ?? q.lead?.eventDate ?? null;
  const deposit = Number(q.depositAmount);
  const balance = Number(q.total) - deposit;

  const meta: [string, string][] = [
    ["No.", q.number],
    ["Date", fmtDate(q.createdAt)],
    ...((q.validUntil ? [["Valid Until", fmtDate(q.validUntil)]] : []) as [string, string][]),
    ["Prepared by", q.preparedBy ?? ""],
  ];
  const billLines = [
    eventDate ? `EVENT DATE : ${fmtDate(eventDate)}` : null,
    q.setupTime ? `EVENT SETUP TIME: ${q.setupTime}` : null,
    q.startTime ? `EVENT START TIME: ${q.startTime}` : null,
    q.dismantleTime ? `DISMANTLE TIME: ${q.dismantleTime}` : null,
    (q.venue ?? q.lead?.venueText) ? `VENUE: ${q.venue ?? q.lead?.venueText}` : null,
  ].filter(Boolean) as string[];
  const extraRows: DocRow[] = [
    { label: `Deposit (${Number(q.depositPercent)}%)`, value: `RM${money(deposit)}` },
    { label: "Balance", value: `RM${money(balance)}`, strong: true },
  ];

  const images = [
    ...q.attachments.filter((a) => a.kind === "MOODBOARD" || a.kind === "REFERENCE"),
    ...(q.lead?.attachments.filter((a) => a.kind === "REFERENCE") ?? []),
  ].map((a) => ({ url: a.url, filename: a.filename }));

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/admin/quotations/${q.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to editor
        </Link>
        <PrintButton label="Save as PDF" />
      </div>

      <div className="print-document">
        <BusinessDocument
          title="QUOTATION"
          company={q.company}
          meta={meta}
          customer={{ name: q.customer?.name ?? "", phone: q.customer?.phone ?? "" }}
          billLines={billLines}
          items={items}
          totals={{
            subtotal: Number(q.subtotal),
            discount: Number(q.discount),
            sstApplied: q.sstApplied,
            b2bExempt: q.b2bExempt,
            sstRate: Number(q.sstRate),
            sstAmount: Number(q.sstAmount),
            rounding: 0,
            total: Number(q.total),
          }}
          extraRows={extraRows}
          remarks={q.notes}
        />

        {images.length > 0 ? (
          <div className="page-break mx-auto mt-8 max-w-[800px] p-8">
            <p className="mb-3 text-sm font-semibold text-zinc-700">Design references</p>
            <div className="grid grid-cols-2 gap-3">
              {images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img.url} alt={img.filename ?? "design"} className="w-full rounded border border-zinc-200 object-cover" />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
