import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "@/lib/auth/rbac";
import { getActiveCompanyId } from "@/lib/tenant";
import { SelectCompanyNotice } from "@/components/admin/select-company-notice";
import { PortfolioUpload } from "@/components/admin/portfolio-upload";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { deletePortfolioAction } from "@/lib/portfolio/actions";
import { getBoLang } from "@/lib/i18n/bo";
import { makeT } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function PortfolioAdminPage() {
  const t = makeT(await getBoLang());
  const user = await requireUser();
  if (!(isSuperAdmin(user) || user.role === "COMPANY_ADMIN")) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Portfolio")}</h1>
        <p className="mt-3 text-sm text-slate-500">{t("You don't have access to manage the portfolio.")}</p>
      </section>
    );
  }

  const companyId = await getActiveCompanyId(user);
  if (!companyId) {
    return (
      <section>
        <h1 className="text-2xl font-semibold">{t("Portfolio")}</h1>
        <div className="mt-6"><SelectCompanyNotice /></div>
      </section>
    );
  }

  const images = await prisma.attachment.findMany({
    where: { companyId, kind: "PORTFOLIO" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="max-w-4xl">
      <h1 className="text-2xl font-semibold">{t("Portfolio")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t("These images appear in your public site's showcase and portfolio pages.")}
      </p>

      <div className="mt-5">
        <PortfolioUpload />
      </div>

      {images.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">{t("No portfolio images yet — upload some above.")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-x-auto rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.filename ?? "portfolio"} className="aspect-square w-full object-cover" />
              <form action={deletePortfolioAction.bind(null, img.id)} className="absolute right-1.5 top-1.5">
                <ConfirmSubmit
                  label="✕"
                  ariaLabel={t("Delete image")}
                  title={t("Delete this image?")}
                  description={t("This cannot be undone.")}
                  confirmLabel={t("Delete")}
                  buttonClassName="rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
                />
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
