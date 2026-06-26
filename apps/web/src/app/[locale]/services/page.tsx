import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-32">
      <h1 className="text-4xl font-semibold">{dict.services.title}</h1>
      <p className="mt-3 max-w-xl text-white/60">{dict.services.subtitle}</p>

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
        {dict.services.items.map((s, i) => (
          <div key={i} className="bg-ink p-8">
            <span className="text-sm text-[var(--brand)]">0{i + 1}</span>
            <h2 className="mt-3 text-2xl font-medium">{s.title}</h2>
            <p className="mt-3 text-white/60">{s.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
