"use client";

// Triggers the browser's print dialog, whose default destination is
// "Save as PDF" — the standard way to save a web document to a file.
export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
    >
      {label}
    </button>
  );
}
