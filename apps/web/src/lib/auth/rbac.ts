import { redirect } from "next/navigation";
import { getSession, type SessionUser, type Role } from "./session";

/** Redirect to /login if not authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/** Require one of the given roles, else send to a safe landing. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/admin");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireRole("SUPER_ADMIN");
}

/**
 * Sales / finance / marketing actions — every role EXCEPT PLANNER. PLANNERs are
 * scoped to the planning dashboard + expenses; this blocks them from invoking
 * quotation / invoice / payment / package / portfolio / WhatsApp server actions
 * directly (the UI already hides these, but server actions are callable).
 */
export async function requireSalesRole(): Promise<SessionUser> {
  return requireRole("SUPER_ADMIN", "COMPANY_ADMIN", "SALES");
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN";
}

/** Can this user manage company-level settings? */
export function canManageCompany(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "COMPANY_ADMIN";
}
