"use client";

import { useFormStatus } from "react-dom";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type AcceptLabels = Dictionary["quote"]["accept"];

function SubmitBtn({ labels }: { labels: AcceptLabels }) {
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
      {pending ? labels.processing : labels.cta}
    </button>
  );
}

export function AcceptQuoteButton({
  action,
  labels,
}: {
  action: () => void | Promise<void>;
  labels: AcceptLabels;
}) {
  return (
    <form action={action}>
      <SubmitBtn labels={labels} />
    </form>
  );
}
