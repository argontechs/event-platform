"use client";

import { useRef } from "react";
import { useBoLang } from "@/components/admin/bo-lang-context";
import { makeT } from "@/lib/i18n/t";

/**
 * Confirmation step for destructive server-action forms.
 *
 * Drop it inside an existing `<form action={someServerAction}>` in place of
 * the bare submit button: it renders the trigger (keeping the caller's
 * existing button classes) plus a native <dialog> — Esc and backdrop
 * dismissal come free (same pattern as ZoomableImage). The confirm button is
 * the real submit for the wrapping form, so the server action only fires
 * after an explicit confirmation.
 */
export function ConfirmSubmit({
  label,
  title,
  description,
  confirmLabel,
  variant = "danger",
  buttonClassName,
  ariaLabel,
}: {
  /** Trigger button content — keeps the existing button text/icon. */
  label: React.ReactNode;
  /** Question the dialog asks, e.g. "Delete this package?" (pre-translated). */
  title: string;
  /** Optional consequence line, e.g. "This cannot be undone." */
  description?: string;
  /** Confirm button text (pre-translated). */
  confirmLabel: string;
  /** danger = red destructive confirm; primary = accent confirm (e.g. resend). */
  variant?: "danger" | "primary";
  /** Classes for the trigger — pass the existing button classes through. */
  buttonClassName?: string;
  /** Accessible name for icon-only triggers (e.g. "✕"). */
  ariaLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const t = makeT(useBoLang());

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onClick={() => {
          dialogRef.current?.showModal();
          // Safe default: keyboard focus starts on Cancel, not the action.
          cancelRef.current?.focus();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // Backdrop clicks land on the <dialog> element itself; clicks on
          // the panel hit its children — so this only dismisses on backdrop.
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto w-full max-w-sm rounded-xl border border-slate-200 bg-white p-0 text-left backdrop:bg-black/60"
      >
        <div className="p-5">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              onClick={() => dialogRef.current?.close()}
              className={
                variant === "primary"
                  ? "rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                  : "rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              }
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
