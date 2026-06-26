"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "../auth/rbac";
import { hashPassword } from "../auth/password";
import { getActiveCompanyId } from "../tenant";
import type { SessionUser } from "../auth/session";

export type UserFormState = { error: string; ok?: boolean };

const COMPANY_ROLES = ["COMPANY_ADMIN", "SALES", "PLANNER"];
const ALL_ROLES = ["SUPER_ADMIN", ...COMPANY_ROLES];

function roleAllowed(actor: SessionUser, role: string): boolean {
  return isSuperAdmin(actor) ? ALL_ROLES.includes(role) : COMPANY_ROLES.includes(role);
}

/** Create a staff account. Super-admin: any company/role. Company-admin: own company. */
export async function createUserAction(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const me = await requireUser();
  if (!(isSuperAdmin(me) || me.role === "COMPANY_ADMIN")) {
    return { error: "You don't have permission to add staff." };
  }

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "SALES");
  const password = String(formData.get("password") ?? "");

  if (!name || !email) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!roleAllowed(me, role)) return { error: "You can't assign that role." };

  let companyId: string | null;
  if (isSuperAdmin(me)) {
    if (role === "SUPER_ADMIN") {
      companyId = null;
    } else {
      companyId = String(formData.get("companyId") ?? "") || (await getActiveCompanyId(me));
      if (!companyId) return { error: "Select a company for this staff member." };
    }
  } else {
    companyId = me.companyId;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  await prisma.user.create({
    data: {
      email,
      name,
      role: role as never,
      companyId,
      passwordHash: await hashPassword(password),
      status: "active",
    },
  });
  revalidatePath("/admin/users");
  return { error: "", ok: true };
}

/** Update a staff member's role / status. */
export async function updateUserAction(userId: string, formData: FormData): Promise<void> {
  const me = await requireUser();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;

  const canManage =
    isSuperAdmin(me) || (me.role === "COMPANY_ADMIN" && me.companyId === target.companyId);
  if (!canManage) return;

  const role = String(formData.get("role") ?? target.role);
  const status = String(formData.get("status") ?? target.status);

  const data: Record<string, unknown> = {};
  if (roleAllowed(me, role)) data.role = role;
  if (status === "active" || status === "disabled") data.status = status;
  // Never let someone lock themselves out.
  if (target.id === me.id) delete data.status;

  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/admin/users");
}

/** Reset a staff member's password. */
export async function resetPasswordAction(userId: string, formData: FormData): Promise<void> {
  const me = await requireUser();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;
  const canManage =
    isSuperAdmin(me) || (me.role === "COMPANY_ADMIN" && me.companyId === target.companyId);
  if (!canManage) return;
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return;
  // Bump tokenVersion so every outstanding session for this user is invalidated
  // on password reset — a leaked/old token stops working immediately.
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
  });
  revalidatePath("/admin/users");
}
