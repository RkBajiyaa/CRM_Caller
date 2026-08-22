import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startCall } from "@/lib/calls/service";
import { getCustomerById } from "@/lib/customers/service";
import { startCallSchema } from "@/lib/calls/validation";

/**
 * POST /api/calls -- "start" a call (step 1 of the two-step lifecycle; finish
 * it with PATCH /api/calls/{id}). Used by the Android app when it reports a
 * call (CRM_ARCHITECTURE.md #11). `customerId` is required -- never resolved
 * from `phoneNumber` here (CLAUDE.md rule #1); the caller must already know the
 * customer (via GET /api/customers/lookup or its own local mapping) before
 * calling this.
 *
 * **Repeating a report never creates a second call.** When the body carries a
 * `clientCallId`, or a `callRequestId` whose request already names a call, the
 * existing call is returned untouched with **200** instead of a new one with
 * 201 (see lib/calls/service.ts). Both are success responses carrying the same
 * `{ data: <call> }` shape, so a client that only checks for a 2xx -- which
 * every current client does -- needs no change to benefit; the status code is
 * there for clients that want to tell the two apart.
 *
 * Optional new body fields, both additive: `deviceId` (which handset is
 * reporting) and `clientCallId` (the client's own stable key for this call,
 * which is what makes retrying safe -- namespace it per device).
 */
export async function POST(request: NextRequest) {
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

  const result = await startCall(parsed.data);
  if (!result) {
    // Only reachable if the customer disappeared between the check above and
    // the insert, or if `agentId`/`deviceId` points at something that doesn't
    // exist -- a bad reference from the caller either way, which used to
    // surface as a 500. Same status and same message as the check above.
    return NextResponse.json({ error: "customerId does not match an existing customer." }, { status: 404 });
  }
  return NextResponse.json({ data: result.call }, { status: result.created ? 201 : 200 });
}
