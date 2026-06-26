"use client";

import { useActionState } from "react";
import { addLeadImagesAction, type UploadMoreState } from "@/lib/leads/actions";

const initial: UploadMoreState = { error: "" };

export function LeadUploadForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    addLeadImagesAction.bind(null, token),
    initial,
  );

  if (state.ok) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
        ✓ Thank you! {state.count} photo{state.count === 1 ? "" : "s"} received. Our team
        will use these to finalise your proposal. You can close this page.
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600">Access code</span>
        <input
          name="pin"
          inputMode="numeric"
          required
          placeholder="6-digit code from our team"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-600">Photos</span>
        <input
          name="images"
          type="file"
          accept="image/*"
          multiple
          required
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
        />
      </label>
      {state.error ? <p className="text-sm text-red-500">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload photos"}
      </button>
    </form>
  );
}
