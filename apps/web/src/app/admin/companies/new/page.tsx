import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/rbac";
import { createCompanyAction } from "@/lib/companies/actions";
import { CompanyForm } from "@/components/admin/company-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  await requireSuperAdmin();

  return (
    <section>
      <Link href="/admin/companies" className="text-sm text-slate-500 hover:text-slate-900">
        ← Companies
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New company</h1>
      <p className="mt-1 text-sm text-slate-500">
        These details flow into the company&apos;s quotes, invoices, emails and site.
      </p>
      <div className="mt-6">
        <CompanyForm action={createCompanyAction} submitLabel="Create company" />
      </div>
    </section>
  );
}
