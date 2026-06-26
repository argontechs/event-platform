"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@event/db";
import { verifyPassword, dummyVerify } from "./password";
import { createSession, destroySession } from "./session";
import { isRateLimited, recordFailure, clearAttempts } from "../rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// 10 failed logins per (ip, email) in 15 min → locked out for 15 min.
const LOGIN_LIMIT = { max: 10, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 };

export type LoginState = { error: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const email = parsed.data.email.toLowerCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rlKey = `login:${ip}:${email}`;
  // Per-email lock too: X-Forwarded-For is client-controllable, so an attacker
  // could rotate it to dodge the per-IP lock; the per-email lock can't be spoofed
  // away for a targeted account.
  const emailKey = `login-email:${email}`;
  if (isRateLimited(rlKey, LOGIN_LIMIT).limited || isRateLimited(emailKey, LOGIN_LIMIT).limited) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const fail = () => {
    recordFailure(rlKey, LOGIN_LIMIT);
    recordFailure(emailKey, LOGIN_LIMIT);
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") {
    await dummyVerify(parsed.data.password); // constant-work: no timing oracle
    fail();
    return { error: "Invalid email or password." };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    fail();
    return { error: "Invalid email or password." };
  }
  clearAttempts(rlKey);
  clearAttempts(emailKey);

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    tokenVersion: user.tokenVersion,
  });

  // Honour a safe relative ?next= target (e.g. a deep link that bounced to login).
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (safeNext && user.role !== "PLANNER") redirect(safeNext);
  redirect(user.role === "PLANNER" ? "/planning" : "/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
