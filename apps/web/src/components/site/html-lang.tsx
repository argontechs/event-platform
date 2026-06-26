"use client";

import { useEffect } from "react";

/**
 * Sets <html lang> to the active locale. The root layout owns <html> (it also
 * wraps /admin), so a nested layout can't change the attribute declaratively —
 * we update it on the client so /ms and /zh report the correct language to
 * assistive tech and translation tools.
 */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
