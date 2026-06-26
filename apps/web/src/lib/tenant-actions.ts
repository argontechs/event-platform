"use server";

import { revalidatePath } from "next/cache";
import { setActiveCompanyId } from "./tenant";
import { requireSuperAdmin } from "./auth/rbac";

/** Super-admin selects which company they are acting within (the switcher). */
export async function selectCompanyAction(companyId: string): Promise<void> {
  await requireSuperAdmin();
  await setActiveCompanyId(companyId);
  revalidatePath("/admin");
  revalidatePath("/planning");
}
