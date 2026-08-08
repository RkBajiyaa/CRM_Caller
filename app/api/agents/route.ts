import { NextRequest, NextResponse } from "next/server";
import { listAgents, createAgent } from "@/lib/agents/service";
import { createAgentSchema } from "@/lib/auth/validation";
import { Prisma } from "@/lib/generated/prisma/client";

/** GET /api/agents -- lists agents (needed for the "Assigned agent" picker). No authentication in this build -- see CHANGELOG.md. */
export async function GET() {
  const agents = await listAgents();
  return NextResponse.json({ data: agents });
}

/** POST /api/agents -- creates an agent account. */
export async function POST(request: NextRequest) {
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
