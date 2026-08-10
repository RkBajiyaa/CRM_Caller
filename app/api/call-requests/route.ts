import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCallRequest, listCallRequests } from "@/lib/call-requests/service";
import { createCallRequestSchema } from "@/lib/call-requests/validation";
import { CALL_REQUEST_STATUSES, type CallRequestStatus } from "@/lib/call-requests/types";

/**
 * GET /api/call-requests?status=PENDING&limit=
 * Android's polling endpoint -- "GET pending request" in the CRM ->
 * Android flow. `status` optional; omit to list all requests. Oldest first.
 *
 * `limit` is optional and new (default 200, max 500) -- existing callers that
 * don't send it are unaffected in every realistic case; see
 * lib/call-requests/service.ts for why the response is bounded at all.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status");
  const status =
    statusParam && (CALL_REQUEST_STATUSES as string[]).includes(statusParam)
      ? (statusParam as CallRequestStatus)
      : undefined;

  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  const data = await listCallRequests(status, limit);
  return NextResponse.json({ data });
}

/**
 * POST /api/call-requests
 * The CRM's "Call" button. Body: { customerId }. Always creates with
 * status PENDING; phoneNumber/customerName are snapshotted server-side.
 *
 * Idempotent while a request is still queued: if this customer already has a
 * PENDING request that Android hasn't picked up, that same request is
 * returned (200 instead of 201) rather than a duplicate being queued -- see
 * lib/call-requests/service.ts. The response body's shape is unchanged, and
 * no Android-facing endpoint is affected (Android never POSTs here).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = createCallRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const result = await createCallRequest(parsed.data);
  if (!result) {
    return NextResponse.json({ error: "customerId does not match an existing customer." }, { status: 404 });
  }
  return NextResponse.json({ data: result.callRequest }, { status: result.created ? 201 : 200 });
}
