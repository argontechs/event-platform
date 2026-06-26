"use client";

import { useState } from "react";
import { useActionState } from "react";
import { requestChangesAction, type ChangeState } from "@/lib/quotes/public-actions";

const initial: ChangeState = { error: "" };

export function RequestChangesForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    requestChangesAction.bind(null, token),
    initial,
  );

  if (state.ok) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
        ✓ Thanks! Your requested changes were sent to our team. We&apos;ll prepare a revised
        proposal and send you a new link shortly.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/20 px-6 py-3 font-medium text-white/90 transition hover:bg-white/5"
      >
        Request changes
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-white/70">Tell us what you&apos;d like adjusted — and add inspiration photos if you have any.</p>
      <textarea
        name="comment"
        rows={3}
        required
        placeholder="e.g. We'd prefer more greenery, a longer head table, and a blush-and-gold palette."
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
      />
      <input
        name="images"
        type="file"
        accept="image/*"
        multiple
        className="text-sm text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
      />
      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full px-5 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          style={{ backgroundColor: "var(--brand, #2f6fed)" }}
        >
          {pending ? "Sending…" : "Send change request"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/20 px-5 py-2.5 text-white/80 hover:bg-white/5">
          Cancel
        </button>
      </div>
    </form>
  );
}
