"use client";

import { useActionState } from "react";
import { addLeadImagesAction, type UploadMoreState } from "@/lib/leads/actions";

const initial: UploadMoreState = { error: "" };

// The action returns stable error keys; this page renders them in English
// (it sits outside the localised customer funnel).
const ERRORS: Record<string, string> = {
  rateLimited: "Too many attempts. Try again in {minutes} minute(s).",
  invalidLink: "This link is invalid.",
  wrongPin: "Incorrect access code.",
  noPhotos: "Please choose at least one photo.",
  uploadFailed: "Upload failed — please try again.",
};

export function LeadUploadForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    addLeadImagesAction.bind(null, token),
    initial,
  );
  const errText = state.error
    ? (ERRORS[state.error] ?? state.error).replace("{minutes}", String(state.minutes ?? ""))
    : "";

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
      {state.error ? <p className="text-sm text-red-500">{errText}</p> : null}
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
