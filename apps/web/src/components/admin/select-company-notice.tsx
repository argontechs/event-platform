"use client";

import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

export function SelectCompanyNotice() {
  const t = makeT(useBoLang());
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-slate-800">
      {t("Pick a company from the switcher above to view its data.")}
    </div>
  );
}
