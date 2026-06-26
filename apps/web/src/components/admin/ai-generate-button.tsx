"use client";

import { useActionState, useState } from "react";
import { runAiDraftAction, type AiActionState } from "@/lib/quotations/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: AiActionState = { error: "" };

export function AiGenerateButton({
  quotationId,
  defaultInstructions = "",
}: {
  quotationId: string;
  defaultInstructions?: string;
}) {
  const [state, action, pending] = useActionState(
    runAiDraftAction.bind(null, quotationId),
    initial,
  );
  // Auto-open the prompt when the customer has sent feedback to redesign from.
  const [showPrompt, setShowPrompt] = useState(Boolean(defaultInstructions));
  const t = makeT(useBoLang());

  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-60"
        >
          {pending ? t("Analysing images & drafting…") : `✨ ${t("Generate with AI")}`}
        </button>
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          {showPrompt ? t("Hide prompt") : t("Edit prompt / instructions")}
        </button>
        {state.error ? <span className="text-sm text-red-500">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-600">{t("Draft applied — edit below.")}</span> : null}
      </div>

      {showPrompt ? (
        <textarea
          name="instructions"
          rows={3}
          defaultValue={defaultInstructions}
          placeholder={t("Optional — steer the AI. e.g. 'Luxury blush & gold garden theme, emphasise floral arch and fairy lights, keep within RM30k, suggest premium chiavari seating.' Leave blank to auto-generate from the enquiry + reference images.")}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
      ) : (
        // Keep the field present (empty) so generating without opening it still works.
        <input type="hidden" name="instructions" value="" />
      )}
    </form>
  );
}
