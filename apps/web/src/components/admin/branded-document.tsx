// Branded A4 document — two variants matching the company's two reference designs:
//   - "invoice"   (Image #4):    no watermark, no T&C, single TOTAL, reg-no footer,
//                                 "INVOICE NO. … / month-year" on the right.
//   - "quotation" (Jasleen PDF):  faint "e" watermark, T&C pages 2–3, TOTAL + GRAND
//                                 TOTAL, "date / PREPARED BY" on the right.
// Shared: logo + serif title (Playfair), BILLED TO block, full-height-divider items
// table, PLEASE MAKE PAYMENT TO, "Thank you" footer. Prints A4 via .print-document;
// the T&C header repeats per printed page using a <thead> running-header.

export type DocLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// The "e" watermark is the Party Eventilicious brand mark (quotation only).
const WATERMARK = "/brand/pe-watermark.png";
const SERIF = "[font-family:var(--font-roxborough),Georgia,serif]";

function Header({ logoUrl, name, right, logoH = "h-16" }: { logoUrl: string | null; name: string; right: string; logoH?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className={`${logoH} w-auto max-w-[60%] object-contain`} />
      ) : (
        <p className="text-lg font-bold uppercase text-zinc-900">{name}</p>
      )}
      {right ? (
        <p className={`${SERIF} whitespace-pre-line text-right text-[30px] font-medium leading-[1.05] tracking-[0.04em] text-zinc-900`}>
          {right}
        </p>
      ) : null}
    </div>
  );
}

/** Render the company's T&C text: bold section headers + "Label:" prefixes, keep numbered lines. */
function renderTerms(text: string) {
  const HEADERS = new Set(["Payment Details", "Terms and Conditions"]);
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line, i) => {
      const t = line.trim();
      if (t === "") return <div key={i} className="h-2" />;
      if (HEADERS.has(t)) {
        return <p key={i} className="mt-2 font-semibold text-zinc-900">{t}</p>;
      }
      // "Some Label: rest of sentence" → bold the label.
      const m = /^([A-Z][^:]{2,48}):\s*(.*)$/.exec(t);
      if (m && !/^\d/.test(t)) {
        return (
          <p key={i} className="mt-2">
            <span className="font-semibold">{m[1]}:</span> {m[2]}
          </p>
        );
      }
      return <p key={i} className={/^\d+\./.test(t) ? "" : "mt-2"}>{t}</p>;
    });
}

