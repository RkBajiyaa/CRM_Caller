import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getAgentById } from "@/lib/agents/service";

/** GET /api/auth/me -- current-user endpoint, used by the CRM shell to show who's logged in and by clients to confirm a token is still valid. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const agent = await getAgentById(auth.sub);
  if (!agent || !agent.isActive) {
    return NextResponse.json({ error: "Account no longer active." }, { status: 401 });
  }
  return NextResponse.json({ data: agent });
}
