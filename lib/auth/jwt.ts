import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * HS256 JWT signing/verification, backend-issued, shared by the CRM web
 * app and (eventually) the Android app (CRM_ARCHITECTURE.md #8 -- one
 * issuing/verification path for both client types).
 *
 * Uses `jose` instead of `jsonwebtoken` specifically because `jose` runs on
 * the Web Crypto API and works in both the Node.js runtime (API routes)
 * and the Edge runtime (middleware.ts) with the same code -- `jsonwebtoken`
 * needs Node's `crypto` module, which isn't available in Edge middleware.
 *
 * Stateless: no server-side session/revocation table in V1. Logout just
 * clears the client's copy of the token; a captured token remains valid
 * until it expires. Acceptable for V1 given the token's TTL; revisit if a
 * blocklist is ever needed.
 */

const TOKEN_TTL = "7d";

export interface AgentTokenClaims extends JWTPayload {
  sub: string; // agent id
  email: string;
  name: string;
  role: "ADMIN" | "AGENT";
}

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Deliberately thrown, not silently defaulted -- a missing signing
    // secret must never fall back to a guessable value.
    throw new Error("JWT_SECRET is not set. See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function signAgentToken(claims: Omit<AgentTokenClaims, "sub"> & { agentId: string }): Promise<string> {
  const { agentId, ...rest } = claims;
  return new SignJWT({ ...rest })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(agentId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyAgentToken(token: string): Promise<AgentTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return payload as AgentTokenClaims;
  } catch {
    // Expired, malformed, or invalid signature -- all treated the same:
    // not authenticated. Never leak which one to the caller.
    return null;
  }
}
