"use client";

import { useActionState } from "react";
import { testAiKeyAction, type AiKeyTestState } from "@/lib/companies/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: AiKeyTestState = { status: "idle", message: "" };

export function AiKeyTester({ companyId, keySet }: { companyId: string; keySet: boolean }) {
  const [state, action, pending] = useActionState(
    testAiKeyAction.bind(null, companyId),
    initial,
  );
  const t = makeT(useBoLang());

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">{t("Test OpenAI connection")}</h2>
      <p className="text-xs text-slate-500">
        {t("Check the API key works for quoting and photo generation.")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="aiApiKey"
          type="password"
          placeholder={keySet ? t("•••••••• (testing saved key — or paste a new one)") : "sk-…"}
          className="min-w-[16rem] flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Testing…") : t("Test connection")}
        </button>
      </div>
      {state.status === "ok" ? (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
