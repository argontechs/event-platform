import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { ref } = await searchParams;
  const dict = getDictionary(locale);
  const s = dict.form.success;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 text-center">
      <div
        className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
        style={{ backgroundColor: "var(--brand, #2f6fed)" }}
      >
        ✓
      </div>
      <h1 className="text-3xl font-semibold">{s.title}</h1>
      <p className="mt-3 text-white/60">{s.body}</p>

      {ref ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4">
          <p className="text-xs uppercase tracking-widest text-white/40">{s.ref}</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand,#2f6fed)]">{ref}</p>
        </div>
      ) : null}

      <Link
        href={`/${locale}`}
        className="mt-8 inline-block text-sm text-white/60 hover:text-white"
      >
        ← {s.home}
      </Link>
    </main>
  );
}
