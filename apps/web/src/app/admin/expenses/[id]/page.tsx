import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin, canManageCompany } from "@/lib/auth/rbac";
import {
  approveExpenseAction,
  rejectExpenseAction,
  markReimbursedAction,
} from "@/lib/expenses/actions";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  REIMBURSED: "bg-blue-50 text-blue-700",
};
const STATUS_ZH: Record<string, string> = {
  SUBMITTED: "待审批",
  APPROVED: "已批准",
  REJECTED: "已拒绝",
  REIMBURSED: "已报销",
};
const CAT_ZH: Record<string, string> = {
  MATERIALS: "材料",
  TRANSPORT: "交通",
  RENTAL: "租赁",
  FOOD: "餐饮",
  MARKETING: "营销",
  SALARY: "薪资",
  MISC: "其他",
};

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const lang = await getBoLang();
  const t = makeT(lang);

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { name: true } },
      approver: { select: { name: true } },
      booking: { select: { id: true, title: true } },
      attachments: { where: { kind: "RECEIPT" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!expense) notFound();
  if (!isSuperAdmin(user) && user.companyId !== expense.companyId) redirect("/admin/expenses");

  const manager = canManageCompany(user);
  const catLabel = lang === "zh" ? CAT_ZH[expense.category] ?? expense.category : expense.category.toLowerCase();
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );

  return (
    <section className="max-w-3xl">
      <Link href="/admin/expenses" className="text-sm text-slate-500 hover:text-slate-900">
        ← {t("Expenses")}
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{expense.vendor}</h1>
        <span className={`rounded px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[expense.status] ?? "bg-slate-100 text-slate-600"}`}>
          {lang === "zh" ? STATUS_ZH[expense.status] ?? expense.status : expense.status.toLowerCase()}
        </span>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {/* Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {row(t("Date"), expense.expenseDate.toISOString().slice(0, 10))}
          {row(t("Category"), catLabel)}
          {row(t("Amount paid (RM)"), Number(expense.amount).toFixed(2))}
          {row(t("SST / tax (RM)"), Number(expense.sstAmount).toFixed(2))}
          {row(t("Paid by"), expense.paymentMethod || "—")}
          {row(t("For event (optional)"), expense.booking?.title ?? t("— company overhead —"))}
          {row(t("Submitted by"), expense.submittedBy?.name ?? "—")}
          {expense.approver ? row(t("Reviewed by"), expense.approver.name ?? "—") : null}
          {expense.notes ? (
            <div className="pt-2 text-sm">
              <p className="text-slate-500">{t("Notes")}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">{expense.notes}</p>
            </div>
          ) : null}
        </div>

        {/* Receipts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">{t("Receipts")}</h2>
          {expense.attachments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">{t("No receipt attached.")}</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {expense.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt="receipt" className="aspect-[3/4] w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manager actions */}
      {manager ? (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-sm text-slate-600">{t("Review:")}</span>
          {expense.status === "SUBMITTED" ? (
            <>
              <form action={approveExpenseAction.bind(null, expense.id)}>
                <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
                  {t("Approve")}
                </button>
              </form>
              <form action={rejectExpenseAction.bind(null, expense.id)}>
                <button className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                  {t("Reject")}
                </button>
              </form>
            </>
          ) : expense.status === "APPROVED" ? (
            <form action={markReimbursedAction.bind(null, expense.id)}>
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
                {t("Mark reimbursed")}
              </button>
            </form>
          ) : (
            <span className="text-sm text-slate-400">{t("No further action.")}</span>
          )}
        </div>
      ) : null}
    </section>
  );
}
