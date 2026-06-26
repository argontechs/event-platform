"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { PlanningFormState } from "@/lib/planning/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

type Action = (prev: PlanningFormState, fd: FormData) => Promise<PlanningFormState>;

export type LocationValues = {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postcode: string;
  lat: string;
  lng: string;
  capacity: string;
  contactName: string;
  contactPhone: string;
  notes: string;
};

const EMPTY: LocationValues = {
  name: "", addressLine1: "", city: "", state: "", postcode: "",
  lat: "", lng: "", capacity: "", contactName: "", contactPhone: "", notes: "",
};

const field =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
};

export function LocationForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial?: LocationValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const v = initial ?? EMPTY;

  const [f, setF] = useState<LocationValues>(v);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [openList, setOpenList] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = makeT(useBoLang());

  const set = (patch: Partial<LocationValues>) => setF((p) => ({ ...p, ...patch }));

  // Debounced address lookup via OpenStreetMap Nominatim (free, no key).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=my&q=${encodeURIComponent(query)}`,
          { headers: { Accept: "application/json" } },
        );
        const data = (await res.json()) as Suggestion[];
        setResults(Array.isArray(data) ? data : []);
        setOpenList(true);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  function choose(s: Suggestion) {
    const a = s.address ?? {};
    const city = a.city || a.town || a.village || a.suburb || a.county || "";
    const road = [a.road, a.house_number].filter(Boolean).join(" ");
    set({
      name: f.name || a.amenity || a.building || s.display_name.split(",")[0] || "",
      addressLine1: road || s.display_name.split(",").slice(0, 2).join(", "),
      city,
      state: a.state || "",
      postcode: a.postcode || "",
      lat: s.lat,
      lng: s.lon,
    });
    setQuery("");
    setResults([]);
    setOpenList(false);
  }

  const hasMap = f.lat && f.lng;
  const mapSrc = hasMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(f.lng) - 0.01}%2C${Number(f.lat) - 0.01}%2C${Number(f.lng) + 0.01}%2C${Number(f.lat) + 0.01}&layer=mapnik&marker=${f.lat}%2C${f.lng}`
    : "";

  return (
    <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {/* Address search with autocomplete */}
      <div className="relative sm:col-span-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">{t("Search address / venue")}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpenList(true)}
            placeholder={t("Start typing, e.g. KLCC Convention Centre")}
            className={field}
            autoComplete="off"
          />
        </label>
        {openList && results.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {results.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => choose(s)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {hasMap ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 sm:col-span-2">
          <iframe title={t("Location map")} src={mapSrc} className="h-56 w-full" loading="lazy" />
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t("Venue name")}</span>
        <input name="name" value={f.name} onChange={(e) => set({ name: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t("Address")}</span>
        <input name="addressLine1" value={f.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("City")}</span>
        <input name="city" value={f.city} onChange={(e) => set({ city: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("State")}</span>
        <input name="state" value={f.state} onChange={(e) => set({ state: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Postcode")}</span>
        <input name="postcode" value={f.postcode} onChange={(e) => set({ postcode: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Capacity")}</span>
        <input name="capacity" type="number" value={f.capacity} onChange={(e) => set({ capacity: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Contact name")}</span>
        <input name="contactName" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-600">{t("Contact phone")}</span>
        <input name="contactPhone" value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-slate-600">{t("Notes")}</span>
        <textarea name="notes" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={field} />
      </label>

      <input type="hidden" name="lat" value={f.lat} />
      <input type="hidden" name="lng" value={f.lng} />

      {state.error ? <p className="text-sm text-red-500 sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Saving…") : submitLabel}
        </button>
      </div>
    </form>
  );
}
