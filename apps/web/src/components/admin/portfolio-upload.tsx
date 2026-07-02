"use client";

import { useActionState, useState } from "react";
import { uploadPortfolioAction, type PortfolioState } from "@/lib/portfolio/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: PortfolioState = { error: "" };
const MAX_FILE = 8 * 1024 * 1024; // matches storage.ts per-file cap
const MAX_TOTAL = 24 * 1024 * 1024; // under the 25mb Server Action body limit

export function PortfolioUpload() {
  const [state, action, pending] = useActionState(uploadPortfolioAction, initial);
  const [tooBig, setTooBig] = useState("");
  const t = makeT(useBoLang());

  function check(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.some((f) => f.size > MAX_FILE)) {
      setTooBig(t("Each image must be under 8 MB."));
    } else if (list.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) {
      setTooBig(t("Too much at once — upload fewer images per batch."));
    } else {
      setTooBig("");
    }
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input
        name="images"
        type="file"
        accept="image/*"
        multiple
        required
        onChange={(e) => check(e.target.files)}
        className="text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white"
      />
      <button
        type="submit"
        disabled={pending || !!tooBig}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? t("Uploading…") : t("Upload images")}
      </button>
      {tooBig ? <span className="text-sm text-red-500">{tooBig}</span> : null}
      {!tooBig && state.error ? <span className="text-sm text-red-500">{state.error}</span> : null}
      {state.ok ? <span className="text-sm text-emerald-600">{t("Uploaded.")}</span> : null}
    </form>
  );
}
