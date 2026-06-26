import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { PrintButton } from "@/components/admin/print-button";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function RunSheetPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = makeT(await getBoLang());
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      company: true,
      location: true,
      runSheet: { orderBy: { sortOrder: "asc" } },
      crew: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      quotation: { select: { setupTime: true, startTime: true, dismantleTime: true } },
    },
  });
  if (!booking) notFound();
  if (!isSuperAdmin(user) && user.companyId !== booking.companyId) redirect("/planning");

  const dateStr = booking.eventDate ? booking.eventDate.toISOString().slice(0, 10) : t("date TBC");
  const venue = booking.location?.name ?? booking.venueText ?? "—";
  const crewName = (c: (typeof booking.crew)[number]) => c.user?.name ?? c.name ?? "—";
  const setupCrew = booking.crew.filter((c) => c.phase === "SETUP" || c.phase === "BOTH").map((c) => ({ name: crewName(c), role: c.role, phone: c.phone }));
  const dismantleCrew = booking.crew.filter((c) => c.phase === "DISMANTLE" || c.phase === "BOTH").map((c) => ({ name: crewName(c), role: c.role, phone: c.phone }));
  const q = booking.quotation;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/planning/${booking.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← {t("Back to event")}
        </Link>
        <PrintButton label={t("Save as PDF")} />
      </div>

      <div className="print-document rounded-xl border border-slate-200 bg-white p-8 text-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-300 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: booking.company.brandPrimary ?? undefined }}>
              {t("Run sheet")}
            </h1>
            <p className="mt-1 text-lg font-semibold">{booking.title}</p>
            <p className="text-sm text-slate-600">
              {dateStr} · {venue}
            </p>
          </div>
          <div className="text-right text-sm">
            {booking.company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={booking.company.logoUrl} alt={booking.company.name} className="ml-auto h-12 object-contain" />
            ) : null}
            <p className="mt-1 font-medium">{booking.company.name}</p>
          </div>
        </div>

        {/* Times */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <TimeBox label={t("Setup time")} value={q?.setupTime} />
          <TimeBox label={t("Start time")} value={q?.startTime} />
          <TimeBox label={t("Dismantle time")} value={q?.dismantleTime} />
        </div>

        {/* Crew */}
        <div className="avoid-break mt-6 grid grid-cols-2 gap-4">
          <CrewBlock title={t("Setup crew")} rows={setupCrew} empty={t("No one assigned.")} />
          <CrewBlock title={t("Dismantle crew")} rows={dismantleCrew} empty={t("No one assigned.")} />
        </div>

        {/* Run sheet timeline */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{t("Run sheet")}</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="w-20 py-1.5">{t("Time")}</th>
                <th className="py-1.5">{t("Activity")}</th>
                <th className="w-32 py-1.5">{t("Owner")}</th>
              </tr>
            </thead>
            <tbody>
              {booking.runSheet.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-2 text-slate-400">
                    {t("No entries yet.")}
                  </td>
                </tr>
              ) : (
                booking.runSheet.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 font-medium">{r.time ?? "—"}</td>
                    <td className="py-1.5">
                      {r.activity}
                      {r.notes ? <span className="block text-xs text-slate-500">{r.notes}</span> : null}
                    </td>
                    <td className="py-1.5 text-slate-600">{r.owner ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function TimeBox({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-slate-200 p-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold">{value || "—"}</p>
    </div>
  );
}

function CrewBlock({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { name: string; role: string | null; phone: string | null }[];
  empty: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1">
              <span>
                {r.name}
                {r.role ? <span className="text-slate-500"> · {r.role}</span> : null}
              </span>
              {r.phone ? <span className="text-slate-500">{r.phone}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}