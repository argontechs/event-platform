"use client";

import { useRef } from "react";
import { setBoLangAction } from "@/lib/i18n/bo-actions";
import type { BoLang } from "@/lib/i18n/bo";

export function BoLangSwitcher({ lang }: { lang: BoLang }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setBoLangAction}>
      <select
        name="lang"
        defaultValue={lang}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Language"
        className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-accent"
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </form>
  );
}
