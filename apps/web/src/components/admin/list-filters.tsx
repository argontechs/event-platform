import Link from "next/link";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

/** Build a Prisma date filter ({gte, lt}) from from/to (YYYY-MM-DD), inclusive. */
export function dateRangeFilter(from: string, to: string): { gte?: Date; lt?: Date } | undefined {
  const r: { gte?: Date; lt?: Date } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) r.gte = new Date(from + "T00:00:00");
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const e = new Date(to + "T00:00:00");
    r.lt = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
  }
  return r.gte || r.lt ? r : undefined;
}

export async function ListFilters({
  basePath,
  statuses,
  status,
  q,
  from = "",
  to = "",
  dates = false,
  searchPlaceholder = "Search…",
}: {
  basePath: string;
  statuses: string[];
  status: string;
  q: string;
  from?: string;
  to?: string;
  dates?: boolean;
  searchPlaceholder?: string;
}) {
  const t = makeT(await getBoLang());
  const pill = "rounded-full px-3 py-1.5 text-sm transition";
  const link = (st: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (st) p.set("status", st);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("page", "1");
    return `${basePath}?${p.toString()}`;
  };
  const dateInput = "rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-accent";

  return (
    <div className="mt-4">
      <form className="flex flex-wrap items-center gap-2" action={basePath}>
        <input
          name="q"
          defaultValue={q}
          placeholder={t(searchPlaceholder)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
        {dates ? (
          <>
            <label className="flex items-center gap-1 text-xs text-slate-500">{t("From")}
              <input name="from" type="date" defaultValue={from} className={dateInput} /></label>
            <label className="flex items-center gap-1 text-xs text-slate-500">{t("To")}
              <input name="to" type="date" defaultValue={to} className={dateInput} /></label>
          </>
        ) : null}
        <input type="hidden" name="status" value={status} />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
          {t("Search")}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href={link("")} className={`${pill} ${!status ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
          {t("All")}
        </Link>
        {statuses.map((st) => (
          <Link
            key={st}
            href={link(st)}
            className={`${pill} ${status === st ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
          >
            {t(st.replace(/_/g, " ").toLowerCase())}
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function Pagination({
  basePath,
  status,
  q,
  from = "",
  to = "",
  page,
  pages,
  total,
  noun,
}: {
  basePath: string;
  status: string;
  q: string;
  from?: string;
  to?: string;
  page: number;
  pages: number;
  total: number;
  noun: string;
}) {
  const t = makeT(await getBoLang());
  const link = (pg: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("page", String(pg));
    return `${basePath}?${p.toString()}`;
  };
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
      <span>{total} {t(noun)}{total === 1 ? "" : t(noun) === noun ? "s" : ""}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={link(page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-100">{t("Prev")}</Link>
        ) : null}
        <span>{t("Page")} {page} / {pages}</span>
        {page < pages ? (
          <Link href={link(page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-100">{t("Next")}</Link>
        ) : null}
      </div>
    </div>
  );
}
