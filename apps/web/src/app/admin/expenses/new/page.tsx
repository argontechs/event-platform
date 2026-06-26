import Link from "next/link";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { ExpenseForm } from "@/components/admin/expense-form";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const user = await requireUser();
  const t = makeT(await getBoLang());
  const companyId = isSuperAdmin(user) ? await getActiveCompanyId(user) : user.companyId;

  const bookings = companyId
    ? await prisma.booking.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, title: true },
      })
    : [];

  return (
    <section className="max-w-2xl">
      <Link href="/admin/expenses" className="text-sm text-slate-500 hover:text-slate-900">
        ← {t("Expenses")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{t("New expense claim")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t("Upload your receipt and submit a claim for reimbursement.")}
      </p>
      {!companyId ? (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-slate-800">
          {t("Pick a company from the switcher above to view its data.")}
        </p>
      ) : (
        <div className="mt-6">
          <ExpenseForm bookings={bookings} />
        </div>
      )}
    </section>
  );
}
