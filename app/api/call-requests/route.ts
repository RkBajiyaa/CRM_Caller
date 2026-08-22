import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCallRequest, listCallRequests } from "@/lib/call-requests/service";
import { createCallRequestSchema } from "@/lib/call-requests/validation";
import { deviceIdSchema } from "@/lib/devices/validation";
import { CALL_REQUEST_STATUSES, type CallRequestStatus } from "@/lib/call-requests/types";

/**
 * GET /api/call-requests?status=PENDING&deviceId=CONBUN-1A2B3C4D&limit=
 *
 * Android's polling endpoint -- "GET pending request" in the CRM -> Android
 * flow. `status` optional; omit to list all requests. Oldest first.
 *
 * `deviceId` is optional and additive, and it is what makes the queue safe to
 * share between several phones: a device that names itself is offered the
 * requests routed to it plus the unrouted ones, and **never** a request routed
 * to a different device. Omitting it returns the whole queue exactly as
 * before, so a client that predates the parameter is unaffected -- but with
 * more than one phone in the field, every phone should send it.
 *
 * Naming a device here also registers it on first contact and refreshes its
 * `lastSeenAt`, at no extra round trip (see lib/call-requests/service.ts). An
 * unrecognised `deviceId` is therefore not an error: it is a new phone, and
 * the CRM records it rather than turning it away.
 *
 * `limit` is optional (default 200, max 500); existing callers that don't send
 * it are unaffected in every realistic case.
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

  // A malformed device id is rejected rather than silently ignored: silently
  // dropping the filter would hand this phone the whole queue, including
  // requests meant for other phones, which is the one outcome this parameter
  // exists to prevent.
  const deviceParam = params.get("deviceId");
  let deviceId: string | undefined;
  if (deviceParam !== null) {
    const parsed = deviceIdSchema.safeParse(deviceParam);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: z.treeifyError(parsed.error) },
        { status: 400 }
      );
    }
    deviceId = parsed.data;
  }

  const data = await listCallRequests(status, limit, deviceId);
  return NextResponse.json({ data });
}

/**
 * POST /api/call-requests
 * The CRM's "Call" button. Body: `{ customerId, agentId?, deviceId? }`.
 * Always creates with status PENDING; phoneNumber/customerName are
 * snapshotted server-side.
 *
 * `agentId`/`deviceId` are optional routing overrides. Omit them and the CRM
 * resolves the target from the customer's assigned agent and that agent's
 * active device -- so `{ customerId }` alone, which is what the CRM UI sends,
 * now produces a routed request wherever the customer has an assigned agent
 * with a registered phone, and an unrouted one (offered to every device, i.e.
 * the old behaviour) where it doesn't.
 *
 * Idempotent while a request is still queued: if this customer already has a
 * PENDING request that Android hasn't picked up, that same request is returned
 * (200 instead of 201) rather than a duplicate being queued.
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
    return NextResponse.json(
      { error: "customerId does not match an existing customer, or agentId/deviceId does not exist." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: result.callRequest }, { status: result.created ? 201 : 200 });
}
