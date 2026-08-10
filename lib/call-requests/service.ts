import { Prisma } from "@/lib/generated/prisma/client";
import type { CallRequestModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import { getCustomerById } from "@/lib/customers/service";
import type {
  CallRequest,
  CreateCallRequestInput,
  UpdateCallRequestInput,
  CallRequestStatus,
} from "@/lib/call-requests/types";

function toDomain(row: CallRequestModel): CallRequest {
  return {
    id: row.id,
    customerId: row.customerId,
    phoneNumber: row.phoneNumber,
    customerName: row.customerName,
    status: row.status,
    callId: row.callId,
    requestedAt: row.requestedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CRM "Call" button -> POST here. `phoneNumber`/`customerName` are
 * snapshotted from the customer record at request time (so Android has
 * what it needs to dial without a second lookup); `status` is always
 * backend-set to PENDING (CLAUDE.md rule #5's spirit -- never
 * client-chosen). Returns null if `customerId` doesn't match a real
 * customer, so the route can 404 instead of creating an orphaned request.
 */
export async function createCallRequest(
  input: CreateCallRequestInput
): Promise<{ callRequest: CallRequest; created: boolean } | null> {
  const customer = await getCustomerById(input.customerId);
  if (!customer) return null;

  // If a request for this customer is still sitting in the queue unclaimed,
  // hand that one back instead of stacking another onto it. Android treats
  // every PENDING row as a separate call to place (its poller de-duplicates
  // by request id, not by customer), so a double-click -- or one click per
  // page load, since the button's "Requested" state doesn't survive a
  // refresh -- used to mean the same customer got dialed twice. The live
  // database still shows several such duplicates.
  //
  // Deliberately only PENDING: an ACCEPTED request that never progressed
  // (e.g. the Android app was killed mid-dial) must not block the agent from
  // trying again, which is exactly the case where re-calling matters most.
  const existingPending = await prisma.callRequest.findFirst({
    where: { customerId: customer.id, status: "PENDING" },
    orderBy: { requestedAt: "asc" },
  });
  if (existingPending) {
    return { callRequest: toDomain(existingPending), created: false };
  }

  const row = await prisma.callRequest.create({
    data: {
      customerId: customer.id,
      phoneNumber: customer.phoneNumber,
      customerName: customer.name,
      status: "PENDING",
    },
  });
  return { callRequest: toDomain(row), created: true };
}

export const CALL_REQUESTS_DEFAULT_LIMIT = 200;
export const CALL_REQUESTS_MAX_LIMIT = 500;

/**
 * GET /api/call-requests?status=PENDING -- Android's polling endpoint. Omit
 * `status` to list all. Oldest-first so Android processes requests in the
 * order they were made.
 *
 * Bounded: this table only grows (one row per Call button press, kept
 * forever), and unfiltered this returned every row ever created on a
 * four-second poll. The cap is oldest-first, so the requests Android should
 * act on first are exactly the ones it always sees -- a PENDING queue deep
 * enough to be truncated is already far deeper than a phone that dials one
 * call at a time can work through.
 */
export async function listCallRequests(
  status?: CallRequestStatus,
  limit: number = CALL_REQUESTS_DEFAULT_LIMIT
): Promise<CallRequest[]> {
  const rows = await prisma.callRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "asc" },
    take: Math.min(CALL_REQUESTS_MAX_LIMIT, Math.max(1, limit)),
  });
  return rows.map(toDomain);
}

export async function getCallRequestById(id: string): Promise<CallRequest | null> {
  const row = await prisma.callRequest.findUnique({ where: { id } });
  return row ? toDomain(row) : null;
}

/** Requests still waiting on Android -- created but not yet turned into a call, failed, or cancelled. */
const OPEN_STATUSES: CallRequestStatus[] = ["PENDING", "ACCEPTED"];

/**
 * The newest still-open request per customer, for a whole page of customers
 * in one query -- what lets the customers list show "Queued"/"Dialing" on the
 * Call button without a query per row.
 *
 * Only PENDING/ACCEPTED are fetched on purpose: once a request reaches any
 * other status the `Call` row is the thing worth showing, and it's already on
 * the row (see lib/calls/service.ts's getCallSummariesForCustomers).
 */
export async function getOpenCallRequestsForCustomers(
  customerIds: string[]
): Promise<Map<string, CallRequest>> {
  const byCustomer = new Map<string, CallRequest>();
  if (customerIds.length === 0) return byCustomer;

  const rows = await prisma.callRequest.findMany({
    where: { customerId: { in: customerIds }, status: { in: OPEN_STATUSES } },
    orderBy: { requestedAt: "desc" },
  });
  // Newest first, so the first one seen per customer is the one to show.
  for (const row of rows) {
    if (!byCustomer.has(row.customerId)) byCustomer.set(row.customerId, toDomain(row));
  }
  return byCustomer;
}

/** Most recent call requests for one customer, newest first -- the Customer Detail page's request history. */
export async function listCallRequestsForCustomer(customerId: string, limit = 5): Promise<CallRequest[]> {
  const rows = await prisma.callRequest.findMany({
    where: { customerId },
    orderBy: { requestedAt: "desc" },
    take: limit,
  });
  return rows.map(toDomain);
}

/** PATCH /api/call-requests/{id} -- Android accepting ("status": "ACCEPTED") or finishing ("status": "COMPLETED"/"FAILED"/"CANCELLED", optionally with "callId" once the real Call exists). Returns null if the request doesn't exist. */
export async function updateCallRequest(id: string, patch: UpdateCallRequestInput): Promise<CallRequest | null> {
  try {
    const row = await prisma.callRequest.update({
      where: { id },
      data: {
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.callId !== undefined && { callId: patch.callId }),
      },
    });
    return toDomain(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
