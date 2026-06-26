import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { EnquiryForm } from "@/components/site/enquiry-form";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
      <h1 className="text-4xl font-semibold">{dict.form.title}</h1>
      <p className="mt-3 text-white/60">{dict.form.subtitle}</p>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <EnquiryForm dict={dict.form} locale={locale} />
      </div>
    </main>
  );
}
