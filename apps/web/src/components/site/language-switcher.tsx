"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rest = pathname.replace(/^\/(en|ms|zh)(?=\/|$)/, "");
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <select
      value={current}
      onChange={(e) => router.push(`/${e.target.value}${rest || ""}${suffix}`)}
      aria-label="Language"
      className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white outline-none focus:border-white/40 [&_option]:bg-slate-900 [&_option]:text-white"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}
