// Shared letterhead document matching the client's invoice / design-proposal format.

const serif = { fontFamily: "Georgia, 'Times New Roman', serif" } as const;

export type DocItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

type Company = {
  name: string;
  legalName: string | null;
  logoUrl: string | null;
  ssmRegNo: string | null;
  sstRegistered: boolean;
  sstRegNo: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNo: string | null;
  termsAndConditions: string | null;
};

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LetterheadDocument({
  kind,
  company: c,
  cust,
  items,
  docMeta,
  totals,
  images = [],
}: {
  kind: "INVOICE" | "QUOTATION" | "DESIGN PROPOSAL";
  company: Company;
  cust: { name?: string; email?: string; phone?: string };
  items: DocItem[];
  images?: { url: string; filename: string | null }[];
  docMeta: {
    number: string;
    dateLabel: string;
    preparedBy?: string | null;
    eventDate?: string | null;
    setupTime?: string | null;
    startTime?: string | null;
    dismantleTime?: string | null;
    venue?: string | null;
  };
  totals: {
    subtotal: number;
    discount: number;
    sstApplied: boolean;
    sstRate: number;
    sstAmount: number;
    total: number;
    b2bExempt?: boolean;
    customerSstNumber?: string | null;
    extraRows?: { label: string; value: string; strong?: boolean }[];
  };
}) {
  const eventLines: [string, string | null | undefined][] = [
    ["EVENT DATE", docMeta.eventDate],
    ["EVENT SETUP TIME", docMeta.setupTime],
    ["EVENT START TIME", docMeta.startTime],
    ["DISMANTLE TIME", docMeta.dismantleTime],
    ["VENUE", docMeta.venue],
  ];

  return (
    <div className="print-document rounded-2xl border border-slate-200 bg-white p-10 text-zinc-900 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt={c.name} className="h-14 object-contain" />
          ) : (
            <p className="text-xl font-bold">{c.name}</p>
          )}
        </div>
        <p className="text-right text-4xl leading-none tracking-wide" style={serif}>
          {kind}
        </p>
      </div>

      {/* Billed-to + meta */}
      <div className="mt-10 flex justify-between text-sm">
        <div className="max-w-[55%]">
          <p className="text-zinc-500">BILLED TO:</p>
          <p className="mt-1 font-bold">{cust.name ?? "—"}</p>
          {cust.phone ? <p className="font-bold">{cust.phone}</p> : null}
          {eventLines
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <p key={k} className="mt-0.5 text-zinc-600">
                {k}: {v}
              </p>
            ))}
        </div>
        <div className="text-right text-zinc-600">
          {kind === "INVOICE" ? <p>INVOICE NO. {docMeta.number}</p> : <p>{docMeta.number}</p>}
          <p>{docMeta.dateLabel}</p>
          {docMeta.preparedBy ? <p>PREPARED BY: {docMeta.preparedBy}</p> : null}
        </div>
      </div>

      {/* Items */}
      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-zinc-300 text-zinc-700">
            <th className="py-2 pr-2 text-left font-semibold">DESCRIPTION</th>
            <th className="px-2 py-2 text-center font-semibold">QTY</th>
            <th className="px-2 py-2 text-right font-semibold">RATE</th>
            <th className="py-2 pl-2 text-right font-semibold">AMOUNT (RM)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-400">No line items yet.</td>
            </tr>
          ) : (
            items.map((it, i) => {
              const foc = it.unitPrice === 0 && it.lineTotal === 0;
              return (
                <tr key={i} className="avoid-break border-b border-zinc-100 align-top">
                  <td className="py-3 pr-2 font-medium">{it.description}</td>
                  <td className="px-2 py-3 text-center text-zinc-700">{it.quantity}</td>
                  <td className="px-2 py-3 text-right text-zinc-700">{foc ? "FOC" : money(it.unitPrice)}</td>
                  <td className="py-3 pl-2 text-right text-zinc-700">{foc ? "FOC" : money(it.lineTotal)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {(totals.discount > 0 || totals.sstApplied) ? (
        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm text-zinc-600">
          {totals.discount > 0 ? <Row label="Discount" value={`− ${money(totals.discount)}`} /> : null}
          {totals.sstApplied && totals.b2bExempt ? (
            <Row label="Service Tax" value="Exempt (B2B)" />
          ) : totals.sstApplied ? (
            <Row label={`SST (${totals.sstRate}%)`} value={money(totals.sstAmount)} />
          ) : null}
        </div>
      ) : null}
      {totals.sstApplied && totals.b2bExempt ? (
        <p className="mt-1 ml-auto max-w-xs text-right text-[11px] text-zinc-500">
          Service tax exempted — B2B same service group (Service Tax Act 2018).
          {totals.customerSstNumber ? ` Customer SST: ${totals.customerSstNumber}` : ""}
        </p>
      ) : null}

      {/* Payment + total */}
      <div className="mt-10 flex items-start justify-between">
        <div className="text-sm">
          <p className="font-semibold">PLEASE MAKE PAYMENT TO:</p>
          <p className="mt-2 text-zinc-700">{c.legalName ?? c.name}</p>
          {c.bankName ? <p className="text-zinc-700">{c.bankName}</p> : null}
          {c.bankAccountNo ? <p className="text-zinc-700">{c.bankAccountNo}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-zinc-600">TOTAL :</p>
          <p className="text-2xl font-bold">RM {money(totals.total)}</p>
          {totals.extraRows?.map((r) => (
            <p key={r.label} className={`text-xs ${r.strong ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>
              {r.label}: RM {r.value}
            </p>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-end justify-between border-t border-zinc-200 pt-4">
        <p className="text-2xl italic text-zinc-700" style={serif}>
          Thank you for your business.
        </p>
        {c.ssmRegNo ? <p className="text-xs text-zinc-500">{c.ssmRegNo}</p> : null}
      </div>

      {/* Design reference images (proposals) */}
      {images.length > 0 ? (
        <div className="mt-10 page-break">
          <p className="text-right text-3xl leading-none tracking-wide" style={serif}>
            DESIGN PROPOSAL
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.url}
                alt={img.filename ?? "design"}
                className="avoid-break w-full rounded-lg border border-zinc-200 object-cover"
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Terms & Conditions */}
      {c.termsAndConditions ? (
        <div className="mt-10 page-break">
          <h2 className="text-sm font-semibold">Terms &amp; Conditions</h2>
          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-600">
            {c.termsAndConditions}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
