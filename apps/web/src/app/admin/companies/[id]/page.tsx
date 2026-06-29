import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { updateCompanyAction } from "@/lib/companies/actions";
import { CompanyForm } from "@/components/admin/company-form";
import { AiKeyTester } from "@/components/admin/ai-key-tester";
import { BindDomain } from "@/components/admin/bind-domain";
import type { CompanyFormValues } from "@/lib/companies/schema";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const user = await requireUser();
  const allowed =
    isSuperAdmin(user) ||
    (user.role === "COMPANY_ADMIN" && user.companyId === id);
  if (!allowed) redirect("/admin");

  const c = await prisma.company.findUnique({ where: { id } });
  if (!c) notFound();

  const values: CompanyFormValues = {
    name: c.name,
    legalName: c.legalName ?? "",
    ssmRegNo: c.ssmRegNo ?? "",
    sstRegistered: c.sstRegistered,
    sstRegNo: c.sstRegNo ?? "",
    sstRate: String(c.sstRate),
    logoUrl: c.logoUrl ?? "",
    brandPrimary: c.brandPrimary ?? "",
    brandSecondary: c.brandSecondary ?? "",
    brandFont: c.brandFont ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    postcode: c.postcode ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    bankName: c.bankName ?? "",
    bankAccountName: c.bankAccountName ?? "",
    bankAccountNo: c.bankAccountNo ?? "",
    duitnowQrUrl: c.duitnowQrUrl ?? "",
    quotePrefix: c.quotePrefix,
    invoicePrefix: c.invoicePrefix,
    defaultProfitPercent: String(c.defaultProfitPercent),
    defaultDepositPercent: String(c.defaultDepositPercent),
    defaultLanguage: c.defaultLanguage,
    customDomains: c.customDomains.join(", "),
    aiEnabled: c.aiEnabled,
    aiModel: c.aiModel,
    waPhoneNumberId: c.waPhoneNumberId ?? "",
    waBusinessId: c.waBusinessId ?? "",
    waBotEnabled: c.waBotEnabled,
    waBotContext: c.waBotContext ?? "",
    termsAndConditions: c.termsAndConditions ?? "",
    seoTitle: c.seoTitle ?? "",
    seoDescription: c.seoDescription ?? "",
    ogImageUrl: c.ogImageUrl ?? "",
    facebookUrl: c.facebookUrl ?? "",
    instagramUrl: c.instagramUrl ?? "",
    tiktokUrl: c.tiktokUrl ?? "",
    youtubeUrl: c.youtubeUrl ?? "",
    cloudflareZoneId: c.cloudflareZoneId ?? "",
  };

  const action = updateCompanyAction.bind(null, c.id);

  return (
    <section>
      {isSuperAdmin(user) ? (
        <Link href="/admin/companies" className="text-sm text-slate-500 hover:text-slate-900">
          ← Companies
        </Link>
      ) : null}
      <h1 className="mt-2 text-2xl font-semibold">{c.name}</h1>
      <p className="mt-1 text-sm text-slate-500">Company settings</p>

      {saved ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          Saved — changes are now in effect.
        </p>
      ) : null}

      <div className="mt-6">
        <CompanyForm
          action={action}
          initial={values}
          aiKeySet={Boolean(c.aiApiKeyEnc)}
          waTokenSet={Boolean(c.waAccessTokenEnc)}
          cfTokenSet={Boolean(c.cloudflareApiTokenEnc)}
          submitLabel="Save changes"
        />
      </div>

      <div className="mt-6 max-w-3xl">
        <AiKeyTester companyId={c.id} keySet={Boolean(c.aiApiKeyEnc)} />
      </div>

      {c.cloudflareApiTokenEnc && c.cloudflareZoneId ? (
        <div className="mt-6 max-w-3xl">
          <BindDomain companyId={c.id} domains={c.customDomains} />
        </div>
      ) : null}
    </section>
  );
}
