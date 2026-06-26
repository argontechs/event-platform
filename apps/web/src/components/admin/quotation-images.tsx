"use client";

import { useActionState, useState } from "react";
import {
  uploadQuotationImagesAction,
  deleteQuotationImageAction,
  generateConceptImageAction,
  generateConceptFromReferencesAction,
  type QuotationImageState,
  type ConceptImageState,
} from "@/lib/quotations/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: QuotationImageState = { error: "" };
const genInitial: ConceptImageState = { error: "" };

type Img = { id: string; url: string; filename: string | null };

export function QuotationImages({
  quotationId,
  images,
  references = [],
}: {
  quotationId: string;
  images: Img[];
  references?: Img[];
}) {
  const [state, action, pending] = useActionState(
    uploadQuotationImagesAction.bind(null, quotationId),
    initial,
  );
  const [refState, refAction, refPending] = useActionState(
    generateConceptFromReferencesAction.bind(null, quotationId),
    genInitial,
  );
  const [genState, genAction, genPending] = useActionState(
    generateConceptImageAction.bind(null, quotationId),
    genInitial,
  );
  const [showManual, setShowManual] = useState(false);
  const t = makeT(useBoLang());

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-medium text-slate-900">
          <span className="mr-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent">
            {t("Step 1")}
          </span>
          {t("Design & concept images")}
        </h2>
        <p className="text-xs text-slate-500">{t("Shown on the proposal the customer sees.")}</p>
      </div>

      {/* Customer's uploaded reference photos (read-only) */}
      {references.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600">
            {t("Customer's reference photos")} ({references.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {references.map((r) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={r.id}
                src={r.url}
                alt={r.filename ?? "reference"}
                className="h-16 w-16 rounded-md border border-slate-200 object-cover"
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 1a — analyse references → 3 fresh concept designs */}
      <div className="mt-4 rounded-lg border border-dashed border-accent/40 bg-accent/5 p-4">
        <h3 className="text-sm font-medium text-slate-900">
          ✨ {t("Generate concept designs from the customer's references")}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {references.length > 0
            ? t("AI analyses the photos & notes above, then creates 3 original designs in the same style.")
            : t("No reference photos — AI will design from the enquiry details. Add photos on the lead for a closer match.")}
        </p>
        <form action={refAction} className="mt-2 flex flex-col gap-2">
          <textarea
            name="steer"
            rows={2}
            placeholder={t("Optional — steer the design. e.g. 'Lean more luxury, add a floral arch, blush & gold palette.'")}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="size"
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 [&_option]:text-slate-900"
            >
              <option value="1024x1024">{t("Square")}</option>
              <option value="1536x1024">{t("Landscape")}</option>
              <option value="1024x1536">{t("Portrait")}</option>
            </select>
            <button
              type="submit"
              disabled={refPending}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {refPending ? t("Analysing & generating…") : t("Generate 3 concept designs")}
            </button>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              {showManual ? t("Hide manual") : t("…or describe it yourself")}
            </button>
          </div>
          {refState.error ? <p className="text-sm text-red-500">{refState.error}</p> : null}
          {refState.ok ? (
            <p className="text-sm text-emerald-600">{t("Concept designs added below.")}</p>
          ) : null}
        </form>

        {/* Step 1b — manual single-image prompt (fallback) */}
        {showManual ? (
          <form action={genAction} className="mt-3 flex flex-col gap-2 border-t border-accent/20 pt-3">
            <textarea
              name="prompt"
              rows={2}
              required
              placeholder={t("e.g. Pastel pink & gold birthday backdrop with balloon arch and floral centrepieces")}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                name="size"
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 [&_option]:text-slate-900"
              >
                <option value="1024x1024">{t("Square")}</option>
                <option value="1536x1024">{t("Landscape")}</option>
                <option value="1024x1536">{t("Portrait")}</option>
              </select>
              <button
                type="submit"
                disabled={genPending}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {genPending ? t("Generating…") : t("Generate image")}
              </button>
            </div>
            {genState.error ? <p className="text-sm text-red-500">{genState.error}</p> : null}
          </form>
        ) : null}
      </div>

      {/* Upload your own + the proposal image grid */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-600">{t("Proposal images")}</p>
        <form action={action} className="flex items-center gap-2">
          <input
            name="images"
            type="file"
            accept="image/*"
            multiple
            required
            className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? t("Uploading…") : t("Add")}
          </button>
        </form>
      </div>
      {state.error ? <p className="mt-2 text-sm text-red-500">{state.error}</p> : null}

      {images.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.filename ?? "design"} className="aspect-square w-full object-cover" />
              <form action={deleteQuotationImageAction.bind(null, img.id)} className="absolute right-1 top-1">
                <button className="rounded bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100" aria-label={t("Delete")}>
                  ✕
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
