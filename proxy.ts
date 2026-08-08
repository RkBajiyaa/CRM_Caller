import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Protects every CRM page (not API routes -- each API route calls
 * requireAuth() itself, see lib/auth/session.ts) by requiring a valid
 * session cookie. Runs on the Edge runtime, which is why lib/auth/jwt.ts
 * uses `jose` instead of `jsonwebtoken` -- this file needs to verify the
 * JWT without Node's `crypto` module.
 *
 * Named `proxy` (not `middleware`) per Next.js 16's renamed file
 * convention -- this file used to be middleware.ts; functionally
 * identical, just the current name Next.js expects.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const claims = token ? await verifyAgentToken(token) : null;

  if (!claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except /login itself, /api/* (self-protected), static
  // assets, and Next.js internals.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
