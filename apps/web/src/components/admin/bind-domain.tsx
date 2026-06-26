"use client";

import { useActionState } from "react";
import { bindDomainAction, type CfState } from "@/lib/cloudflare/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: CfState = { error: "" };

export function BindDomain({
  companyId,
  domains,
}: {
  companyId: string;
  domains: string[];
}) {
  const [state, action, pending] = useActionState(
    bindDomainAction.bind(null, companyId),
    initial,
  );
  const t = makeT(useBoLang());

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">{t("Custom domains")}</h2>
      <p className="mt-1 text-xs text-slate-500">
        {t("Binds a domain by creating a DNS A record at Cloudflare pointing to this server. A reverse proxy on ports 80/443 is still required to serve HTTPS on the domain.")}
      </p>

      {domains.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {domains.map((d) => (
            <li key={d} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
              {d}
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          name="domain"
          placeholder="events.yourbrand.com"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Binding…") : t("Bind via Cloudflare")}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-red-500">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-emerald-600">{t("Domain bound — DNS record created.")}</p> : null}
    </div>
  );
}
