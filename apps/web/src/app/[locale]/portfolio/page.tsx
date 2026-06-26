import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@event/db";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCompanyByHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const host = (await headers()).get("host");
  const company =
    (await getCompanyByHost(host).catch(() => null)) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: "asc" } }));
  const images = company
    ? await prisma.attachment.findMany({
        where: { companyId: company.id, kind: "PORTFOLIO" },
        orderBy: { createdAt: "desc" },
        take: 60,
      })
    : [];

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-32">
      <h1 className="text-4xl font-semibold">{dict.showcase.title}</h1>
      <p className="mt-3 text-white/60">{dict.showcase.subtitle}</p>

      {images.length === 0 ? (
        <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="break-inside-avoid rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent"
              style={{ height: 180 + ((i * 47) % 160) }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.url}
              alt={img.filename ?? "portfolio"}
              className="w-full break-inside-avoid rounded-2xl border border-white/10 object-cover"
            />
          ))}
        </div>
      )}
    </main>
  );
}
