import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCallRequestById, updateCallRequest } from "@/lib/call-requests/service";
import { updateCallRequestSchema } from "@/lib/call-requests/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/call-requests/{id} */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const callRequest = await getCallRequestById(id);
  if (!callRequest) {
    return NextResponse.json({ error: "Call request not found." }, { status: 404 });
  }
  return NextResponse.json({ data: callRequest });
}

/**
 * PATCH /api/call-requests/{id}
 * Android "accept request" (`{"status": "ACCEPTED"}`) and "update request
 * status" (`{"status": "COMPLETED" | "FAILED" | "CANCELLED"}`, optionally
 * with `callId` once the real Call has been reported) both go through
 * here -- same endpoint, different status values.
 *
 * An optional `deviceId` may be sent alongside, and is how a device records
 * that it was the one that took an *unrouted* request. It never re-points a
 * request that was already routed to another device (see
 * lib/call-requests/service.ts), so it cannot be used to rewrite the record of
 * which phone handled a call.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateCallRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const callRequest = await updateCallRequest(id, parsed.data);
  if (!callRequest) {
    return NextResponse.json({ error: "Call request not found." }, { status: 404 });
  }
  return NextResponse.json({ data: callRequest });
}
