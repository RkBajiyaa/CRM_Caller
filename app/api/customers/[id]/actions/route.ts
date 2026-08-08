import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerById } from "@/lib/customers/service";
import { listActionsForCustomer, createAction } from "@/lib/actions/service";
import { createActionSchema } from "@/lib/actions/validation";
import { requireAuth } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/customers/{id}/actions -- follow-ups/actions for one customer. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const actions = await listActionsForCustomer(id);
  return NextResponse.json({ data: actions });
}

/** POST /api/customers/{id}/actions -- create a follow-up/action for this customer. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = createActionSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), customerId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const action = await createAction(parsed.data);
  return NextResponse.json({ data: action }, { status: 201 });
}
