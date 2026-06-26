"use client";

import { useActionState } from "react";
import { uploadPortfolioAction, type PortfolioState } from "@/lib/portfolio/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: PortfolioState = { error: "" };

export function PortfolioUpload() {
  const [state, action, pending] = useActionState(uploadPortfolioAction, initial);
  const t = makeT(useBoLang());
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
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
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? t("Uploading…") : t("Upload images")}
      </button>
      {state.error ? <span className="text-sm text-red-500">{state.error}</span> : null}
      {state.ok ? <span className="text-sm text-emerald-600">{t("Uploaded.")}</span> : null}
    </form>
  );
}
