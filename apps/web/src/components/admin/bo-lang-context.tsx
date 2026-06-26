"use client";

import { createContext, useContext } from "react";
import type { BoLang } from "@/lib/i18n/bo";

const Ctx = createContext<BoLang>("en");

export function BoLangProvider({ lang, children }: { lang: BoLang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

/** Read the back-office language inside client components (forms). */
export function useBoLang(): BoLang {
  return useContext(Ctx);
}
