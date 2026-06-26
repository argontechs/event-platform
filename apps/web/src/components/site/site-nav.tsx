"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";

export function SiteNav({
  locale,
  dict,
  brandName,
  logoUrl,
}: {
  locale: Locale;
  dict: Dictionary["nav"];
  brandName: string;
  logoUrl?: string | null;
}) {
  const base = `/${locale}`;
  const [open, setOpen] = useState(false);

  const links = [
    { href: `${base}/services`, label: dict.services },
    { href: `${base}/packages`, label: dict.packages },
    { href: `${base}/portfolio`, label: dict.portfolio },
    { href: `${base}/about`, label: dict.about },
    { href: `${base}/contact`, label: dict.contact },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href={base} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-9 w-auto object-contain" />
          ) : (
            brandName
          )}
        </Link>

        <div className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">{l.label}</Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher current={locale} />
          <Link
            href={`${base}/contact`}
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 sm:inline-block"
            style={{ backgroundColor: "var(--brand, #2f6fed)" }}
          >
            {dict.enquire}
          </Link>
          {/* Hamburger (mobile) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/20 text-white md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {open ? (
        <div className="mx-4 mb-2 rounded-xl border border-white/10 bg-[#0a1430]/95 p-4 backdrop-blur md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={`${base}/contact`}
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full px-4 py-2 text-center text-sm font-medium text-white"
              style={{ backgroundColor: "var(--brand, #2f6fed)" }}
            >
              {dict.enquire}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
