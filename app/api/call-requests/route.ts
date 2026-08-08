import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCallRequest, listCallRequests } from "@/lib/call-requests/service";
import { createCallRequestSchema } from "@/lib/call-requests/validation";
import { requireAuth } from "@/lib/auth/session";
import { CALL_REQUEST_STATUSES, type CallRequestStatus } from "@/lib/call-requests/types";

/**
 * GET /api/call-requests?status=PENDING
 * Android's polling endpoint -- "GET pending request" in the CRM ->
 * Android flow. `status` optional; omit to list all requests.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && (CALL_REQUEST_STATUSES as string[]).includes(statusParam)
      ? (statusParam as CallRequestStatus)
      : undefined;

  const data = await listCallRequests(status);
  return NextResponse.json({ data });
}

/**
 * POST /api/call-requests
 * The CRM's "Call" button. Body: { customerId }. Always creates with
 * status PENDING; phoneNumber/customerName are snapshotted server-side.
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

  const parsed = createCallRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const callRequest = await createCallRequest(parsed.data);
  if (!callRequest) {
    return NextResponse.json({ error: "customerId does not match an existing customer." }, { status: 404 });
  }
  return NextResponse.json({ data: callRequest }, { status: 201 });
}
