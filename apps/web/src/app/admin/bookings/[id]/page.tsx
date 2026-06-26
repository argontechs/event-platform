import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { confirmPaymentAction } from "@/lib/bookings/actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

function rm(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STEPS = ["Confirmed", "Deposit paid", "In planning", "Fully paid", "Event done"];

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = makeT(await getBoLang());

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      payments: { include: { attachments: true }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { issuedAt: "desc" } },
      tasks: true,
    },
  });
  if (!booking) notFound();
  if (!isSuperAdmin(user) && user.companyId !== booking.companyId) redirect("/admin/bookings");

  return (
    <section className="max-w-4xl">
      <Link href="/admin/bookings" className="text-sm text-slate-500 hover:text-slate-900">
        ← {t("Bookings")}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{booking.title}</h1>
        <StatusBadge status={booking.status} />
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {booking.customer?.name} · {booking.eventType.toLowerCase()} ·{" "}
        {booking.eventDate ? booking.eventDate.toISOString().slice(0, 10) : t("date TBC")}
      </p>

      {(() => {
        const pendingPayment = booking.payments.some((p) => p.status === "PENDING");
        const paid = Number(booking.depositPaid);
        const balance = Number(booking.balanceDue);
        // Which step we're on (0-indexed).
        let step = 0;
        if (paid > 0) step = 2;
        if (balance <= 0 && Number(booking.totalAmount) > 0) step = 3;
        if (["EXECUTED", "COMPLETED", "CLOSED"].includes(booking.status)) step = 4;

        let guide: { tone: string; title: string; body: string };
        if (pendingPayment) {
          guide = { tone: "amber", title: t("💳 A payment is waiting for you"), body: t("A customer uploaded a payment below. Check the proof, then click \"Confirm payment\" — that records it and (on the first deposit) issues the invoice + starts planning.") };
        } else if (balance <= 0 && Number(booking.totalAmount) > 0) {
          guide = { tone: "emerald", title: t("🎉 Fully paid"), body: t("Nothing to collect. Just deliver the event — manage setup, run-sheet and suppliers on the Planning board.") };
        } else if (paid > 0) {
          guide = { tone: "blue", title: t("✅ Deposit received — in planning"), body: `${t("Collect the remaining")} ${rm(balance)} ${t("before the event. When they pay, record it below and confirm.")}` };
        } else {
          guide = { tone: "amber", title: t("⏳ Waiting for the deposit"), body: t("Once the customer pays the deposit (bank transfer / DuitNow), it shows below for you to confirm. Confirming locks the booking and starts planning.") };
        }
        const toneCls: Record<string, string> = {
          amber: "border-amber-300 bg-amber-50 text-amber-900",
          blue: "border-blue-300 bg-blue-50 text-blue-900",
          emerald: "border-emerald-300 bg-emerald-50 text-emerald-900",
        };

        return (
          <>
            {/* Plain-language next step */}
            <div className={`mt-5 rounded-xl border p-4 ${toneCls[guide.tone]}`}>
              <p className="font-medium">{guide.title}</p>
              <p className="mt-1 text-sm opacity-90">{guide.body}</p>
            </div>

            {/* Stage tracker */}
            <div className="mt-4 flex flex-wrap gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                    i <= step ? "bg-accent text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i <= step ? "bg-white/25" : "bg-slate-300 text-white"}`}>
                    {i + 1}
                  </span>
                  {t(s)}
                </div>
              ))}
            </div>
          </>
        );
      })()}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label={t("Total")} value={rm(Number(booking.totalAmount))} />
        <Stat label={t("Deposit paid")} value={rm(Number(booking.depositPaid))} />
        <Stat label={t("Balance due")} value={rm(Number(booking.balanceDue))} />
      </div>

      {/* Payments */}
      <h2 className="mt-8 text-lg font-semibold">{t("Payments")}</h2>
      <div className="mt-3 flex flex-col gap-2">
        {booking.payments.length === 0 ? (
          <p className="text-sm text-slate-400">{t("No payments recorded yet.")}</p>
        ) : (
          booking.payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <div>
                <span className="text-slate-900">{rm(Number(p.amount))}</span>
                <span className="text-slate-500"> · {p.type.toLowerCase()} · {p.method.toLowerCase()}</span>
                {p.reference ? <span className="text-slate-400"> · {p.reference}</span> : null}
                {p.attachments[0] ? (
                  <a href={p.attachments[0].url} target="_blank" className="ml-2 text-accent hover:underline">
                    {t("view proof")}
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{p.status.toLowerCase()}</span>
                {p.status === "PENDING" ? (
                  <form action={confirmPaymentAction.bind(null, p.id)}>
                    <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110">
                      {t("Confirm payment")}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoices */}
      <h2 className="mt-8 text-lg font-semibold">{t("Invoices")}</h2>
      <div className="mt-3 flex flex-col gap-2">
        {booking.invoices.length === 0 ? (
          <p className="text-sm text-slate-400">{t("No invoice yet — confirm a payment to issue one.")}</p>
        ) : (
          booking.invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/admin/invoices/${inv.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-white"
            >
              <span className="text-slate-900">{inv.number}</span>
              <span className="text-slate-500">
                {inv.type.toLowerCase()} · {inv.status.toLowerCase()} · {rm(Number(inv.total))}
              </span>
            </Link>
          ))
        )}
      </div>

      <p className="mt-8 text-sm text-slate-500">
        {t("Planning tasks:")} {booking.tasks.length} ·{" "}
        <Link href="/planning" className="text-accent hover:underline">
          {t("open planning →")}
        </Link>
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
