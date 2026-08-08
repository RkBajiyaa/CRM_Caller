import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agents/service";
import { signAgentToken } from "@/lib/auth/jwt";
import { loginSchema } from "@/lib/auth/validation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

/**
 * POST /api/auth/login
 * The one issuing endpoint for both client types (CRM_ARCHITECTURE.md #8):
 * - CRM web: gets the token set as an httpOnly cookie (used automatically).
 * - Android / any bearer-token client: reads `data.token` from the JSON
 *   body and sends it as `Authorization: Bearer <token>` on every
 *   subsequent request.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const agent = await authenticateAgent(parsed.data.email, parsed.data.password);
  if (!agent) {
    // Deliberately generic -- does not reveal whether the email exists,
    // the password was wrong, or the account is inactive.
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await signAgentToken({
    agentId: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role,
  });

  const response = NextResponse.json({ data: { token, agent } });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_SECONDS,
  });
  return response;
}
