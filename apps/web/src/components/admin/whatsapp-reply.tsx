"use client";

import { useActionState } from "react";
import { sendWhatsappMessageAction, type WaState } from "@/lib/whatsapp/actions";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

const initial: WaState = { error: "" };

export function WhatsappReply({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(
    sendWhatsappMessageAction.bind(null, conversationId),
    initial,
  );
  const t = makeT(useBoLang());

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          rows={2}
          required
          placeholder={t("Type a reply…")}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? t("Sending…") : t("Send")}
        </button>
      </div>
      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
    </form>
  );
}
