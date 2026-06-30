import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { CompanySwitcher } from "@/components/admin/company-switcher";
import { BoLangSwitcher } from "@/components/admin/bo-lang-switcher";
import { BoLangProvider } from "@/components/admin/bo-lang-context";
import { buildNav, label } from "@/lib/admin-nav";
import type { BoLang } from "@/lib/i18n/bo";
import type { SessionUser } from "@/lib/auth/session";

export function AdminShell({
  user,
  superAdmin,
  companies,
  activeCompanyId,
  lang,
  children,
}: {
  user: SessionUser;
  superAdmin: boolean;
  companies: { id: string; name: string }[];
  activeCompanyId: string | null;
  lang: BoLang;
  children: React.ReactNode;
}) {
  const groups = buildNav(user);
  const flat = groups.flatMap((g) => g.items);
  const t = (en: string, zh: string) => (lang === "zh" ? zh : en);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 print:block print:bg-white">
      <aside className="hidden w-60 shrink-0 bg-[#0c1c44] p-5 text-white md:block print:hidden">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-sky-300">{t("Back Office", "后台")}</p>
          <p className="mt-1 text-sm text-white/50">{t("Event & Decoration", "活动与布置")}</p>
        </div>
        <nav className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.en}>
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-white/35">{label(g, lang)}</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    {label(item, lang)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            {superAdmin ? (
              <CompanySwitcher companies={companies} activeId={activeCompanyId} />
            ) : (
              <span className="truncate text-sm text-slate-600">{user.name}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user.role !== "PLANNER" ? (
              <Link
                href="/admin/account"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                {t("Account", "账户")}
              </Link>
            ) : null}
            <Link
              href="/admin/handbook"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              {t("Handbook", "手册")}
            </Link>
            <BoLangSwitcher lang={lang} />
            <form action={logoutAction}>
              <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-800 transition hover:bg-slate-100">
                {t("Log out", "登出")}
              </button>
            </form>
          </div>
        </header>

        {/* Mobile nav — coloured strip (the blue sidebar is hidden on phones) */}
        <nav className="flex gap-1.5 overflow-x-auto bg-[#0c1c44] px-3 py-2.5 md:hidden print:hidden">
          {flat.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/85 transition hover:bg-white/20 hover:text-white"
            >
              {label(item, lang)}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 print:p-0">
          <BoLangProvider lang={lang}>{children}</BoLangProvider>
        </main>
      </div>
    </div>
  );
}
