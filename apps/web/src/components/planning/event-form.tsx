"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { PlanningFormState } from "@/lib/planning/actions";
import { EVENT_TYPES } from "@/lib/leads/schema";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

type Action = (prev: PlanningFormState, fd: FormData) => Promise<PlanningFormState>;

const STATUSES = ["CONFIRMED", "IN_PLANNING", "READY", "EXECUTED", "COMPLETED", "CLOSED", "CANCELLED"] as const;

export type EventValues = {
  title: string;
  eventType: string;
  eventDate: string;
  locationId: string;
  venueText: string;
  totalAmount: string;
  status: string;
};

const EMPTY: EventValues = {
  title: "", eventType: "WEDDING", eventDate: "", locationId: "", venueText: "", totalAmount: "", status: "IN_PLANNING",
};

const field =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

type Suggestion = { display_name: string; lat: string; lon: string };

export function EventForm({
  action,
  locations,
  initial,
  submitLabel,
  showStatus = false,
}: {
  action: Action;
  locations: { id: string; name: string }[];
  initial?: EventValues;
  submitLabel: string;
  showStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const t = makeT(useBoLang());
  const v = initial ?? EMPTY;

  const [venue, setVenue] = useState(v.venueText);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) { setResults([]); return; }
    // Abort the previous request when the query changes so a slow earlier
    // response can't land after — and overwrite — a newer one.
    const controller = new AbortController();
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=my&q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, signal: controller.signal });
        const data = (await res.json()) as Suggestion[];
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { /* aborted or network error — ignore */ }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); controller.abort(); };
  }, [query]);

  function choose(s: Suggestion) {
    setVenue(s.display_name.split(",").slice(0, 3).join(", "));
    setLat(s.lat); setLng(s.lon);
    setQuery(""); setResults([]); setOpen(false);
  }

  const hasMap = lat && lng;
  const mapSrc = hasMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.01}%2C${Number(lat) - 0.01}%2C${Number(lng) + 0.01}%2C${Number(lat) + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`
    : "";

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t("Event title")}</span>
        <input name="title" defaultValue={v.title} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Event type")}</span>
        <select name="eventType" defaultValue={v.eventType} className={`${field} [&_option]:text-slate-900`}>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Date")}</span>
        <input name="eventDate" type="date" defaultValue={v.eventDate} className={field} />
      </label>

      {/* Saved venue (optional) */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Saved venue")}</span>
        <select name="locationId" defaultValue={v.locationId} className={`${field} [&_option]:text-slate-900`}>
          <option value="">{t("— pick saved, or search below —")}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Budget / total")} (RM)</span>
        <input name="totalAmount" type="number" step="0.01" defaultValue={v.totalAmount} className={field} />
      </label>

      {/* Venue search + free text (auto-saves a new venue) */}
      <div className="relative sm:col-span-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Search a new venue")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={t("Type a place, e.g. KSL Hotel Johor Bahru")}
            className={field}
            autoComplete="off"
          />
        </label>
        {open && results.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {results.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => choose(s)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t("Venue name")}</span>
        <input name="venueText" value={venue} onChange={(e) => { setVenue(e.target.value); setLat(""); setLng(""); }} className={field} placeholder={t("Selected venue, or type it in")} />
      </label>

      {hasMap ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 sm:col-span-2">
          <iframe title={t("Venue map")} src={mapSrc} className="h-48 w-full" loading="lazy" />
        </div>
      ) : null}
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />

      {showStatus ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Status")}</span>
          <select name="status" defaultValue={v.status} className={`${field} [&_option]:text-slate-900`}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>
            ))}
          </select>
        </label>
      ) : null}

      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60">
          {pending ? t("Saving…") : submitLabel}
        </button>
      </div>
    </form>
  );
}
