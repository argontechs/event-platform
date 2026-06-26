import { cookies } from "next/headers";
import { prisma } from "@event/db";
import type { SessionUser } from "./auth/session";

export const ACTIVE_COMPANY_COOKIE = "ep_active_company";

/** Resolve the company that owns a public hostname (custom-domain model). */
export async function getCompanyByHost(host: string | null) {
  if (!host) return null;
  // Domains are stored normalised (lowercase, no leading "www."), so normalise
  // the incoming host the same way and match exactly — matching extra variants
  // would let one stored label answer for hostnames a different tenant owns.
  const clean = host.split(":")[0]!.toLowerCase().replace(/^www\./, "");
  return prisma.company.findFirst({
    where: { customDomains: { has: clean }, status: "active" },
  });
}

/**
 * The company a back-office user is acting within.
 * - Company users: always their own company.
 * - Super-admin: the company chosen via the switcher (cookie), or null (group view).
 */
export async function getActiveCompanyId(user: SessionUser): Promise<string | null> {
  if (user.role !== "SUPER_ADMIN") return user.companyId;
  const store = await cookies();
  return store.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
}

export async function setActiveCompanyId(companyId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // persist the selection for 30 days
  });
}
