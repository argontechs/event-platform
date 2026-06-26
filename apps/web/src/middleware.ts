import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "ep_session";

function secret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
  );
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectToLogin(req);
  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

// Protect the back office and planning dashboard.
export const config = {
  matcher: ["/admin/:path*", "/planning/:path*"],
};
