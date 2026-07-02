"use client";

import { useActionState } from "react";
import { unlockQuoteAction, type UnlockState } from "@/lib/quotes/public-actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const initial: UnlockState = { error: "" };

export function QuoteGate({
  token,
  company,
  dict,
}: {
  token: string;
  company: string;
  dict: Dictionary["quote"];
}) {
  const [state, action, pending] = useActionState(
    unlockQuoteAction.bind(null, token),
    initial,
  );
  const errText = state.error
    ? (dict.errors[state.error] ?? dict.errors.generic).replace(
        "{minutes}",
        String(state.minutes ?? ""),
      )
    : "";

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-white/50">{company}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{dict.gate.title}</h1>
        <p className="mt-1 text-sm text-white/60">{dict.gate.subtitle}</p>
      </div>
      <form action={action} className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <input
          name="pin"
          inputMode="numeric"
          required
          placeholder={dict.gate.placeholder}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-lg tracking-widest text-white outline-none focus:border-white/40"
        />
        {state.error ? <p className="text-sm text-red-400">{errText}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          style={{ backgroundColor: "var(--brand, #2f6fed)" }}
        >
          {pending ? dict.gate.opening : dict.gate.view}
        </button>
      </form>
    </div>
  );
}
