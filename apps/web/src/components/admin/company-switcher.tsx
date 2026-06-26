"use client";

import { useTransition } from "react";
import { selectCompanyAction } from "@/lib/tenant-actions";

type Company = { id: string; name: string };

export function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: Company[];
  activeId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Active company"
      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none disabled:opacity-50"
      value={activeId ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => {
          void selectCompanyAction(e.target.value);
        })
      }
    >
      <option value="" disabled>
        {companies.length ? "Select company…" : "No companies yet"}
      </option>
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
