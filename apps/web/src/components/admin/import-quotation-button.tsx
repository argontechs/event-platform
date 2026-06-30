"use client";

import { useActionState, useEffect, useRef } from "react";
import { importQuotationFromFileAction, type ImportQuotationState } from "@/lib/quotations/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: ImportQuotationState = { error: "" };

export function ImportQuotationButton({ quotationId }: { quotationId: string }) {
  const [state, action, pending] = useActionState(
    importQuotationFromFileAction.bind(null, quotationId),
    initial,
  );
  const t = makeT(useBoLang());
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // After a run, clear the file input so the same image can be re-picked.
  useEffect(() => {
    if (state.ok || state.error) inputRef.current && (inputRef.current.value = "");
  }, [state.ok, state.error]);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/*"
        className="hidden"
        onChange={() => formRef.current?.requestSubmit()}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        title={t("Upload a photo/screenshot of an existing quote — AI reads the items in.")}
        className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? t("Reading…") : t("Import quote")}
      </button>
      {state.error ? <span className="text-xs text-red-500">{state.error}</span> : null}
      {state.ok && state.count ? (
        <span className="text-xs text-emerald-600">
          {t("Imported")} {state.count}
        </span>
      ) : null}
    </form>
  );
}
