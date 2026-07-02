"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@event/db";
import { requireSalesRole, isSuperAdmin } from "../auth/rbac";
import { getActiveCompanyId } from "../tenant";
import { saveUpload } from "../storage";
import type { SessionUser } from "../auth/session";

export type PackageState = { error: string; ok?: boolean };

function canManage(user: SessionUser): boolean {
  return isSuperAdmin(user) || user.role === "COMPANY_ADMIN" || user.role === "SALES";
}

/** Create a package / menu item (with optional images). */
export async function createPackageAction(
  _prev: PackageState,
  formData: FormData,
): Promise<PackageState> {
  const user = await requireSalesRole();
  if (!canManage(user)) return { error: "You don't have permission." };
  const companyId = await getActiveCompanyId(user);
  if (!companyId) return { error: "Select a company first." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Package name is required." };
  const price = Number(formData.get("price") ?? 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const code = String(formData.get("code") ?? "").trim() || null;
  const tierLabel = String(formData.get("tierLabel") ?? "").trim() || null;
  const opRaw = String(formData.get("originalPrice") ?? "").trim();
  const opNum = Number(opRaw);
  const originalPrice = opRaw !== "" && Number.isFinite(opNum) ? opNum : null;

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const imageUrls: string[] = [];
  for (const file of files) {
    try {
      const stored = await saveUpload(companyId, file);
      if (stored) {
        imageUrls.push(stored.url);
        // The uploads route fails closed: without a public-kind Attachment row
        // the image 403s for anonymous visitors on the public site.
        await prisma.attachment.create({
          data: { companyId, kind: "PACKAGE", url: stored.url, filename: stored.filename, mimeType: stored.mimeType, sizeBytes: stored.size },
        });
      }
    } catch {
      // skip bad file
    }
  }

  await prisma.package.create({
    data: {
      companyId,
      name,
      code,
      tierLabel,
      category,
      description,
      price: Number.isFinite(price) ? price : 0,
      originalPrice,
      imageUrls,
    },
  });
  revalidatePath("/admin/packages");
  return { error: "", ok: true };
}

/** Edit an existing package's fields (not its images — use addPackageImagesAction). */
export async function updatePackageAction(
  packageId: string,
  _prev: PackageState,
  formData: FormData,
): Promise<PackageState> {
  const user = await requireSalesRole();
  if (!canManage(user)) return { error: "You don't have permission." };
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) return { error: "Not found." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Package name is required." };
  const price = Number(formData.get("price") ?? 0);
  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const code = String(formData.get("code") ?? "").trim() || null;
  const tierLabel = String(formData.get("tierLabel") ?? "").trim() || null;
  const opRaw = String(formData.get("originalPrice") ?? "").trim();
  const opNum = Number(opRaw);
  const originalPrice = opRaw !== "" && Number.isFinite(opNum) ? opNum : null;

  await prisma.package.update({
    where: { id: packageId },
    data: {
      name,
      code,
      tierLabel,
      category,
      description,
      price: Number.isFinite(price) ? price : 0,
      originalPrice,
    },
  });
  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function addPackageImagesAction(packageId: string, formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) return;
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const urls = Array.isArray(pkg.imageUrls) ? [...(pkg.imageUrls as string[])] : [];
  for (const file of files) {
    try {
      const stored = await saveUpload(pkg.companyId, file);
      if (stored) {
        urls.push(stored.url);
        await prisma.attachment.create({
          data: { companyId: pkg.companyId, kind: "PACKAGE", url: stored.url, filename: stored.filename, mimeType: stored.mimeType, sizeBytes: stored.size },
        });
      }
    } catch {
      // skip
    }
  }
  await prisma.package.update({ where: { id: packageId }, data: { imageUrls: urls } });
  revalidatePath("/admin/packages");
}

export async function deletePackageAction(packageId: string, _formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) return;
  await prisma.package.delete({ where: { id: packageId } });
  revalidatePath("/admin/packages");
}

export async function togglePackageAction(packageId: string, _formData: FormData): Promise<void> {
  const user = await requireSalesRole();
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg || (!isSuperAdmin(user) && user.companyId !== pkg.companyId)) return;
  await prisma.package.update({ where: { id: packageId }, data: { active: !pkg.active } });
  revalidatePath("/admin/packages");
}
