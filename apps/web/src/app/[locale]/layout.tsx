import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@event/db";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCompanyByHost } from "@/lib/tenant";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { HtmlLang } from "@/components/site/html-lang";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const company =
    (await getCompanyByHost(host).catch(() => null)) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }).catch(() => null));
  const name = company?.name ?? "Event & Decoration";
  const title = company?.seoTitle || `${name} — Events & Decoration`;
  const description =
    company?.seoDescription ||
    "Bespoke event styling, backdrops and decoration. Plan your event with us.";
  const og = company?.ogImageUrl || undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: name,
      type: "website",
      images: og ? [{ url: og }] : undefined,
    },
    twitter: { card: og ? "summary_large_image" : "summary", title, description, images: og ? [og] : undefined },
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const host = (await headers()).get("host");
  // Resolve by custom domain; on IP/localhost (no match) fall back to the first
  // company so the preview shows real branding.
  const company =
    (await getCompanyByHost(host).catch(() => null)) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }).catch(() => null));

  const brandName = company?.name ?? "Your Event Co.";
  const primary = company?.brandPrimary ?? "#2f6fed";
  const secondary = company?.brandSecondary ?? "#0e3a8a";

  return (
    <div
      style={
        { "--brand": primary, "--brand-2": secondary } as React.CSSProperties
      }
    >
      <HtmlLang locale={locale} />
      <SiteNav locale={locale} dict={dict.nav} brandName={brandName} logoUrl={company?.logoUrl ?? null} />
      {children}
      <SiteFooter
        dict={dict.footer}
        brandName={brandName}
        social={{
          facebookUrl: company?.facebookUrl,
          instagramUrl: company?.instagramUrl,
          tiktokUrl: company?.tiktokUrl,
          youtubeUrl: company?.youtubeUrl,
        }}
      />
    </div>
  );
}
