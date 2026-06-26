import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT, type T } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function PlanningHome() {
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const t = makeT(await getBoLang());

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("Event Planning")}</h1>
        <div className="flex items-center gap-2">
          <Link href="/planning/locations" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
            {t("Locations")}
          </Link>
          <Link
            href="/planning/events/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            {t("+ New booking")}
          </Link>
        </div>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        {t("These are your confirmed events to deliver. Open one to tick its checklist, add the run-sheet, assign suppliers and track budget. New events here also show in Bookings & Calendar.")}
      </p>
      {!companyId ? (
        <div className="mt-6">
          <SelectCompanyNotice />
        </div>
      ) : (
        <Events companyId={companyId} t={t} />
      )}
    </section>
  );
}

async function Events({ companyId, t }: { companyId: string; t: T }) {
  const bookings = await prisma.booking.findMany({
    where: { companyId, status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    include: { location: true, customer: true, tasks: true },
    take: 100,
  });

  if (bookings.length === 0) {
    return <p className="mt-6 text-sm text-slate-400">{t("No upcoming events. Create one or confirm a quote.")}</p>;
  }

  return (
    <div className="mt-6 grid gap-3">
      {bookings.map((b) => {
        const done = b.tasks.filter((t) => t.status === "DONE").length;
        const pct = b.tasks.length ? Math.round((done / b.tasks.length) * 100) : 0;
        return (
          <Link
            key={b.id}
            href={`/planning/${b.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-accent/40 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900">{b.title}</p>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {b.eventDate ? b.eventDate.toISOString().slice(0, 10) : t("date TBC")}
                {b.location ? ` · ${b.location.name}` : b.venueText ? ` · ${b.venueText}` : ""}
                {b.customer ? ` · ${b.customer.name}` : ""}
              </p>
            </div>
            <div className="w-40 text-right text-sm">
              <p className="text-slate-500">{done}/{b.tasks.length} {t("tasks done")}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
