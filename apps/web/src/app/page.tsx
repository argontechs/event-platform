import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { getCompanyByHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // Send the visitor to the company's own default language (EN/MS/ZH) when the
  // host matches a tenant; fall back to the primary locale otherwise.
  const host = (await headers()).get("host");
  const company = await getCompanyByHost(host).catch(() => null);
  const lang = company?.defaultLanguage?.toLowerCase();
  const locale: Locale = lang && isLocale(lang) ? lang : defaultLocale;
  redirect(`/${locale}`);
}
