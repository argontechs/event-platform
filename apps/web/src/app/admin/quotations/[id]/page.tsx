import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { sendQuotationAction } from "@/lib/quotations/actions";
import { createInvoiceFromQuotationAction } from "@/lib/invoices/actions";
import { QuotationEditor, type EditorLine } from "@/components/admin/quotation-editor";
import { AiGenerateButton } from "@/components/admin/ai-generate-button";
import { QuotationImages } from "@/components/admin/quotation-images";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";
import { CopyButton } from "@/components/ui/copy-button";
import { ImportQuotationButton } from "@/components/admin/import-quotation-button";

export const dynamic = "force-dynamic";

export default async function QuotationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = makeT(await getBoLang());

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      company: true,
      items: { orderBy: { sortOrder: "asc" } },
      lead: { include: { attachments: { where: { kind: "REFERENCE" }, orderBy: { createdAt: "desc" } } } },
      customer: { select: { sstNumber: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      booking: { select: { id: true } },
    },
  });
  if (!quotation) notFound();
  if (!isSuperAdmin(user) && user.companyId !== quotation.companyId) {
    redirect("/admin/quotations");
  }

  const pkgs = await prisma.package.findMany({
    where: { companyId: quotation.companyId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true, price: true, description: true },
  });
  const packages = pkgs.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    description: p.description ?? "",
  }));

  const aiDraft = quotation.leadId
    ? await prisma.aiDraft.findFirst({
        where: { leadId: quotation.leadId },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const questions = Array.isArray(aiDraft?.questions)
    ? (aiDraft?.questions as string[])
    : [];

  const lines: EditorLine[] = quotation.items.map((it) => ({
    description: it.description,
    category: it.category ?? "",
    quantity: Number(it.quantity),
    unit: it.unit,
    costPrice: Number(it.costPrice),
    profitPercent: Number(it.profitPercent),
    referenceImageUrl: it.referenceImageUrl ?? "",
  }));

  return (
    <section className="max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/quotations" className="text-sm text-slate-500 hover:text-slate-900">
            ← {t("Quotations")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{quotation.number}</h1>
          <p className="text-sm text-slate-500">
            {quotation.status.toLowerCase()} ·{" "}
            {quotation.company.sstRegistered
              ? `${t("SST-registered")} (${Number(quotation.company.sstRate)}%)`
              : t("not SST-registered")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/quotations/${quotation.id}/preview`}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
          >
            {t("Preview")}
          </Link>
          <ImportQuotationButton quotationId={quotation.id} />
          <form action={createInvoiceFromQuotationAction.bind(null, quotation.id)}>
            <button className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-100">
              {t("Create invoice")}
            </button>
          </form>
          <form action={sendQuotationAction.bind(null, quotation.id)}>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
              {quotation.sentAt ? t("Resend (new code)") : t("Send proposal")}
            </button>
          </form>
        </div>
      </div>

      {quotation.status === "ACCEPTED" && quotation.booking ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            {t("Quote accepted — a booking was created.")}
          </p>
          <Link
            href={`/admin/bookings/${quotation.booking.id}`}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            {t("View booking →")}
          </Link>
        </div>
      ) : null}

      {/* Customer requested changes */}
      {quotation.changesRequested && quotation.customerFeedback ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            {t("Customer requested changes")} ({t("revision")} {quotation.revisionCount})
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-800">{quotation.customerFeedback}</p>
          <p className="mt-2 text-xs text-amber-700">
            {t("Their feedback is pre-filled in the AI prompt below — click Generate to redesign, then Resend.")}
          </p>
        </div>
      ) : null}

      {/* Share link + access code (after sending) */}
      {quotation.viewPin && quotation.sentAt ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-medium text-slate-900">{t("Customer proposal link")}</h2>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {(process.env.APP_BASE_URL ?? "")}/q/{quotation.publicToken}
            </code>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {t("Access code:")} <strong className="text-slate-900">{quotation.viewPin}</strong>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton
              label={t("Copy link")}
              copiedLabel={t("Copied")}
              text={`${process.env.APP_BASE_URL ?? ""}/q/${quotation.publicToken}`}
            />
            <CopyButton
              label={t("Copy link + code")}
              copiedLabel={t("Copied")}
              text={`${process.env.APP_BASE_URL ?? ""}/q/${quotation.publicToken}\n${t("Access code:")} ${quotation.viewPin}`}
            />
          </div>
        </div>
      ) : null}

      {/* Step 1 — design & concept images (from the customer's references) */}
      <div className="mt-6">
        <QuotationImages
          quotationId={quotation.id}
          references={(quotation.lead?.attachments ?? []).map((a) => ({
            id: a.id,
            url: a.url,
            filename: a.filename,
          }))}
          images={quotation.attachments
            .filter((a) => a.kind === "MOODBOARD" || a.kind === "REFERENCE")
            .map((a) => ({ id: a.id, url: a.url, filename: a.filename }))}
        />
      </div>

      {/* Step 2 — smart quotation (AI or manual) */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-slate-900">
              <span className="mr-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">
                {t("Step 2")}
              </span>
              {t("Smart quotation")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("Generate a draft from the reference images, or build it manually below — both stay editable.")}
            </p>
          </div>
          {quotation.lead ? (
            <AiGenerateButton
              quotationId={quotation.id}
              defaultInstructions={quotation.changesRequested ? quotation.customerFeedback ?? "" : ""}
            />
          ) : (
            <span className="text-xs text-slate-400">{t("No linked lead — manual only.")}</span>
          )}
        </div>

        {aiDraft?.planDraft ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-accent">{t("AI plan")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{aiDraft.planDraft}</p>
            {questions.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-accent">{t("Questions to confirm")}</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                  {questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Editor — remounts when the quotation changes (e.g. after AI generate) */}
      <div className="mt-6">
        <QuotationEditor
          key={quotation.updatedAt.toISOString()}
          quotationId={quotation.id}
          sstRate={Number(quotation.company.sstRate)}
          sstRegistered={quotation.company.sstRegistered}
          packages={packages}
          initial={{
            lines,
            profitPercentDefault: Number(quotation.profitPercentDefault),
            discount: Number(quotation.discount),
            depositPercent: Number(quotation.depositPercent),
            sstApplied: quotation.sstApplied,
            b2bExempt: quotation.b2bExempt,
            customerSstNumber: quotation.customer?.sstNumber ?? "",
            notes: quotation.notes ?? "",
            preparedBy: quotation.preparedBy ?? "",
            eventDate: (quotation.eventDate ?? quotation.lead?.eventDate)?.toISOString().slice(0, 10) ?? "",
            setupTime: quotation.setupTime ?? "",
            startTime: quotation.startTime ?? "",
            dismantleTime: quotation.dismantleTime ?? "",
            venue: quotation.venue ?? quotation.lead?.venueText ?? "",
          }}
        />
      </div>
    </section>
  );
}
