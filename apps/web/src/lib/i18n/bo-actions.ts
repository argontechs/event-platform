"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BO_COOKIE } from "./bo";

export async function setBoLangAction(formData: FormData): Promise<void> {
  const lang = String(formData.get("lang") ?? "en") === "zh" ? "zh" : "en";
  (await cookies()).set(BO_COOKIE, lang, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin");
  revalidatePath("/planning");
}
