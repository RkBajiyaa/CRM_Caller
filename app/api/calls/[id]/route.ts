import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCallById, updateCall } from "@/lib/calls/service";
import { updateCallSchema } from "@/lib/calls/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/calls/{id} */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const call = await getCallById(id);
  if (!call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }
  return NextResponse.json({ data: call });
}

/**
 * PATCH /api/calls/{id} -- "finish" a call (set status/endedAt/
 * durationSeconds), or amend agentId. This is what the Android app calls
 * once it knows the outcome of a call it started via POST /api/calls.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const call = await updateCall(id, parsed.data);
  if (!call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }
  return NextResponse.json({ data: call });
}
