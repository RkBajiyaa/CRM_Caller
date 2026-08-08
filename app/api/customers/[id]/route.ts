import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerById, updateCustomer } from "@/lib/customers/service";
import { updateCustomerSchema } from "@/lib/customers/validation";
import { requireAuth } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/customers/{id} */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  return NextResponse.json({ data: customer });
}

/**
 * PATCH /api/customers/{id}
 * Partial profile edit. `id`/`crmEntryCreatedAt` are never editable --
 * excluded from the validation schema entirely, not just ignored.
 */
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

  const parsed = updateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const updated = await updateCustomer(id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}
