"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "../auth/rbac";
import { hashPassword, verifyPassword } from "../auth/password";
import { getActiveCompanyId } from "../tenant";
import { createSession, type SessionUser, type Role } from "../auth/session";
import { isRateLimited, recordFailure, clearAttempts } from "../rate-limit";

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

export type ResetPwState = { error: string; ok?: boolean };

/**
 * Admin resets ANOTHER staff member's password. (Changing your own password is
 * done at /admin/account, which re-issues your session — resetting your own here
 * would silently log you out.) Bumps tokenVersion so the target's sessions are
 * invalidated immediately.
 */
export async function resetPasswordAction(
  userId: string,
  _prev: ResetPwState,
  formData: FormData,
): Promise<ResetPwState> {
  const me = await requireUser();
  if (userId === me.id) {
    return { error: "Use Account → Change password to change your own password." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };
  const canManage =
    isSuperAdmin(me) || (me.role === "COMPANY_ADMIN" && me.companyId === target.companyId);
  if (!canManage) return { error: "You don't have permission to reset this password." };
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
  });
  revalidatePath("/admin/users");
  return { error: "", ok: true };
}

export type ChangePwState = { error: string; ok?: boolean };

/** A logged-in user changes their OWN password (current → new). */
export async function changeMyPasswordAction(
  _prev: ChangePwState,
  formData: FormData,
): Promise<ChangePwState> {
  const me = await requireUser();
  const key = `pwchange:${me.id}`;
  const rl = isRateLimited(key);
  if (rl.limited) return { error: `Too many attempts — try again in ${rl.retryAfterSec}s.` };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };
  if (next === current) return { error: "New password must be different from the current one." };

  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!row) return { error: "Account not found." };
  if (!(await verifyPassword(current, row.passwordHash))) {
    recordFailure(key);
    return { error: "Current password is incorrect." };
  }

  // New hash + tokenVersion bump (logs out every OTHER session). Then re-issue
  // THIS device's cookie with the new tokenVersion so the user stays signed in.
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next), tokenVersion: { increment: 1 } },
    select: { id: true, email: true, name: true, role: true, companyId: true, tokenVersion: true },
  });
  await createSession({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role as Role,
    companyId: updated.companyId,
    tokenVersion: updated.tokenVersion,
  });
  clearAttempts(key);
  return { error: "", ok: true };
}
