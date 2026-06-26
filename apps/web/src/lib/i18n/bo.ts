import { cookies } from "next/headers";

export type BoLang = "en" | "zh";
export const BO_COOKIE = "bo_lang";

/** The back-office UI language chosen by the staff member (cookie). */
export async function getBoLang(): Promise<BoLang> {
  const v = (await cookies()).get(BO_COOKIE)?.value;
  return v === "zh" ? "zh" : "en";
}
