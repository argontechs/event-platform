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

const DEFAULT_PRIMARY = "#2f6fed";

/**
 * Derived brand accents (The Tenant Spotlight Rule).
 *
 * Public accent colors route through these CSS vars so a non-blue tenant
 * re-skins with zero code changes. For the platform-default spotlight
 * (#2f6fed, or an unset brandPrimary) every var is pinned to the exact
 * literal the site has always rendered — pixel-identical today.
 *
 * For any other brandPrimary they are approximated from --brand / --brand-2:
 *   --brand-soft          eyebrow / accent link text = brand 55% + white
 *   --brand-soft-muted    dim accent ("Included")    = soft at 70% alpha
 *   --brand-glow          CTA resting glow           = brand at 30% alpha
 *   --brand-glow-strong   card hover glow            = brand at 55% alpha
 *   --brand-glow-border   card hover border          = soft at 50% alpha
 *   --brand-grad-1/2      signature gradient stops   = brand / brand-2 toward white
 *   --brand-wash-1/2      body radial ambience       = brand / brand-2 at 20% / 16% alpha
 *   --brand-wash-1/2-strong  auth/lead backdrop      = brand / brand-2 at 35% / 30% alpha
 */
function brandAccentVars(brandPrimary: string): Record<string, string> {
  if (brandPrimary.trim().toLowerCase() === DEFAULT_PRIMARY) {
    return {
      "--brand-soft": "#7dd3fc",
      "--brand-soft-muted": "rgba(125,211,252,0.7)",
      "--brand-glow": "rgba(59,130,246,0.3)",
      "--brand-glow-strong": "rgba(47,111,237,0.55)",
      "--brand-glow-border": "rgba(124,192,255,0.5)",
      "--brand-grad-1": "#7cc0ff",
      "--brand-grad-2": "#a78bfa",
      "--brand-wash-1": "rgba(37,99,235,0.20)",
      "--brand-wash-2": "rgba(14,116,233,0.16)",
      "--brand-wash-1-strong": "rgba(37,99,235,0.35)",
      "--brand-wash-2-strong": "rgba(14,116,233,0.30)",
    };
  }
  return {
    "--brand-soft": "color-mix(in oklab, var(--brand) 55%, white)",
    "--brand-soft-muted": "color-mix(in oklab, var(--brand-soft) 70%, transparent)",
    "--brand-glow": "color-mix(in oklab, var(--brand) 30%, transparent)",
    "--brand-glow-strong": "color-mix(in oklab, var(--brand) 55%, transparent)",
    "--brand-glow-border": "color-mix(in oklab, var(--brand-soft) 50%, transparent)",
    "--brand-grad-1": "color-mix(in oklab, var(--brand) 60%, white)",
    "--brand-grad-2": "color-mix(in oklab, var(--brand-2) 45%, white)",
    "--brand-wash-1": "color-mix(in oklab, var(--brand) 20%, transparent)",
    "--brand-wash-2": "color-mix(in oklab, var(--brand-2) 16%, transparent)",
    "--brand-wash-1-strong": "color-mix(in oklab, var(--brand) 35%, transparent)",
    "--brand-wash-2-strong": "color-mix(in oklab, var(--brand-2) 30%, transparent)",
  };
}

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
  const primary = company?.brandPrimary ?? DEFAULT_PRIMARY;
  const secondary = company?.brandSecondary ?? "#0e3a8a";

  return (
    <div
      style={
        {
          "--brand": primary,
          "--brand-2": secondary,
          ...brandAccentVars(primary),
        } as React.CSSProperties
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
