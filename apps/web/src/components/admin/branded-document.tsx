// Branded A4 quotation/invoice document — replicates the company's print template
// (Party Eventilicious): logo + serif title, BILLED TO block, full-height-divider
// items table, watermark, PLEASE MAKE PAYMENT TO + TOTAL/GRAND TOTAL, then the
// T&C pages (page 2–3). Prints via .print-document; the T&C header repeats on each
// printed page using a <thead> (the standard print running-header trick).

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

// The "e" watermark is the Party Eventilicious brand mark. Both current tenants
// share this brand; if a non-PE company is ever onboarded, give it its own
// watermark (or gate this) — see the project notes.
const WATERMARK = "/brand/pe-watermark.png";
const SERIF = "[font-family:var(--font-playfair),Georgia,serif]";

function Header({ logoUrl, name, right }: { logoUrl: string | null; name: string; right: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-12 w-auto max-w-[55%] object-contain" />
      ) : (
        <p className="text-lg font-bold uppercase text-zinc-900">{name}</p>
      )}
      <p className={`${SERIF} whitespace-pre-line text-right text-[30px] font-medium leading-[1.05] tracking-[0.04em] text-zinc-900`}>
        {right}
      </p>
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
  termsTitle = "DESIGN\nPROPOSAL",
  company,
  customer,
  billLines,
  dateText,
  preparedBy,
  items,
  subtotal,
  grandTotal,
  amountPaid = 0,
  balanceDue = 0,
}: {
  title: string; // QUOTATION | INVOICE
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
  customer: { name: string };
  billLines: string[];
  dateText: string;
  preparedBy: string;
  items: DocLine[];
  subtotal: number;
  grandTotal: number;
  amountPaid?: number;
  balanceDue?: number;
}) {
  const payTo = company.bankAccountName || company.legalName || company.name;

  return (
    <div className={`mx-auto w-full max-w-[820px] bg-white text-[12px] text-zinc-900 [font-family:var(--font-poppins),system-ui,sans-serif]`}>
      {/* ───────── PAGE 1 ───────── */}
      <div className="relative overflow-hidden px-10 py-10">
        {/* watermark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={WATERMARK}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-40px] right-[-70px] z-0 w-[380px] select-none opacity-[0.06]"
        />

        <div className="relative z-10">
          <Header logoUrl={company.logoUrl} name={company.name} right={title} />

          {/* Billed to + date / prepared by */}
          <div className="mt-10 flex items-start justify-between gap-6 text-[11px]">
            <div>
              <p className="tracking-[0.06em] text-zinc-500">BILLED TO:</p>
              <p className="mt-1 text-[13px] font-bold uppercase">{customer.name || "—"}</p>
              <div className="mt-1 space-y-0.5 uppercase leading-relaxed text-zinc-700">
                {billLines.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            </div>
            <div className="whitespace-nowrap pt-6 text-right text-[12px] text-zinc-800">
              <p>{dateText}</p>
              {preparedBy ? <p>PREPARED BY: {preparedBy.toUpperCase()}</p> : null}
            </div>
          </div>

          {/* Items table — full-height column dividers */}
          <table className="mt-8 w-full border-collapse text-[11px]">
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
                  <td className="border-l border-zinc-400 px-3 py-3 uppercase">{it.description}</td>
                  <td className="border-l border-zinc-400 px-3 py-3 text-center">{it.quantity}</td>
                  <td className="border-l border-zinc-400 px-3 py-3 text-right">{money(it.unitPrice)}</td>
                  <td className="border-x border-zinc-400 px-3 py-3 text-right">{money(it.lineTotal)}</td>
                </tr>
              ))}
              {/* filler row → tall body with the dividers running full height */}
              <tr aria-hidden="true">
                <td className="h-[300px] border-l border-b border-zinc-400" />
                <td className="border-l border-b border-zinc-400" />
                <td className="border-l border-b border-zinc-400" />
                <td className="border-x border-b border-zinc-400" />
              </tr>
            </tbody>
          </table>

          {/* Payment to + totals */}
          <div className="mt-7 flex items-start justify-between gap-6">
            <div className="text-[12px] leading-relaxed">
              <p className="font-bold">PLEASE MAKE PAYMENT TO:</p>
              <p className="uppercase">{payTo}</p>
              {company.bankName || company.bankAccountNo ? (
                <p className="uppercase">
                  {[company.bankName, company.bankAccountNo].filter(Boolean).join(" ")}
                </p>
              ) : null}
            </div>
            <div className="w-[280px] text-[12px]">
              <TotalRow label="TOTAL:" value={subtotal} />
              <TotalRow label="GRAND TOTAL:" value={grandTotal} strong />
              {amountPaid > 0 ? (
                <>
                  <TotalRow label="LESS: PAID:" value={-amountPaid} />
                  <TotalRow label="BALANCE DUE:" value={balanceDue} strong />
                </>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 border-t border-zinc-800 pt-3">
            <p className={`${SERIF} text-[18px] italic text-zinc-800`}>Thank you for your business.</p>
          </div>
        </div>
      </div>

      {/* ───────── PAGE 2–3 : Terms & Conditions ───────── */}
      {company.termsAndConditions ? (
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
                <div className="text-[11px] leading-relaxed text-zinc-800">
                  {renderTerms(company.termsAndConditions)}
                </div>
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
