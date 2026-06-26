"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@event/db";
import { requireUser, isSuperAdmin } from "../auth/rbac";
import { decryptSecret } from "../crypto";

export type CfState = { error: string; ok?: boolean };

function serverIp(): string | null {
  try {
    return new URL(process.env.APP_BASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
}

/** Create a DNS A record at Cloudflare for the domain and bind it to the company. */
export async function bindDomainAction(
  companyId: string,
  _prev: CfState,
  formData: FormData,
): Promise<CfState> {
  const user = await requireUser();
  // Binding a hostname decides public tenant routing — SUPER_ADMIN only.
  if (!isSuperAdmin(user)) return { error: "Only the group super-admin can bind domains." };

  const domain = String(formData.get("domain") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: "Enter a valid domain." };

  // Globally unique: never bind a hostname another company already owns.
  const owner = await prisma.company.findFirst({
    where: { id: { not: companyId }, customDomains: { has: domain } },
    select: { id: true },
  });
  if (owner) return { error: "That domain is already claimed by another company." };

  const c = await prisma.company.findUnique({ where: { id: companyId } });
  if (!c) return { error: "Company not found." };
  const token = decryptSecret(c.cloudflareApiTokenEnc);
  if (!token || !c.cloudflareZoneId) {
    return { error: "Add your Cloudflare API token + Zone ID in company settings first." };
  }
  const ip = serverIp();
  if (!ip) return { error: "Server IP is not configured (APP_BASE_URL)." };

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${c.cloudflareZoneId}/dns_records`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "A",
          name: domain,
          content: ip,
          ttl: 1,
          proxied: false,
          comment: "event-platform",
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: { code?: number; message?: string }[];
    };
    if (!res.ok || data?.success === false) {
      const err = data?.errors?.[0];
      // 81057 = record already exists — that's fine, just bind it.
      if (err?.code !== 81057) {
        return { error: err?.message ?? `Cloudflare error (${res.status})` };
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error reaching Cloudflare." };
  }

  const domains = Array.from(new Set([...(c.customDomains ?? []), domain]));
  await prisma.company.update({ where: { id: companyId }, data: { customDomains: domains } });
  revalidatePath(`/admin/companies/${companyId}`);
  return { error: "", ok: true };
}
