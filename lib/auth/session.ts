import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, type AgentTokenClaims } from "@/lib/auth/jwt";

/** Shared between the login route (sets it) and everything that reads it (API routes, middleware). */
export const SESSION_COOKIE_NAME = "crm_session";

/**
 * Extracts the bearer token from either source a client might use:
 * - CRM web: httpOnly cookie, sent automatically by the browser.
 * - Android (and any non-browser API client): `Authorization: Bearer <token>`.
 * Same precedent as ConbunCall_V4's own `data/crm/CrmApiClient`, which
 * already sends requests this way.
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return cookieToken ?? null;
}

/** Returns the verified claims, or null if unauthenticated -- never throws. */
export async function getSessionClaims(request: NextRequest): Promise<AgentTokenClaims | null> {
  const token = extractToken(request);
  if (!token) return null;
  return verifyAgentToken(token);
}

/**
 * Use at the top of any protected API route:
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth is now AgentTokenClaims
 */
export async function requireAuth(request: NextRequest): Promise<AgentTokenClaims | NextResponse> {
  const claims = await getSessionClaims(request);
  if (!claims) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  return claims;
}

/**
 * Use after requireAuth for admin-only endpoints:
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const forbidden = requireRole(auth, "ADMIN");
 *   if (forbidden) return forbidden;
 */
export function requireRole(claims: AgentTokenClaims, role: "ADMIN" | "AGENT"): NextResponse | null {
  if (claims.role !== role) {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 });
  }
  return null;
}
