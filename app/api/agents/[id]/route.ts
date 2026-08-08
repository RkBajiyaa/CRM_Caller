import { NextRequest, NextResponse } from "next/server";
import { updateAgent } from "@/lib/agents/service";
import { updateAgentSchema } from "@/lib/auth/validation";
import { requireAuth, requireRole } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/agents/{id} -- admin only. Role/active-state changes are an admin action. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, "ADMIN");
  if (forbidden) return forbidden;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const agent = await updateAgent(id, parsed.data);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json({ data: agent });
}
