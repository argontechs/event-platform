"use client";

import { useFormStatus } from "react-dom";

function SubmitBtn() {
  // Disabled while the accept action is in flight — blocks the double-click that
  // would otherwise fire a second request before the page revalidates.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full px-6 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      style={{ backgroundColor: "var(--brand, #2f6fed)" }}
    >
      {pending ? "Processing…" : "Accept & Proceed to Payment"}
    </button>
  );
}

export function AcceptQuoteButton({ action }: { action: () => void | Promise<void> }) {
  return (
    <form action={action}>
      <SubmitBtn />
    </form>
  );
}
