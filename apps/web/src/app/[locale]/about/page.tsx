import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
      <h1 className="text-4xl font-semibold">{dict.about.title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-white/70">{dict.about.body}</p>
    </main>
  );
}
