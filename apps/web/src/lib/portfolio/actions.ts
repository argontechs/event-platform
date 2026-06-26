"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import { getActiveCompanyId } from "../tenant";
import { saveUpload } from "../storage";
import type { SessionUser } from "../auth/session";

function canManage(user: SessionUser): boolean {
  return isSuperAdmin(user) || user.role === "COMPANY_ADMIN";
}

export type PortfolioState = { error: string; ok?: boolean };

/** Upload one or more showcase images for the active company. */
export async function uploadPortfolioAction(
  _prev: PortfolioState,
  formData: FormData,
): Promise<PortfolioState> {
  const user = await requireSalesRole();
  if (!canManage(user)) return { error: "You don't have permission." };
  const companyId = await getActiveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };

  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one image." };

  let saved = 0;
  for (const file of files) {
    try {
      const stored = await saveUpload(companyId, file);
      if (!stored) continue;
      await prisma.attachment.create({
        data: {
          companyId,
          kind: "PORTFOLIO",
          url: stored.url,
          filename: stored.filename,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
        },
      });
      saved++;
    } catch {
      // skip bad file
    }
  }
  if (saved === 0) return { error: "Upload failed — please try again." };
  revalidatePath("/admin/portfolio");
  return { error: "", ok: true };
}

export async function deletePortfolioAction(attachmentId: string, _formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  if (!canManage(user)) return;
  const att = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!att || att.kind !== "PORTFOLIO") return;
  if (!isSuperAdmin(user) && user.companyId !== att.companyId) return;
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath("/admin/portfolio");
}
