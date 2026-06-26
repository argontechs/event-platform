import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@event/db";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCompanyByHost } from "@/lib/tenant";
import { Hero3D } from "@/components/site/hero";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const base = `/${locale}`;

  const host = (await headers()).get("host");
  const company =
    (await getCompanyByHost(host).catch(() => null)) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));
  const showcase = company
    ? await prisma.attachment.findMany({
        where: { companyId: company.id, kind: "PORTFOLIO" },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
    : [];

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        {/* Event & decoration footage background */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        >
          <source src="/bg.mp4" type="video/mp4" />
        </video>
        {/* Blue tint + legibility overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,12,28,0.55) 0%, rgba(6,12,28,0.80) 100%), radial-gradient(60% 60% at 30% 20%, color-mix(in oklab, var(--brand) 28%, transparent), transparent 60%), radial-gradient(50% 50% at 80% 90%, color-mix(in oklab, var(--brand-2) 42%, transparent), transparent 60%)",
          }}
        />
        <div className="absolute inset-0">
          <Hero3D />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
          <p className="reveal text-xs uppercase tracking-[0.35em] text-sky-300">
            {dict.hero.eyebrow}
          </p>
          <h1 className="reveal reveal-1 mt-4 max-w-3xl text-[clamp(2.5rem,1rem+6vw,5.5rem)] font-semibold leading-[1.02]">
            <span className="gradient-text">{dict.hero.title}</span>
          </h1>
          <p className="reveal reveal-2 mt-6 max-w-xl text-lg text-white/70">
            {dict.hero.subtitle}
          </p>
          <div className="reveal reveal-3 mt-9 flex flex-wrap gap-4">
            <Link
              href={`${base}/contact`}
              className="rounded-full px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:brightness-110"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {dict.hero.cta}
            </Link>
            <Link
              href={`${base}/portfolio`}
              className="rounded-full border border-white/20 px-6 py-3 font-medium text-white/90 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              {dict.hero.secondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            { n: "500+", l: "Events styled" },
            { n: "10+", l: "Years of magic" },
            { n: "100%", l: "Bespoke designs" },
            { n: "5★", l: "Client love" },
          ].map((s, i) => (
            <div key={i} className={`reveal reveal-${i + 1} text-center`}>
              <p className="gradient-text text-3xl font-bold sm:text-4xl">{s.n}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-white/50">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-3xl font-semibold sm:text-4xl">{dict.services.title}</h2>
        <p className="mt-2 max-w-xl text-white/60">{dict.services.subtitle}</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dict.services.items.map((s, i) => (
            <div
              key={i}
              className={`card-glow reveal reveal-${(i % 4) + 1} rounded-2xl border border-white/10 bg-white/[0.03] p-6`}
            >
              <span className="gradient-text text-2xl font-bold">0{i + 1}</span>
              <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-white/55">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase teaser */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">{dict.showcase.title}</h2>
            <p className="mt-2 text-white/60">{dict.showcase.subtitle}</p>
          </div>
          <Link href={`${base}/portfolio`} className="text-sm text-sky-300 hover:underline">
            {dict.nav.portfolio} →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showcase.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`reveal reveal-${(i % 4) + 1} aspect-[4/3] rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent`}
                />
              ))
            : showcase.map((img, i) => (
                <div key={img.id} className={`card-glow reveal reveal-${(i % 4) + 1} overflow-hidden rounded-2xl border border-white/10`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.filename ?? "showcase"}
                    className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-105"
                  />
                </div>
              ))}
        </div>
      </section>

      {/* About + CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-12"
          style={{
            background:
              "radial-gradient(80% 120% at 0% 0%, color-mix(in oklab, var(--brand) 35%, transparent), transparent 60%), radial-gradient(80% 120% at 100% 100%, color-mix(in oklab, var(--brand-2) 45%, transparent), transparent 60%), rgba(255,255,255,0.03)",
          }}
        >
          <h2 className="text-3xl font-semibold sm:text-4xl">{dict.about.title}</h2>
          <p className="mt-3 max-w-2xl text-white/75">{dict.about.body}</p>
          <Link
            href={`${base}/contact`}
            className="mt-7 inline-block rounded-full px-6 py-3 font-medium text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {dict.contact.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
