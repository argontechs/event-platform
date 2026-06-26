"use client";

import { useActionState, useState } from "react";
import { submitEnquiryAction, type EnquiryState } from "@/lib/leads/actions";
import { EVENT_TYPES, BUDGET_RANGES } from "@/lib/leads/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";

const initial: EnquiryState = { error: "" };

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-white/60">{label}</span>
      <input
        {...rest}
        className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900"
      />
    </label>
  );
}

export function EnquiryForm({
  dict,
  locale,
}: {
  dict: Dictionary["form"];
  locale: Locale;
}) {
  const [state, formAction, pending] = useActionState(submitEnquiryAction, initial);
  const [step, setStep] = useState(0);
  const steps = dict.steps;
  const last = steps.length - 1;
  const f = dict.fields;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />

      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs">
        {steps.map((label, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition ${
                i === step ? "bg-[var(--brand,#2f6fed)] text-white" : "bg-white/5 text-white/60"
              }`}
            >
              <span className="font-medium">{i + 1}</span>
              <span>{label}</span>
            </button>
            {i < last ? <span className="text-white/20">—</span> : null}
          </li>
        ))}
      </ol>

      {/* Step 1 — Event */}
      <div className={step === 0 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.eventType}</span>
          <select
            name="eventType"
            defaultValue="WEDDING"
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {dict.eventTypes[t]}
              </option>
            ))}
          </select>
        </label>
        <Input label={f.venue} name="venue" type="text" />
        <Input label={f.eventDate} name="eventDate" type="date" />
        <Input label={f.eventTime} name="eventTime" type="time" />
      </div>

      {/* Step 2 — Vision */}
      <div className={step === 1 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-white/60">{f.theme}</span>
          <textarea
            name="theme"
            rows={3}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.budget}</span>
          <select
            name="budget"
            defaultValue=""
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900"
          >
            <option value="">—</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b} value={b}>
                {dict.budgets[b]}
              </option>
            ))}
          </select>
        </label>
        <Input label={f.guestCount} name="guestCount" type="number" min={0} />
        <Input label={f.purpose} name="purpose" type="text" />
      </div>

      {/* Step 3 — Details */}
      <div className={step === 2 ? "grid gap-4" : "hidden"}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.images}</span>
          <input
            name="images"
            type="file"
            multiple
            accept="image/*"
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white"
          />
          <span className="text-xs text-white/40">{f.imagesHint}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.specialRequest}</span>
          <textarea
            name="specialRequest"
            rows={4}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900"
          />
        </label>
      </div>

      {/* Step 4 — Contact */}
      <div className={step === 3 ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
        <Input label={f.name} name="name" type="text" required />
        <Input label={f.phone} name="phone" type="tel" required />
        <Input label={f.email} name="email" type="email" required />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/60">{f.language}</span>
          <select
            name="preferredLanguage"
            defaultValue={locale.toUpperCase()}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-white outline-none focus:border-[var(--brand,#2f6fed)] [&_option]:bg-white [&_option]:text-slate-900"
          >
            <option value="EN">English</option>
            <option value="MS">Bahasa Malaysia</option>
            <option value="ZH">中文</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((x) => Math.max(0, x - 1))}
          disabled={step === 0}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5 disabled:opacity-40"
        >
          {dict.back}
        </button>

        {step < last ? (
          <button
            type="button"
            onClick={() => setStep((x) => Math.min(last, x + 1))}
            className="rounded-md px-5 py-2 text-sm font-medium text-white transition hover:brightness-110"
            style={{ backgroundColor: "var(--brand, #2f6fed)" }}
          >
            {dict.next}
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="rounded-md px-5 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: "var(--brand, #2f6fed)" }}
          >
            {pending ? dict.submitting : dict.submit}
          </button>
        )}
      </div>
    </form>
  );
}
