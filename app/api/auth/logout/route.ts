import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 * Clears the CRM web session cookie. Stateless JWT means this cannot
 * revoke a bearer token already handed to Android or captured elsewhere --
 * that's a documented V1 limitation (lib/auth/jwt.ts), not an oversight.
 */
export async function POST() {
  const response = NextResponse.json({ data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
