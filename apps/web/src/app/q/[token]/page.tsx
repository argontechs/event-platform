import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@event/db";
import { acceptQuoteAction } from "@/lib/quotes/public-actions";
import { PaymentProofForm } from "@/components/site/payment-proof-form";
import { QuoteGate } from "@/components/site/quote-gate";
import { RequestChangesForm } from "@/components/site/request-changes-form";
import { AcceptQuoteButton } from "@/components/site/accept-quote-button";
import { BrandedDocument, type DocLine } from "@/components/admin/branded-document";
import { CopyButton } from "@/components/ui/copy-button";
import { HtmlLang } from "@/components/site/html-lang";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

// Page language follows the language the customer picked on their enquiry
// (lead.preferredLanguage) — falls back to English when there is no lead.
const LANG_TO_LOCALE: Record<string, Locale> = { EN: "en", MS: "ms", ZH: "zh" };

function rm(n: number): string {
  return `RM ${n.toFixed(2)}`;
}
function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}
// Template date, e.g. "21 JUN 2026".
function fmtDocDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
}

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const q = await prisma.quotation.findUnique({
    where: { publicToken: token },
    include: {
      company: true,
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      attachments: true,
      lead: { include: { attachments: true } },
      booking: { include: { payments: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!q) notFound();

  const primary = q.company.brandPrimary ?? "#2f6fed";
  const locale: Locale = LANG_TO_LOCALE[q.lead?.preferredLanguage ?? ""] ?? "en";
  const t = getDictionary(locale).quote;

  // Password gate — proposal links are protected by an access code.
  const store = await cookies();
  const unlocked = !q.viewPin || store.get(`qv_${token}`)?.value === q.viewPin;
  if (!unlocked) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16" style={{ ["--brand" as string]: primary }}>
        <HtmlLang locale={locale} />
        <QuoteGate token={token} company={q.company.name} dict={t} />
      </main>
    );
  }
  const images = [
    ...q.attachments.filter((a) => a.kind !== "PAYMENT_PROOF"),
    ...(q.lead?.attachments.filter((a) => a.kind === "REFERENCE") ?? []),
  ];
  const accepted = q.status === "ACCEPTED";
  const sent = q.status === "SENT";
  // Same comparison the server uses to gate acceptance (public-actions.ts), so the
  // UI never shows an Accept button the server will silently no-op.
  const expired = !!q.validUntil && new Date(q.validUntil) < new Date();

  // Formal quotation document (same layout as the printed invoice/quote).
  const eventDate = q.eventDate ?? q.lead?.eventDate ?? null;
  const venue = q.venue ?? q.lead?.venueText ?? null;
  const deposit = Number(q.depositAmount);
  const docItems: DocLine[] = q.items.map((it) => ({
    description: it.description,
    quantity: Number(it.quantity),
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    lineTotal: Number(it.lineTotal),
  }));
  const docHeaderRight = [
    fmtDocDate(q.createdAt),
    q.preparedBy ? `PREPARED BY: ${q.preparedBy.toUpperCase()}` : null,
  ].filter(Boolean) as string[];
  const docBillLines = [
    eventDate ? `EVENT DATE: ${fmtDate(eventDate)}` : null,
    q.setupTime ? `EVENT SETUP TIME: ${q.setupTime}` : null,
    q.startTime ? `EVENT START TIME: ${q.startTime}` : null,
    q.dismantleTime ? `DISMANTLE TIME: ${q.dismantleTime}` : null,
    venue ? `VENUE: ${venue}` : null,
  ].filter(Boolean) as string[];

  return (
    <main
      className="mx-auto max-w-3xl px-6 py-16"
      style={{ ["--brand" as string]: primary }}
    >
      <HtmlLang locale={locale} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{q.company.name}</p>
          <p className="text-sm text-white/50">{t.quotation} {q.number}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/70">
          {t.status[q.status] ?? q.status.toLowerCase()}
        </span>
      </div>

      {q.customer ? (
        <p className="mt-4 text-sm text-white/60">
          {t.preparedFor} <span className="text-white">{q.customer.name}</span>
        </p>
      ) : null}

      {q.status === "DRAFT" ? (
        <p className="mt-10 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-white/60">
          {t.draftNotice}
        </p>
      ) : (
        <>
          {/* Demo / reference images */}
          {images.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={a.url}
                  alt={a.filename ?? t.referenceAlt}
                  className="aspect-[4/3] w-full rounded-lg border border-white/10 object-cover"
                />
              ))}
            </div>
          ) : null}

          {/* Formal quotation document */}
          <div className="mt-8 overflow-hidden rounded-xl shadow-2xl shadow-black/30">
            <BrandedDocument
              title="QUOTATION"
              variant="quotation"
              company={q.company}
              customer={{ name: q.customer?.name ?? "", phone: q.customer?.phone ?? undefined }}
              billLines={docBillLines}
              headerRight={docHeaderRight}
              items={docItems}
              subtotal={Number(q.subtotal)}
              grandTotal={Number(q.total)}
              sstApplied={q.sstApplied}
              sstRate={Number(q.sstRate)}
              sstAmount={Number(q.sstAmount)}
            />
          </div>

          {/* Decision: accept & pay, or request changes */}
          {sent ? (
            q.changesRequested ? (
              <p className="mt-8 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {t.changesReceived}
              </p>
            ) : expired ? (
              <div className="mt-8 flex flex-col gap-3">
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                  {t.expiredNotice.replace("{date}", fmtDate(q.validUntil))}
                  {q.company.phone || q.company.email ? (
                    <span className="mt-1 block text-amber-200/80">
                      {t.contactLabel}
                      {q.company.phone ? (
                        <>
                          {" "}
                          <a className="underline" href={`tel:${q.company.phone}`}>
                            {q.company.phone}
                          </a>
                        </>
                      ) : null}
                      {q.company.email ? (
                        <>
                          {q.company.phone ? " · " : " "}
                          <a className="underline" href={`mailto:${q.company.email}`}>
                            {q.company.email}
                          </a>
                        </>
                      ) : null}
                    </span>
                  ) : (
                    <span className="mt-1 block text-amber-200/80">
                      {t.replyHint}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <RequestChangesForm token={token} dict={t} />
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <AcceptQuoteButton action={acceptQuoteAction.bind(null, token)} labels={t.accept} />
                  <RequestChangesForm token={token} dict={t} />
                </div>
              </div>
            )
          ) : null}

          {/* Payment */}
          {accepted ? (
            <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold">{t.payment.title}</h2>
              <p className="mt-1 text-sm text-white/60">
                {t.payment.depositDue} <strong className="text-white">{rm(Number(q.depositAmount))}</strong>
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-white/40">{t.payment.bankTransfer}</p>
                  <p className="mt-2 text-white/80">{q.company.bankName ?? "—"}</p>
                  <p className="text-white/80">{q.company.bankAccountName ?? ""}</p>
                  {q.company.bankAccountNo ? (
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="text-white/80">{q.company.bankAccountNo}</p>
                      <CopyButton
                        text={q.company.bankAccountNo}
                        label={t.payment.copy}
                        copiedLabel={t.payment.copied}
                        className="rounded border border-white/15 px-2 py-0.5 text-xs text-white/70 transition hover:bg-white/10"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="rounded-lg border border-white/10 p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-white/40">{t.payment.duitnowQr}</p>
                  {q.company.duitnowQrUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.company.duitnowQrUrl} alt={t.payment.duitnowQr} className="mt-2 h-44 w-44 rounded object-contain" />
                      <p className="mt-2 text-xs text-white/50">
                        {t.payment.scanToPay.replace("{amount}", rm(Number(q.depositAmount)))}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-white/50">{t.payment.qrNotConfigured}</p>
                  )}
                </div>
              </div>

              {/* Existing payments */}
              {q.booking && q.booking.payments.length > 0 ? (
                <ul className="mt-4 space-y-1 text-sm">
                  {q.booking.payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-white/60">
                      <span>{rm(Number(p.amount))} · {t.payment.methods[p.method] ?? p.method.toLowerCase()}</span>
                      <span>{t.payment.statuses[p.status] ?? p.status.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6">
                <PaymentProofForm token={token} suggestedAmount={Number(q.depositAmount)} dict={t} />
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
