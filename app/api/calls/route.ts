import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startCall } from "@/lib/calls/service";
import { getCustomerById } from "@/lib/customers/service";
import { startCallSchema } from "@/lib/calls/validation";
import { requireAuth } from "@/lib/auth/session";

/**
 * POST /api/calls -- "start" a call (step 1 of the two-step lifecycle;
 * finish it with PATCH /api/calls/{id}). Used by the Android app when it
 * reports a call (CRM_ARCHITECTURE.md #11). `customerId` is required --
 * never resolved from `phoneNumber` here (CLAUDE.md rule #1); the caller
 * must already know the customer (via GET /api/customers/lookup or its
 * own local mapping) before calling this.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = startCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const customer = await getCustomerById(parsed.data.customerId);
  if (!customer) {
    return NextResponse.json({ error: "customerId does not match an existing customer." }, { status: 404 });
  }

  const call = await startCall(parsed.data);
  return NextResponse.json({ data: call }, { status: 201 });
}
