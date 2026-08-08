import { NextRequest, NextResponse } from "next/server";
import { listAgents, createAgent } from "@/lib/agents/service";
import { createAgentSchema } from "@/lib/auth/validation";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { Prisma } from "@/lib/generated/prisma/client";

/** GET /api/agents -- any authenticated agent can list agents (needed for the "Assigned agent" picker). */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const agents = await listAgents();
  return NextResponse.json({ data: agents });
}

/** POST /api/agents -- admin only. Creating an agent account is an admin action (CRM_ARCHITECTURE.md Phase 3). */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, "ADMIN");
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const agent = await createAgent(parsed.data);
    return NextResponse.json({ data: agent }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An agent with this email already exists." }, { status: 409 });
    }
    throw error;
  }
}
