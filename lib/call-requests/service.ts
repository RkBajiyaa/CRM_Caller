import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  CallRequest,
  CallRequestWithTarget,
  CreateCallRequestInput,
  UpdateCallRequestInput,
  CallRequestStatus,
} from "@/lib/call-requests/types";

/** Shape returned by the raw statements below -- `status` is cast to text because this project's Neon adapter can't deserialize Postgres enums through `$queryRaw`. */
interface CallRequestRow {
  call_request_id: string;
  customer_id: string;
  phone_number: string;
  customer_name: string;
  status: string;
  agent_id: string | null;
  device_id: string | null;
  call_id: string | null;
  requested_at: Date;
  updated_at: Date;
}

interface CallRequestTargetRow extends CallRequestRow {
  agent_name: string | null;
  device_label: string | null;
}

const CALL_REQUEST_COLUMNS = Prisma.sql`
  "call_request_id", "customer_id", "phone_number", "customer_name",
  "status"::text AS status, "agent_id", "device_id", "call_id",
  "requested_at", "updated_at"
`;

function rawToDomain(row: CallRequestRow): CallRequest {
  return {
    id: row.call_request_id,
    customerId: row.customer_id,
    phoneNumber: row.phone_number,
    customerName: row.customer_name,
    status: row.status as CallRequestStatus,
    agentId: row.agent_id,
    deviceId: row.device_id,
    callId: row.call_id,
    requestedAt: row.requested_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rawToTargetDomain(row: CallRequestTargetRow): CallRequestWithTarget {
  return { ...rawToDomain(row), agentName: row.agent_name, deviceLabel: row.device_label };
}

/**
 * CRM "Call" button -> POST here. `phoneNumber`/`customerName` are
 * snapshotted from the customer record at request time (so Android has what it
 * needs to dial without a second lookup); `status` is always backend-set to
 * PENDING (CLAUDE.md rule #5's spirit -- never client-chosen). Returns null if
 * `customerId` doesn't match a real customer, so the route can 404 instead of
 * creating an orphaned request.
 *
 * ---------------------------------------------------------------------------
 * Routing -- which phone is this request for
 * ---------------------------------------------------------------------------
 * Resolved server-side, in this order:
 *
 *   1. An explicit `deviceId` / `agentId` in the request body, if given.
 *   2. Otherwise the customer's assigned agent (`customers.assigned_agent_id`)
 *      and that agent's most-recently-seen active device.
 *   3. Otherwise nothing -- the request stays *unrouted* and every polling
 *      device is offered it.
 *
 * Rule 2 is what makes routing work with no change at the call site and no
 * notion of "the logged-in agent" -- there is no authentication in this build
 * (CLAUDE.md §3.12), so the customer's own assignment is the only honest
 * answer to "whose call is this". Rule 3 matters just as much: leaving a
 * request unrouted is precisely the behaviour every request had before this
 * column existed, so an unassigned customer still gets called instead of
 * having its request aimed at a phone that doesn't exist.
 *
 * The resolution is folded into the INSERT's own SELECT rather than done as
 * two prior lookups, for the same reason the customer lookup already was: this
 * project's Neon adapter serializes statements (~350 ms each from outside
 * Vercel), and this is the one path an agent stands and waits for.
 *
 * ---------------------------------------------------------------------------
 * Idempotency while a request is still queued
 * ---------------------------------------------------------------------------
 * Unchanged by this pass. If this customer already has a PENDING request
 * Android hasn't picked up, that same request is handed back rather than a
 * second one being stacked behind it -- Android treats every PENDING row as a
 * separate call to place, so a double-click used to mean the customer got
 * dialed twice. Folding the check into the INSERT's own `WHERE NOT EXISTS`
 * shrinks the race window from a full round trip to the statement itself; it
 * is not a uniqueness *guarantee* (two concurrent statements can both pass
 * `NOT EXISTS` under READ COMMITTED), but it turns a routinely-hit race into
 * one needing sub-millisecond timing. A partial unique index would close it
 * completely; Prisma cannot express one in schema.prisma, and hand-writing it
 * into a migration would leave schema and database permanently disagreeing
 * about an index Prisma can't see.
 *
 * Deliberately only PENDING: an ACCEPTED request that never progressed (the
 * Android app killed mid-dial, say) must not block an agent from trying again,
 * which is exactly the case where re-calling matters most.
 */
export async function createCallRequest(
  input: CreateCallRequestInput
): Promise<{ callRequest: CallRequest; created: boolean } | null> {
  const id = randomUUID();
  const now = new Date();
  const agentOverride = input.agentId ?? null;
  const deviceOverride = input.deviceId ?? null;

  let inserted: CallRequestRow[];
  try {
    inserted = await prisma.$queryRaw<CallRequestRow[]>`
      INSERT INTO "call_requests" (
        "call_request_id", "customer_id", "phone_number", "customer_name",
        "agent_id", "device_id", "status", "requested_at", "updated_at"
      )
      SELECT ${id}, c."customer_id", c."phone_number", c."name",
             COALESCE(${agentOverride}::text, c."assigned_agent_id"),
             COALESCE(${deviceOverride}::text, dev."device_id"),
             'PENDING'::"CallRequestStatus", ${now}, ${now}
      FROM "customers" c
      LEFT JOIN LATERAL (
        SELECT d."device_id"
        FROM "devices" d
        WHERE d."agent_id" = COALESCE(${agentOverride}::text, c."assigned_agent_id")
          AND d."is_active" = TRUE
        ORDER BY d."last_seen_at" DESC NULLS LAST, d."created_at" ASC
        LIMIT 1
      ) dev ON TRUE
      WHERE c."customer_id" = ${input.customerId}
        AND NOT EXISTS (
          SELECT 1 FROM "call_requests" r
          WHERE r."customer_id" = c."customer_id" AND r."status" = 'PENDING'
        )
      RETURNING ${CALL_REQUEST_COLUMNS}
    `;
  } catch (error) {
    // P2003 = foreign key violation: an explicit `agentId`/`deviceId` that
    // doesn't name a real row. A bad reference from the caller, so the route
    // 404s rather than 500s -- and nothing was written.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return null;
    }
    throw error;
  }

  if (inserted.length > 0) {
    return { callRequest: rawToDomain(inserted[0]), created: true };
  }

  // Nothing was inserted, which means one of exactly two things: this customer
  // already has a queued request, or there is no such customer. One statement
  // tells them apart -- an empty result is the 404.
  const existing = await prisma.$queryRaw<CallRequestRow[]>`
    SELECT ${CALL_REQUEST_COLUMNS}
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

/**
 * How stale a device's `last_seen_at` must be before a poll bothers to rewrite
 * it. Conbun Call polls every 4 seconds, so writing on every poll would be
 * ~15 row updates a minute per phone to record something only ever read at
 * minute granularity (see DEVICE_ONLINE_WINDOW_MS). At one minute the write is
 * a no-op on ~93% of polls and the reading is never more than a minute behind.
 */
const DEVICE_HEARTBEAT_THROTTLE_MS = 60_000;

export const CALL_REQUESTS_DEFAULT_LIMIT = 200;
export const CALL_REQUESTS_MAX_LIMIT = 500;

/**
 * GET /api/call-requests -- Android's polling endpoint. Omit `status` to list
 * all. Oldest-first so Android processes requests in the order they were made.
 *
 * ---------------------------------------------------------------------------
 * `deviceId` -- the routing filter
 * ---------------------------------------------------------------------------
 * When a device polls with its own id, it is offered:
 *
 *   - every request routed **to it**, and
 *   - every **unrouted** request (`device_id IS NULL`).
 *
 * and never a request routed to a different device. That is the guarantee the
 * sprint asks for: a request intended for Device A is not visible to Device B.
 * Unrouted requests are included deliberately -- they are intended for nobody
 * in particular, and excluding them would strand every request the CRM cannot
 * route (an unassigned customer, an agent with no registered handset) in the
 * queue forever, which would be a worse failure than the one this fixes.
 *
 * Omitting `deviceId` returns the whole queue, exactly as before, so an
 * existing client that has not been taught the parameter is unaffected.
 *
 * ---------------------------------------------------------------------------
 * The heartbeat
 * ---------------------------------------------------------------------------
 * A poll that names a device also registers it (if the CRM has never seen it)
 * and refreshes `last_seen_at`, which is what lets the CRM tell "that phone is
 * offline, this will sync later" apart from "this failed" (sprint item 12).
 *
 * Both happen inside the *same statement* as the query, as a data-modifying
 * CTE -- Postgres always runs those to completion whether or not the main
 * query reads them. That matters: this runs every four seconds per device, and
 * this project's Neon adapter serializes statements, so a separate write would
 * literally double the poll's latency. The `ON CONFLICT ... WHERE` clause
 * makes the write a no-op unless the device has been quiet for a minute, so
 * the steady-state cost is an index probe, not a row update.
 *
 * ---------------------------------------------------------------------------
 * The bound
 * ---------------------------------------------------------------------------
 * This table only grows (one row per Call button press, kept forever), and
 * unfiltered it returned every row ever created on a four-second poll. The cap
 * is oldest-first, so the requests Android should act on first are exactly the
 * ones it always sees.
 */
export async function listCallRequests(
  status?: CallRequestStatus,
  limit: number = CALL_REQUESTS_DEFAULT_LIMIT,
  deviceId?: string
): Promise<CallRequest[]> {
  const take = Math.min(CALL_REQUESTS_MAX_LIMIT, Math.max(1, limit));

  if (!deviceId) {
    const rows = await prisma.$queryRaw<CallRequestRow[]>`
      SELECT ${CALL_REQUEST_COLUMNS}
      FROM "call_requests"
      WHERE ${status ? Prisma.sql`"status" = ${status}::"CallRequestStatus"` : Prisma.sql`TRUE`}
      ORDER BY "requested_at" ASC
      LIMIT ${take}
    `;
    return rows.map(rawToDomain);
  }

  const now = new Date();
  // The heartbeat threshold is computed here rather than as `${now} - INTERVAL
  // '60 seconds'` in SQL: an untyped bind parameter next to an interval gets
  // resolved *as* an interval by Postgres, which turns the comparison into
  // `timestamp < interval` and fails outright. A second timestamp parameter
  // sidesteps the inference question entirely.
  const staleBefore = new Date(now.getTime() - DEVICE_HEARTBEAT_THROTTLE_MS);
  const rows = await prisma.$queryRaw<CallRequestRow[]>`
    WITH seen AS (
      INSERT INTO "devices" ("device_id", "last_seen_at", "created_at", "updated_at")
      VALUES (${deviceId}, ${now}::timestamp(3), ${now}::timestamp(3), ${now}::timestamp(3))
      ON CONFLICT ("device_id") DO UPDATE
        SET "last_seen_at" = ${now}::timestamp(3), "updated_at" = ${now}::timestamp(3)
        WHERE "devices"."last_seen_at" IS NULL
           OR "devices"."last_seen_at" < ${staleBefore}::timestamp(3)
      RETURNING 1
    )
    SELECT ${CALL_REQUEST_COLUMNS}
    FROM "call_requests"
    WHERE ${status ? Prisma.sql`"status" = ${status}::"CallRequestStatus"` : Prisma.sql`TRUE`}
      AND ("device_id" = ${deviceId} OR "device_id" IS NULL)
    ORDER BY "requested_at" ASC
    LIMIT ${take}
  `;
  return rows.map(rawToDomain);
}

export async function getCallRequestById(id: string): Promise<CallRequest | null> {
  const rows = await prisma.$queryRaw<CallRequestRow[]>`
    SELECT ${CALL_REQUEST_COLUMNS} FROM "call_requests" WHERE "call_request_id" = ${id}
  `;
  return rows.length > 0 ? rawToDomain(rows[0]) : null;
}

// The customers list's "newest still-open request per customer" lookup used to
// live here as its own query. It is now one of two LATERALs inside
// lib/calls/service.ts's getCustomerCallOverviews -- same data, same page of
// customers, one fewer serialized round trip per list render.

/**
 * Most recent call requests for one customer, newest first -- the Customer
 * Detail page's request history. Joins the agent and device names in the same
 * statement, so showing *who* a request was routed to costs no extra round
 * trip.
 */
export async function listCallRequestsForCustomer(
  customerId: string,
  limit = 5
): Promise<CallRequestWithTarget[]> {
  const rows = await prisma.$queryRaw<CallRequestTargetRow[]>`
    SELECT
      r."call_request_id", r."customer_id", r."phone_number", r."customer_name",
      r."status"::text AS status, r."agent_id", r."device_id", r."call_id",
      r."requested_at", r."updated_at",
      ag."name" AS agent_name,
      dev."label" AS device_label
    FROM "call_requests" r
    LEFT JOIN "agents"  ag  ON ag."agent_id"   = r."agent_id"
    LEFT JOIN "devices" dev ON dev."device_id" = r."device_id"
    WHERE r."customer_id" = ${customerId}
    ORDER BY r."requested_at" DESC
    LIMIT ${limit}
  `;
  return rows.map(rawToTargetDomain);
}

/**
 * PATCH /api/call-requests/{id} -- Android accepting (`{"status":"ACCEPTED"}`)
 * or finishing (`{"status":"COMPLETED"|"FAILED"|"CANCELLED"}`, optionally with
 * `callId` once the real Call exists). Returns null if the request doesn't
 * exist.
 *
 * An optional `deviceId` lets the accepting device record that it was the one
 * that took the request -- but only for a request that wasn't already aimed
 * somewhere: `COALESCE("device_id", $new)` means a request routed to Device A
 * keeps saying Device A even if some other device PATCHes it, so the audit
 * trail can never be rewritten by a misbehaving or mis-configured client.
 * Claiming an unrouted request, which is the case this is for, works normally.
 * An unknown device id is registered on the spot for the same reason unknown
 * devices are registered everywhere else in this API -- losing the record of
 * which phone handled a call is worse than having a device row nobody named
 * yet.
 */
export async function updateCallRequest(
  id: string,
  patch: UpdateCallRequestInput
): Promise<CallRequest | null> {
  if (patch.deviceId) {
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO "devices" ("device_id", "last_seen_at", "created_at", "updated_at")
      VALUES (${patch.deviceId}, ${now}::timestamp(3), ${now}::timestamp(3), ${now}::timestamp(3))
      ON CONFLICT ("device_id") DO UPDATE
        SET "last_seen_at" = ${now}::timestamp(3), "updated_at" = ${now}::timestamp(3)
    `;
  }

  const rows = await prisma.$queryRaw<CallRequestRow[]>`
    UPDATE "call_requests" SET
      "status"     = COALESCE(${patch.status ?? null}::"CallRequestStatus", "status"),
      "device_id"  = ${
        patch.deviceId
          ? Prisma.sql`COALESCE("device_id", ${patch.deviceId})`
          : Prisma.sql`"device_id"`
      },
      "call_id"    = ${
        patch.callId !== undefined ? Prisma.sql`${patch.callId}` : Prisma.sql`"call_id"`
      },
      "updated_at" = ${new Date()}
    WHERE "call_request_id" = ${id}
    RETURNING ${CALL_REQUEST_COLUMNS}
  `;
  return rows.length > 0 ? rawToDomain(rows[0]) : null;
}
