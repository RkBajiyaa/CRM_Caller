import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import type { CallRequestModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
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

/** Shape returned by the raw create/lookup statements below -- `status` is cast to text because this project's Neon adapter can't deserialize Postgres enums through `$queryRaw`. */
interface CallRequestRow {
  call_request_id: string;
  customer_id: string;
  phone_number: string;
  customer_name: string;
  status: string;
  call_id: string | null;
  requested_at: Date;
  updated_at: Date;
}

function rawToDomain(row: CallRequestRow): CallRequest {
  return {
    id: row.call_request_id,
    customerId: row.customer_id,
    phoneNumber: row.phone_number,
    customerName: row.customer_name,
    status: row.status as CallRequestStatus,
    callId: row.call_id,
    requestedAt: row.requested_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * CRM "Call" button -> POST here. `phoneNumber`/`customerName` are
 * snapshotted from the customer record at request time (so Android has
 * what it needs to dial without a second lookup); `status` is always
 * backend-set to PENDING (CLAUDE.md rule #5's spirit -- never
 * client-chosen). Returns null if `customerId` doesn't match a real
 * customer, so the route can 404 instead of creating an orphaned request.
 *
 * Idempotent while a request is still queued: if this customer already has a
 * PENDING request Android hasn't picked up, that same request is handed back
 * rather than a second one being stacked behind it. Android treats every
 * PENDING row as a separate call to place (its poller de-duplicates by request
 * id, not by customer), so a double-click used to mean the customer got dialed
 * twice -- the live database still holds duplicates from before that check
 * existed.
 *
 * Deliberately only PENDING: an ACCEPTED request that never progressed (the
 * Android app killed mid-dial, say) must not block an agent from trying again,
 * which is exactly the case where re-calling matters most.
 *
 * ---------------------------------------------------------------------------
 * Why this is one statement rather than lookup -> check -> insert
 * ---------------------------------------------------------------------------
 * Two reasons, and both matter:
 *
 * 1. Correctness. The old version read "is there a PENDING request?" and then
 *    inserted, with a full network round trip (~350 ms against Neon from
 *    outside Vercel) in between. Two clicks landing inside that window both saw
 *    "no", and both inserted. Folding the check into the INSERT's own
 *    `WHERE NOT EXISTS` shrinks that window from a round trip to the statement
 *    itself. It is not a uniqueness *guarantee* -- two concurrent statements
 *    can still both pass `NOT EXISTS` under READ COMMITTED before either
 *    commits -- but it turns a wide, routinely-hit race into one that needs
 *    sub-millisecond timing. A partial unique index would close it completely;
 *    Prisma cannot express one in schema.prisma, and hand-writing it into a
 *    migration would leave the schema and the database permanently disagreeing
 *    about an index Prisma can't see, which is a worse trade for a project
 *    whose CLAUDE.md tells every session to run `prisma migrate dev`.
 *
 * 2. Latency, on the one path an agent actually waits for. Selecting the
 *    customer, checking for a PENDING row and inserting was three serialized
 *    round trips behind the Call button. Joining `customers` into the INSERT
 *    makes the happy path a single one; the "already queued" and "no such
 *    customer" paths pay a second statement to tell those two cases apart,
 *    which is the right way round.
 */
export async function createCallRequest(
  input: CreateCallRequestInput
): Promise<{ callRequest: CallRequest; created: boolean } | null> {
  const id = randomUUID();
  const now = new Date();

  const inserted = await prisma.$queryRaw<CallRequestRow[]>`
    INSERT INTO "call_requests" (
      "call_request_id", "customer_id", "phone_number", "customer_name",
      "status", "requested_at", "updated_at"
    )
    SELECT ${id}, c."customer_id", c."phone_number", c."name",
           'PENDING'::"CallRequestStatus", ${now}, ${now}
    FROM "customers" c
    WHERE c."customer_id" = ${input.customerId}
      AND NOT EXISTS (
        SELECT 1 FROM "call_requests" r
        WHERE r."customer_id" = c."customer_id" AND r."status" = 'PENDING'
      )
    RETURNING
      "call_request_id", "customer_id", "phone_number", "customer_name",
      "status"::text AS status, "call_id", "requested_at", "updated_at"
  `;

  if (inserted.length > 0) {
    return { callRequest: rawToDomain(inserted[0]), created: true };
  }

  // Nothing was inserted, which means one of exactly two things: this customer
  // already has a queued request, or there is no such customer. One statement
  // tells them apart -- an empty result is the 404.
  const existing = await prisma.$queryRaw<CallRequestRow[]>`
    SELECT
      "call_request_id", "customer_id", "phone_number", "customer_name",
      "status"::text AS status, "call_id", "requested_at", "updated_at"
    FROM "call_requests"
    WHERE "customer_id" = ${input.customerId} AND "status" = 'PENDING'
    ORDER BY "requested_at" ASC
    LIMIT 1
  `;
  if (existing.length > 0) {
    return { callRequest: rawToDomain(existing[0]), created: false };
  }
  return null;
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

// The customers list's "newest still-open request per customer" lookup used to
// live here as its own query. It is now one of two LATERALs inside
// lib/calls/service.ts's getCustomerCallOverviews -- same data, same page of
// customers, one fewer serialized round trip per list render.

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
