import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const t = makeT(await getBoLang());
  const user = await requireUser();
  const companyId = await getActiveCompanyId(user);
  const sp = await searchParams;

  // Resolve the month (YYYY-MM), default to current.
  const now = new Date();
  const m = /^\d{4}-\d{2}$/.test(sp.month ?? "")
    ? sp.month!
    : `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const [year, monthNum] = m.split("-").map(Number);
  const monthIdx = monthNum - 1;

  return (
    <section className="max-w-5xl">
      <h1 className="text-2xl font-semibold">{t("Calendar")}</h1>
      {!companyId ? (
        <div className="mt-6"><SelectCompanyNotice /></div>
      ) : (
        <CalendarGrid companyId={companyId} year={year} monthIdx={monthIdx} />
      )}
    </section>
  );
}

async function CalendarGrid({
  companyId,
  year,
  monthIdx,
}: {
  companyId: string;
  year: number;
  monthIdx: number;
}) {
  const t = makeT(await getBoLang());
  const monthStart = new Date(Date.UTC(year, monthIdx, 1));
  const nextMonth = new Date(Date.UTC(year, monthIdx + 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7; // Monday-start

  const bookings = await prisma.booking.findMany({
    where: { companyId, eventDate: { gte: monthStart, lt: nextMonth } },
    orderBy: { eventDate: "asc" },
    include: { customer: { select: { name: true } } },
  });

  const byDay = new Map<number, typeof bookings>();
  for (const b of bookings) {
    if (!b.eventDate) continue;
    const d = b.eventDate.getUTCDate();
    const arr = byDay.get(d) ?? [];
    arr.push(b);
    byDay.set(d, arr);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = monthIdx === 0 ? `${year - 1}-12` : `${year}-${pad(monthIdx)}`;
  const next = monthIdx === 11 ? `${year + 1}-01` : `${year}-${pad(monthIdx + 2)}`;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{t(MONTHS[monthIdx])} {year}</h2>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendar?month=${prev}`} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">← {t("Prev")}</Link>
          <Link href="/admin/calendar" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{t("Today")}</Link>
          <Link href={`/admin/calendar?month=${next}`} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">{t("Next")} →</Link>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-px rounded-t-xl bg-slate-200 text-center text-xs font-medium text-slate-500">
            {DOW.map((d) => (
              <div key={d} className="bg-white py-2">{t(d)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px rounded-b-xl bg-slate-200">
            {cells.map((day, i) => {
              const events = day ? byDay.get(day) ?? [] : [];
              const dayStr = day ? `${year}-${pad(monthIdx + 1)}-${pad(day)}` : "";
              const isToday = dayStr === todayStr;
              return (
                <div key={i} className={`min-h-[96px] bg-white p-1.5 ${day ? "" : "bg-slate-50"}`}>
                  {day ? (
                    <>
                      <div className={`text-right text-xs ${isToday ? "font-bold text-accent" : "text-slate-400"}`}>{day}</div>
                      <div className="mt-1 flex flex-col gap-1">
                        {events.slice(0, 3).map((b) => (
                          <Link
                            key={b.id}
                            href={`/planning/${b.id}`}
                            className="block truncate rounded bg-accent/10 px-1.5 py-1 text-[11px] text-accent hover:bg-accent/20"
                            title={`${b.title} · ${b.customer?.name ?? ""}`}
                          >
                            {b.title}
                          </Link>
                        ))}
                        {events.length > 3 ? (
                          <span className="text-[10px] text-slate-400">+{events.length - 3} {t("more")}</span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Month list */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-slate-900">{t("This month's events")} ({bookings.length})</h3>
        <div className="mt-3 flex flex-col gap-2">
          {bookings.length === 0 ? (
            <p className="text-sm text-slate-400">{t("No events scheduled this month.")}</p>
          ) : (
            bookings.map((b) => (
              <Link key={b.id} href={`/planning/${b.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm hover:bg-slate-50">
                <span className="flex items-center gap-3">
                  <span className="w-16 text-slate-500">{b.eventDate ? b.eventDate.toISOString().slice(5, 10) : "—"}</span>
                  <span className="font-medium text-slate-900">{b.title}</span>
                  <span className="text-slate-500">{b.customer?.name ?? ""}</span>
                </span>
                <StatusBadge status={b.status} />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
