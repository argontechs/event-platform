import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@event/db";

export type Role = "SUPER_ADMIN" | "COMPANY_ADMIN" | "SALES" | "PLANNER";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
};

export const SESSION_COOKIE = "ep_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser & { tokenVersion?: number }): Promise<void> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());

  const store = await cookies();
  // Secure cookies require HTTPS. On by default in production, but set
  // COOKIE_SECURE=false when serving over plain http (e.g. IP:port) so the
  // browser will actually store the session cookie.
  const secureCookie =
    process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    // Re-validate against the DB on every request so disabling or deleting a
    // user takes effect immediately — the 7-day token is no longer trusted on
    // its own, and role/company come from the live row, not the stale token.
    const dbUser = await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: { id: true, email: true, name: true, role: true, companyId: true, status: true, tokenVersion: true },
    });
    if (!dbUser || dbUser.status !== "active") return null;
    // Reject tokens minted before the current tokenVersion (password reset /
    // log-out-everywhere). Tokens with no tv claim are treated as version 0.
    if ((Number(payload.tokenVersion) || 0) !== dbUser.tokenVersion) return null;
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role as Role,
      companyId: dbUser.companyId,
    };
  } catch {
    return null;
  }
}
