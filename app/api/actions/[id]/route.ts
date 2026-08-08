import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateAction } from "@/lib/actions/service";
import { updateActionSchema } from "@/lib/actions/validation";
import { requireAuth } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/actions/{id} -- change status ("Completed", "In progress", ...), reassign, edit notes/due date. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const action = await updateAction(id, parsed.data);
  if (!action) {
    return NextResponse.json({ error: "Action not found." }, { status: 404 });
  }
  return NextResponse.json({ data: action });
}
