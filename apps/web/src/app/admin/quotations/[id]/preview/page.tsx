import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PrintButton } from "@/components/admin/print-button";
import { BrandedDocument, type DocLine } from "@/components/admin/branded-document";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`;
}
// Template date, e.g. "21 JUN 2026".
function fmtDocDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
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
  const billLines = [
    eventDate ? `EVENT DATE: ${fmtDate(eventDate)}` : null,
    q.setupTime ? `EVENT SETUP TIME: ${q.setupTime}` : null,
    q.startTime ? `EVENT START TIME: ${q.startTime}` : null,
    q.dismantleTime ? `DISMANTLE TIME: ${q.dismantleTime}` : null,
    (q.venue ?? q.lead?.venueText) ? `VENUE: ${q.venue ?? q.lead?.venueText}` : null,
  ].filter(Boolean) as string[];
  const headerRight = [
    fmtDocDate(q.createdAt),
    q.preparedBy ? `PREPARED BY: ${q.preparedBy.toUpperCase()}` : null,
  ].filter(Boolean) as string[];

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
        <BrandedDocument
          title="QUOTATION"
          variant="quotation"
          company={q.company}
          customer={{ name: q.customer?.name ?? "", phone: q.customer?.phone ?? undefined }}
          billLines={billLines}
          headerRight={headerRight}
          items={items}
          subtotal={Number(q.subtotal)}
          grandTotal={Number(q.total)}
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
