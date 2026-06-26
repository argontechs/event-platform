// Pixel-faithful invoice matching the company's real format (Invoice IV-01398).
// Plain black-on-white, A4, prints cleanly via the .print-document wrapper.

export type InvoiceDocLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

function money(n: number): string {
  return n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${x.getFullYear()}`;
}

export function InvoiceDocument({
  company,
  invoice,
  customer,
  items,
}: {
  company: {
    name: string;
    legalName: string | null;
    logoUrl: string | null;
    ssmRegNo: string | null;
    sstRegNo: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNo: string | null;
    paymentInstructions: string | null;
  };
  invoice: {
    number: string;
    issuedAt: Date;
    paymentTerm: string | null;
    preparedBy: string | null;
    eventDate: Date | null;
    setupTime: string | null;
    startTime: string | null;
    dismantleTime: string | null;
    venue: string | null;
    subtotal: number;
    discount: number;
    sstApplied: boolean;
    b2bExempt: boolean;
    sstRate: number;
    sstAmount: number;
    rounding: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    remarks: string | null;
  };
  customer: { name: string; phone: string };
  items: InvoiceDocLine[];
}) {
  const term = invoice.paymentTerm || "NET30";
  const days = parseInt(term.replace(/\D/g, ""), 10) || 30;
  const due = new Date(invoice.issuedAt);
  due.setDate(due.getDate() + days);

  const taxable = (n: number) => invoice.sstApplied && !invoice.b2bExempt;
  const addr = [
    company.addressLine1,
    company.addressLine2,
    [company.postcode, company.city].filter(Boolean).join(" "),
    company.state,
    "Malaysia",
  ].filter(Boolean);

  const meta: [string, string][] = [
    ["No.", invoice.number],
    ["Date", fmtDate(invoice.issuedAt)],
    ["Payment Term", term],
    ["Due Date", fmtDate(due)],
    ["Prepared by", invoice.preparedBy ?? ""],
  ];
  const billLines = [
    invoice.eventDate ? `EVENT DATE : ${fmtDate(invoice.eventDate)}` : null,
    invoice.setupTime ? `EVENT SETUP TIME: ${invoice.setupTime}` : null,
    invoice.startTime ? `EVENT START TIME: ${invoice.startTime}` : null,
    invoice.dismantleTime ? `DISMANTLE TIME: ${invoice.dismantleTime}` : null,
    invoice.venue ? `VENUE: ${invoice.venue}` : null,
  ].filter(Boolean) as string[];

  const th = "border border-zinc-400 px-2 py-1 text-[11px] font-semibold";
  const td = "border border-zinc-300 px-2 py-1 align-top text-[11px]";

  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-[12px] text-zinc-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex max-w-[58%] items-start gap-3">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="h-16 w-16 shrink-0 object-contain" />
          ) : null}
          <div>
          <p className="text-base font-bold">{company.legalName ?? company.name}</p>
          {company.ssmRegNo ? <p className="text-[11px]">Reg No: {company.ssmRegNo}</p> : null}
          {company.sstRegNo ? <p className="text-[11px]">Sales Tax ID: {company.sstRegNo}</p> : null}
          {company.sstRegNo ? <p className="text-[11px]">Service Tax ID: {company.sstRegNo}</p> : null}
          <div className="mt-2 text-[11px] leading-snug text-zinc-700">
            {addr.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-wide">INVOICE</p>
          <table className="mt-2 ml-auto text-[11px]">
            <tbody>
              {meta.map(([k, v]) => (
                <tr key={k}>
                  <td className="border border-zinc-300 bg-zinc-50 px-2 py-0.5 font-medium">{k}</td>
                  <td className="border border-zinc-300 px-2 py-0.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To */}
      <div className="mt-6">
        <p className="text-[11px] font-semibold">Bill To</p>
        <p className="text-[12px] font-semibold">{customer.name || "—"}</p>
        {billLines.map((l, i) => (
          <p key={i} className="text-[11px]">{l}</p>
        ))}
        {customer.phone ? <p className="text-[11px]">Phone No. {customer.phone}</p> : null}
      </div>

      {/* Line items */}
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-zinc-100 text-left">
            <th className={`${th} w-8`}>No.</th>
            <th className={th}>Description</th>
            <th className={`${th} w-10 text-right`}>Qty</th>
            <th className={`${th} w-20 text-right`}>U/Price</th>
            <th className={`${th} w-24 text-right`}>Amt</th>
            <th className={`${th} w-20 text-right`}>Disc</th>
            <th className={`${th} w-20 text-right`}>Tax Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            const lineDisc = i === 0 ? invoice.discount : 0; // doc discount shown on first line
            const lineTax = taxable(0) ? ((it.lineTotal - lineDisc) * invoice.sstRate) / 100 : 0;
            const [first, ...rest] = it.description.split("\n");
            return (
              <tr key={i}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={td}>
                  <span className="font-medium">{first}</span>
                  {rest.length > 0 ? (
                    <div className="mt-0.5 whitespace-pre-wrap text-[10px] text-zinc-600">{rest.join("\n")}</div>
                  ) : null}
                </td>
                <td className={`${td} text-right`}>{it.quantity}</td>
                <td className={`${td} text-right`}>{money(it.unitPrice)}</td>
                <td className={`${td} text-right`}>{money(it.lineTotal)}</td>
                <td className={`${td} text-right`}>{lineDisc ? money(lineDisc) : "0.00"}</td>
                <td className={`${td} text-right`}>{money(lineTax)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-3 ml-auto w-72 text-[12px]">
        <Row label="Subtotal" value={`RM${money(invoice.subtotal)}`} />
        {invoice.discount > 0 ? <Row label="Discount" value={`-RM${money(invoice.discount)}`} /> : null}
        {invoice.sstApplied && invoice.b2bExempt ? (
          <Row label="Service Tax" value="Exempt (B2B)" />
        ) : invoice.sstApplied ? (
          <Row label={`Service Tax (${invoice.sstRate}%)`} value={`RM${money(invoice.sstAmount)}`} />
        ) : null}
        {invoice.rounding !== 0 ? <Row label="Rounding" value={`RM${money(invoice.rounding)}`} /> : null}
        <div className="border-t border-zinc-400" />
        <Row label="Total" value={`RM${money(invoice.total)}`} strong />
        {invoice.amountPaid > 0 ? (
          <>
            <Row label="Less: Paid" value={`-RM${money(invoice.amountPaid)}`} />
            <Row label="Balance Due" value={`RM${money(invoice.balanceDue)}`} strong />
          </>
        ) : null}
      </div>

      {/* Remarks */}
      <div className="mt-6">
        <p className="text-[11px] font-semibold">Remarks</p>
        {invoice.remarks ? <p className="whitespace-pre-wrap text-[11px] text-zinc-700">{invoice.remarks}</p> : null}
      </div>

      {/* Payment details */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold">Payment Details</p>
        {company.paymentInstructions ? (
          <p className="whitespace-pre-wrap text-[11px] leading-snug text-zinc-700">{company.paymentInstructions}</p>
        ) : (
          <div className="text-[11px] text-zinc-700">
            <p>1. All cheques or bank transfers made payable to:</p>
            {company.bankAccountName ? <p className="ml-3">Beneficiary Name: {company.bankAccountName}</p> : null}
            {company.bankAccountNo ? <p className="ml-3">Account Number: {company.bankAccountNo}</p> : null}
            {company.bankName ? <p className="ml-3">Bank Name: {company.bankName}</p> : null}
          </div>
        )}
      </div>

      <p className="mt-8 text-right text-[10px] text-zinc-400">Page 1 / 1</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