export function BrandedDocument({
  title,
  variant,
  termsTitle = "DESIGN\nPROPOSAL",
  company,
  customer,
  billLines,
  headerRight,
  items,
  subtotal,
  grandTotal,
  amountPaid = 0,
  balanceDue = 0,
  sstApplied = false,
  sstRate = 0,
  sstAmount = 0,
  footerRight = null,
}: {
  title: string; // QUOTATION | INVOICE
  variant: "invoice" | "quotation";
  termsTitle?: string;
  company: {
    name: string;
    logoUrl: string | null;
    legalName: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNo: string | null;
    termsAndConditions: string | null;
  };
  customer: { name: string; phone?: string };
  billLines: string[];
  headerRight: string[]; // right-aligned header lines (date/prepared-by or invoice-no/month)
  items: DocLine[];
  subtotal: number;
  grandTotal: number;
  amountPaid?: number;
  balanceDue?: number;
  sstApplied?: boolean;
  sstRate?: number;
  sstAmount?: number;
  footerRight?: string | null; // reg no bottom-right (invoice)
}) {
  const payTo = company.bankAccountName || company.legalName || company.name;
  const isQuote = variant === "quotation";
  // Payment Details + T&C print on both the quotation and the invoice.
  const terms = company.termsAndConditions;

  return (
    <div className={`mx-auto w-full max-w-[820px] bg-white text-[12px] text-zinc-900 [font-family:var(--font-inter),system-ui,sans-serif]`}>
      {/* ───────── PAGE 1 ───────── */}
      <div className="relative overflow-hidden px-10 py-8">
        {/* watermark (quotation only) */}
        {isQuote ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={WATERMARK}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-30px] right-[-110px] z-0 w-[540px] select-none opacity-[0.07]"
          />
        ) : null}

        <div className="relative z-10 flex min-h-[250mm] flex-col">
          <Header logoUrl={company.logoUrl} name={company.name} right={title} logoH="h-20" />

          {/* Billed to + header right */}
          <div className="mt-10 flex items-start justify-between gap-6 text-[11px]">
            <div>
              <p className="tracking-[0.06em] text-zinc-500">BILLED TO:</p>
              <p className="mt-1 text-[13px] font-bold uppercase">{customer.name || "—"}</p>
              {customer.phone ? <p className="text-[12px] font-bold text-zinc-800">{customer.phone}</p> : null}
              <div className="mt-1 space-y-0.5 uppercase leading-relaxed text-zinc-700">
                {billLines.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            </div>
            <div className={`whitespace-nowrap text-right text-[12px] text-zinc-800 ${isQuote ? "pt-6" : ""}`}>
              {headerRight.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          </div>

          {/* Items table — grows to fill the page; full-height column dividers */}
          <div className="relative mt-8 flex-1">
            <table className="absolute inset-0 h-full w-full border-collapse text-[11px]">
              <colgroup>
                <col />
                <col className="w-[3.5rem]" />
                <col className="w-[6rem]" />
                <col className="w-[7rem]" />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-zinc-800 text-[12px] font-bold">
                  <th className="px-3 pb-2 text-center">DESCRIPTION</th>
                  <th className="px-3 pb-2 text-center">QTY</th>
                  <th className="px-3 pb-2 text-right">RATE</th>
                  <th className="px-3 pb-2 text-right">AMOUNT (RM)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="align-top">
                    <td className="whitespace-pre-line border-l border-zinc-400 px-3 py-3 uppercase">{it.description}</td>
                    <td className="border-l border-zinc-400 px-3 py-3 text-center">{it.quantity}</td>
                    <td className="border-l border-zinc-400 px-3 py-3 text-right">{money(it.unitPrice)}</td>
                    <td className="border-x border-zinc-400 px-3 py-3 text-right">{money(it.lineTotal)}</td>
                  </tr>
                ))}
                {/* filler row absorbs the remaining height so the dividers run full */}
                <tr aria-hidden="true" className="h-full">
                  <td className="border-l border-b border-zinc-400" />
                  <td className="border-l border-b border-zinc-400" />
                  <td className="border-l border-b border-zinc-400" />
                  <td className="border-x border-b border-zinc-400" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment to + totals */}
          <div className="mt-7 flex items-start justify-between gap-6">
            <div className="text-[12px] leading-relaxed">
              <p className="font-bold">PLEASE MAKE PAYMENT TO:</p>
              <p className="uppercase">{payTo}</p>
              {company.bankName ? <p className="uppercase">{company.bankName}</p> : null}
              {company.bankAccountNo ? <p className="uppercase">{company.bankAccountNo}</p> : null}
            </div>
            <div className="w-[280px] text-[12px]">
              {sstApplied && sstAmount > 0 ? (
                <>
                  <TotalRow label="Subtotal" value={subtotal} />
                  <TotalRow label={`Service Tax (${sstRate}%)`} value={sstAmount} />
                  <TotalRow label="TOTAL :" value={grandTotal} strong />
                </>
              ) : isQuote ? (
                <>
                  <TotalRow label="TOTAL:" value={subtotal} />
                  <TotalRow label="GRAND TOTAL:" value={grandTotal} strong />
                </>
              ) : (
                <TotalRow label="TOTAL :" value={grandTotal} strong />
              )}
              {amountPaid > 0 ? (
                <>
                  <TotalRow label="LESS: PAID:" value={-amountPaid} />
                  <TotalRow label="BALANCE DUE:" value={balanceDue} strong />
                </>
              ) : null}
            </div>
          </div>

          {/* Footer — rule sits BELOW the line, matching the PDF */}
          <div className="mt-8 flex items-end justify-between gap-6 border-b border-zinc-800 pb-3">
            <p className={`${SERIF} text-[18px] text-zinc-800`}>Thank you for your business.</p>
            {footerRight ? <p className="text-[11px] text-zinc-500">{footerRight}</p> : null}
          </div>
        </div>
      </div>

      {/* ───────── PAGE 2–3 : Terms & Conditions (quotation only) ───────── */}
      {terms ? (
        <table className="page-break w-full">
          <thead>
            <tr>
              <td className="pb-4">
                <div className="px-10 pt-10">
                  <Header logoUrl={company.logoUrl} name={company.name} right={termsTitle} />
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-10 pb-10 align-top">
                <div className="text-[11px] leading-relaxed text-zinc-800">{renderTerms(terms)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="flex w-[140px] justify-between">
        <span>RM</span>
        <span>{money(value)}</span>
      </span>
    </div>
  );
}
