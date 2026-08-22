import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  Call,
  CallDirection,
  CallStatus,
  StartCallInput,
  UpdateCallInput,
  CustomerCallStats,
  CustomerCallSummary,
  CustomerCallOverview,
} from "@/lib/calls/types";
import type { CallPulse, RequestPulse } from "@/lib/calls/pulse";
import type { CallRequestStatus } from "@/lib/call-requests/types";

/**
 * How many calls a single "call history" read returns. Bounded on purpose:
 * this used to be every call a customer had ever had, transcripts included,
 * on every page render. Aggregate stats are still computed over *all* calls
 * (see getCustomerCallOverview), so bounding the list changes what is
 * displayed, never what is counted.
 */
export const CALL_HISTORY_PAGE_SIZE = 25;
const CALL_HISTORY_MAX_LIMIT = 200;

/**
 * ---------------------------------------------------------------------------
 * Why this file hand-writes SQL instead of using Prisma's `include`
 * ---------------------------------------------------------------------------
 * Prisma does not join `include`d relations -- it issues one additional SQL
 * statement per relation and stitches the results together in the client. With
 * the five relations a call needs (agent, recording, transcript, AI summary,
 * call request) that is six sequential round trips for one logical read, and
 * this project's Neon adapter serializes queries (measured, and the reason
 * CHANGELOG.md's 2026-08-10 entry warns against `Promise.all` here). Measured
 * against the real database before this change:
 *
 *     call.findMany (no include)     386 ms   1 SQL
 *     call.findMany (5 includes)    2766 ms   6 SQL      <-- the whole cost
 *
 * So the fix is not parallelism and not caching, it is emitting one statement.
 * `LEFT JOIN` is exactly the right tool: every relation here is to-one
 * (recording/transcript/aiSummary/callRequest are all `@unique` on `call_id`;
 * agent is a plain FK), so a join can never duplicate a call row.
 *
 * Every enum column is cast to `text` because this project's Neon adapter
 * cannot deserialize Postgres enum columns through `$queryRaw` -- the same
 * constraint getCustomerCallOverviews below already worked around.
 */
const CALL_COLUMNS = Prisma.sql`
  c."call_id"           AS id,
  c."customer_id"       AS customer_id,
  cus."name"            AS customer_name,
  c."agent_id"          AS agent_id,
  ag."name"             AS agent_name,
  c."device_id"         AS device_id,
  dev."label"           AS device_label,
  c."client_call_id"    AS client_call_id,
  c."phone_number"      AS phone_number,
  c."direction"::text   AS direction,
  c."status"::text      AS status,
  c."started_at"        AS started_at,
  c."answered_at"       AS answered_at,
  c."ended_at"          AS ended_at,
  c."duration_seconds"  AS duration_seconds,
  c."failure_reason"    AS failure_reason,
  c."created_at"        AS created_at,
  c."updated_at"        AS updated_at,
  rec."recording_id"                AS recording_id,
  rec."duration_seconds"            AS recording_duration_seconds,
  rec."processing_status"::text     AS recording_status,
  rec."storage_key"                 AS recording_storage_key,
  rec."mime_type"                   AS recording_mime_type,
  rec."size_bytes"                  AS recording_size_bytes,
  tr."processing_status"::text      AS transcript_status,
  tr."text"                         AS transcript_text,
  tr."language"                     AS transcript_language,
  su."processing_status"::text      AS ai_summary_status,
  su."summary_text"                 AS ai_summary_text,
  su."key_points"                   AS ai_summary_key_points,
  su."customer_intent"              AS ai_summary_customer_intent,
  su."sentiment"                    AS ai_summary_sentiment,
  su."recommended_action"           AS ai_summary_recommended_action,
  su."follow_up_required"           AS ai_summary_follow_up_required,
  su."generated_at"                 AS ai_summary_generated_at,
  cr."call_request_id"              AS call_request_id,
  cr."status"::text                 AS call_request_status,
  cr."requested_at"                 AS call_request_requested_at
`;

const CALL_JOINS = Prisma.sql`
  LEFT JOIN "customers"     cus ON cus."customer_id" = c."customer_id"
  LEFT JOIN "agents"        ag  ON ag."agent_id" = c."agent_id"
  LEFT JOIN "devices"       dev ON dev."device_id" = c."device_id"
  LEFT JOIN "recordings"    rec ON rec."call_id" = c."call_id"
  LEFT JOIN "transcripts"   tr  ON tr."call_id"  = c."call_id"
  LEFT JOIN "ai_summaries"  su  ON su."call_id"  = c."call_id"
  LEFT JOIN "call_requests" cr  ON cr."call_id"  = c."call_id"
`;

interface CallRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  agent_id: string | null;
  agent_name: string | null;
  device_id: string | null;
  device_label: string | null;
  client_call_id: string | null;
  phone_number: string;
  direction: string;
  status: string | null;
  started_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
  recording_id: string | null;
  recording_duration_seconds: number | null;
  recording_status: string | null;
  recording_storage_key: string | null;
  recording_mime_type: string | null;
  recording_size_bytes: number | null;
  transcript_status: string | null;
  transcript_text: string | null;
  transcript_language: string | null;
  ai_summary_status: string | null;
  ai_summary_text: string | null;
  ai_summary_key_points: string[] | null;
  ai_summary_customer_intent: string | null;
  ai_summary_sentiment: string | null;
  ai_summary_recommended_action: string | null;
  ai_summary_follow_up_required: boolean | null;
  ai_summary_generated_at: Date | null;
  call_request_id: string | null;
  call_request_status: string | null;
  call_request_requested_at: Date | null;
}

function toDomain(row: CallRow): Call {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    agentId: row.agent_id,
    agentName: row.agent_name,
    deviceId: row.device_id,
    deviceLabel: row.device_label,
    phoneNumber: row.phone_number,
    direction: row.direction as CallDirection,
    status: (row.status as CallStatus | null) ?? null,
    startedAt: row.started_at.toISOString(),
    answeredAt: row.answered_at ? row.answered_at.toISOString() : null,
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    durationSeconds: row.duration_seconds,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    hasRecording: row.recording_id !== null,
    recordingDurationSeconds: row.recording_duration_seconds,
    recordingStatus: row.recording_status,
    recordingStorageKey: row.recording_storage_key,
    recordingMimeType: row.recording_mime_type,
    recordingSizeBytes: row.recording_size_bytes,
    transcriptStatus: row.transcript_status,
    transcriptText: row.transcript_text,
    transcriptLanguage: row.transcript_language,
    aiSummaryStatus: row.ai_summary_status,
    aiSummaryText: row.ai_summary_text,
    aiSummaryKeyPoints: row.ai_summary_key_points ?? [],
    aiSummaryCustomerIntent: row.ai_summary_customer_intent,
    aiSummarySentiment: row.ai_summary_sentiment,
    aiSummaryRecommendedAction: row.ai_summary_recommended_action,
    aiSummaryFollowUpRequired: row.ai_summary_follow_up_required ?? false,
    aiSummaryGeneratedAt: row.ai_summary_generated_at ? row.ai_summary_generated_at.toISOString() : null,
    callRequestId: row.call_request_id,
    callRequestStatus: (row.call_request_status as CallRequestStatus | null) ?? null,
    callRequestRequestedAt: row.call_request_requested_at ? row.call_request_requested_at.toISOString() : null,
    clientCallId: row.client_call_id,
  };
}

/** One call with everything hanging off it, in one round trip. */
export async function getCallById(id: string): Promise<Call | null> {
  const rows = await prisma.$queryRaw<CallRow[]>`
    SELECT ${CALL_COLUMNS}
    FROM "calls" c
    ${CALL_JOINS}
    WHERE c."call_id" = ${id}
  `;
  return rows.length > 0 ? toDomain(rows[0]) : null;
}

/**
 * "Does this call exist?" -- nothing more.
 *
 * The recording/transcript/summary routes only ever needed the answer to that
 * question before writing, but were calling getCallById for it, which pulled
 * the call plus five relations (six round trips) and threw all of it away.
 * This is one indexed primary-key probe.
 */
export async function callExists(id: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ one: number }[]>`
    SELECT 1 AS one FROM "calls" WHERE "call_id" = ${id} LIMIT 1
  `;
  return rows.length > 0;
}

/** Call history for a customer, most recent first. Bounded -- see CALL_HISTORY_PAGE_SIZE. */
export async function listCallsForCustomer(
  customerId: string,
  limit: number = CALL_HISTORY_MAX_LIMIT
): Promise<Call[]> {
  const take = Math.min(CALL_HISTORY_MAX_LIMIT, Math.max(1, limit));
  const rows = await prisma.$queryRaw<CallRow[]>`
    SELECT ${CALL_COLUMNS}
    FROM (
      SELECT * FROM "calls" WHERE "customer_id" = ${customerId}
      ORDER BY "started_at" DESC
      LIMIT ${take}
    ) c
    ${CALL_JOINS}
    ORDER BY c."started_at" DESC
  `;
  return rows.map(toDomain);
}

/**
 * One agent's calls over a window of time, newest first -- the Agent Activity
 * page's list. Same joined shape as every other call read in this file, so the
 * agent page can show recording / transcript / summary state per call without
 * a second query per row.
 *
 * Bounded by the same ceiling as customer call history: the aggregate numbers
 * beside it (lib/agents/activity.ts) are computed in Postgres over *every*
 * call in the window, so bounding this list changes what is listed, never what
 * is counted.
 */
export async function listCallsForAgent(
  agentId: string,
  from: Date | null,
  to: Date | null,
  limit: number = CALL_HISTORY_PAGE_SIZE
): Promise<Call[]> {
  const take = Math.min(CALL_HISTORY_MAX_LIMIT, Math.max(1, limit));
  const lower = from ? Prisma.sql`AND "started_at" >= ${from}::timestamp(3)` : Prisma.empty;
  const upper = to ? Prisma.sql`AND "started_at" < ${to}::timestamp(3)` : Prisma.empty;

  const rows = await prisma.$queryRaw<CallRow[]>`
    SELECT ${CALL_COLUMNS}
    FROM (
      SELECT * FROM "calls" WHERE "agent_id" = ${agentId} ${lower} ${upper}
      ORDER BY "started_at" DESC
      LIMIT ${take}
    ) c
    ${CALL_JOINS}
    ORDER BY c."started_at" DESC
  `;
  return rows.map(toDomain);
}

/**
 * Looks up the call a repeated report is already about, if there is one.
 *
 * Two independent identities can prove "this is the same call", and both are
 * checked in a single statement because this project's Neon adapter serializes
 * round trips:
 *
 *   - `clientCallId` -- the reporting client's own key for the call. This is
 *     the general answer: it works for a call the phone placed on its own, and
 *     it works however many times the report is repeated.
 *   - `callRequestId` -- the CRM request this call fulfills. `call_requests
 *     .call_id` is already `@unique`, so a request that has been fulfilled
 *     names exactly one call. This costs the Android app nothing: it already
 *     sends `callRequestId`, so the whole CRM-initiated path is retry-safe
 *     without a single change on the phone.
 *
 * `clientCallId` is checked first (the `ord` column) because it identifies the
 * call itself, while `callRequestId` identifies the request that produced it.
 */
async function findExistingCallId(
  clientCallId: string | null,
  callRequestId: string | null
): Promise<string | null> {
  if (!clientCallId && !callRequestId) return null;

  const rows = await prisma.$queryRaw<{ call_id: string }[]>`
    SELECT "call_id" FROM (
      SELECT "call_id", 0 AS ord
      FROM "calls"
      WHERE ${clientCallId ? Prisma.sql`"client_call_id" = ${clientCallId}` : Prisma.sql`FALSE`}
      UNION ALL
      SELECT "call_id", 1 AS ord
      FROM "call_requests"
      WHERE ${callRequestId ? Prisma.sql`"call_request_id" = ${callRequestId}` : Prisma.sql`FALSE`}
        AND "call_id" IS NOT NULL
    ) m
    ORDER BY ord ASC
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0].call_id : null;
}

/**
 * POST /api/calls -- "start" a call. `status` is left null (not yet known)
 * until "finish" (updateCall).
 *
 * ---------------------------------------------------------------------------
 * Reporting the same call twice never creates a second record
 * ---------------------------------------------------------------------------
 * This is the whole point of `created` in the return value. Android retries,
 * network retries, an app restart mid-report, an offline queue flushing when
 * the phone comes back online, and a manual "Send to CRM" all send the same
 * report again -- and before this, each one produced another `calls` row, so a
 * customer's history quietly filled with phantom duplicate calls.
 *
 * Now the report is matched against the call it is already about (see
 * `findExistingCallId`) and that existing call is returned untouched, with
 * `created: false` so the route can answer 200 rather than 201. Untouched is
 * deliberate: a retry must not overwrite an outcome, a duration or a device
 * that the first report -- or the `PATCH` that followed it -- already
 * established. Repeating the report is a no-op, which is exactly what makes it
 * safe to repeat any number of times.
 *
 * The lookup costs one statement, and only when the client actually sent an
 * identity to match on; a first-time report with neither key behaves exactly
 * as it always did.
 *
 * ---------------------------------------------------------------------------
 * The rest of the flow
 * ---------------------------------------------------------------------------
 * If `deviceId` is present, the device is registered (or its `last_seen_at`
 * refreshed) in the same statement as the insert, as a data-modifying CTE --
 * Postgres runs those to completion whether or not the main query reads them,
 * so attributing the call to a handset costs no extra round trip and an
 * unfamiliar phone is recorded rather than rejected.
 *
 * If `callRequestId` is present (Android fulfilling a CRM-created
 * CallRequest), that request's `callId` is linked to the new call as a second,
 * separate write -- not wrapped in a `$transaction`, since this environment's
 * Neon adapter can't open the WebSocket session Prisma's interactive
 * transactions need (CLAUDE.md rule §3.11). Two plain sequential writes is the
 * correct shape here anyway: the call itself must exist regardless of whether
 * the (optional, best-effort) link succeeds. If `callRequestId` doesn't match a
 * real request, the link is silently skipped -- the call was still started
 * successfully and Android can retry the link separately via
 * `PATCH /api/call-requests/{id}`.
 *
 * ---------------------------------------------------------------------------
 * Who the call belongs to
 * ---------------------------------------------------------------------------
 * `agentId` is resolved in one `COALESCE`, in descending order of authority:
 *
 *   1. **What the reporting client sent.** The phone's own answer always wins;
 *      nothing below ever overwrites it.
 *   2. **The linked call request's `agentId`.** The CRM raised that request for
 *      a specific agent, so a call fulfilling it was made by that agent. Not an
 *      inference -- it is the routing decision the CRM itself made.
 *   3. **The reporting device's assigned agent.** Which handset belongs to whom
 *      is configuration an admin entered in the CRM, so a call reported by that
 *      handset was made by that agent.
 *
 * Otherwise NULL, which stays a real answer meaning "we have not been told".
 * This exists because `agentId` comes from a free-text field in Conbun Call's
 * Settings that is routinely left blank -- and every call reported by that
 * phone then counted for nobody, including calls the CRM had itself routed to
 * a named agent seconds earlier. Both fallbacks cost nothing: they are scalar
 * subqueries inside the INSERT that already runs, not extra round trips.
 *
 * Returns null if the insert violates a foreign key -- i.e. `customerId` (or
 * `agentId`) doesn't point at a real row. The route still does its own customer
 * check first, so the 404 it returns is exactly what it has always been; this
 * is a net for the cases that check cannot cover (a customer deleted in
 * between, or a bad `agentId`), which used to surface as a 500.
 */
export async function startCall(
  input: StartCallInput
): Promise<{ call: Call; created: boolean } | null> {
  const clientCallId = input.clientCallId ?? null;
  const callRequestId = input.callRequestId ?? null;
  const deviceId = input.deviceId ?? null;

  const existingId = await findExistingCallId(clientCallId, callRequestId);
  if (existingId) {
    const existing = await getCallById(existingId);
    // A `call_requests.call_id` pointing at a call that no longer exists would
    // be the only way to get here with nothing to return; falling through to
    // the insert is the right recovery, not a 500.
    if (existing) return { call: existing, created: false };
  }

  const id = randomUUID();
  const now = new Date();
  const startedAt = input.startedAt ? new Date(input.startedAt) : now;

  // No `include`/`select` round trips here on purpose (see the note at the top
  // of this file): the relations are re-read in one joined query below, which
  // is cheaper than the five extra statements an include would emit -- and
  // necessary anyway, since the call-request link happens after the row exists.
  try {
    await prisma.$executeRaw`
      WITH dev AS (
        INSERT INTO "devices" ("device_id", "last_seen_at", "created_at", "updated_at")
        SELECT ${deviceId}::text, ${now}::timestamp(3), ${now}::timestamp(3), ${now}::timestamp(3)
        WHERE ${deviceId ? Prisma.sql`TRUE` : Prisma.sql`FALSE`}
        ON CONFLICT ("device_id") DO UPDATE SET "last_seen_at" = ${now}, "updated_at" = ${now}
        RETURNING "device_id"
      )
      INSERT INTO "calls" (
        "call_id", "customer_id", "agent_id", "device_id", "client_call_id",
        "phone_number", "direction", "started_at", "duration_seconds",
        "created_at", "updated_at"
      )
      VALUES (
        ${id}, ${input.customerId},
        -- Which agent made this call, in order of authority -- see the
        -- "Who the call belongs to" note above this function. Both fallbacks
        -- read the pre-statement snapshot, so the device row the CTE above
        -- may have just created is correctly invisible here: a handset the CRM
        -- is meeting for the first time has no agent, and NULL is the honest
        -- answer rather than a guessed one.
        COALESCE(
          ${input.agentId ?? null}::text,
          (SELECT r."agent_id" FROM "call_requests" r WHERE r."call_request_id" = ${callRequestId}::text),
          (SELECT d."agent_id" FROM "devices" d WHERE d."device_id" = ${deviceId}::text)
        ),
        ${deviceId}::text, ${clientCallId}::text,
        ${input.phoneNumber}, ${input.direction}::"CallDirection", ${startedAt}::timestamp(3), 0,
        ${now}::timestamp(3), ${now}::timestamp(3)
      )
    `;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003 = foreign key constraint failed. The FKs on `calls` are
      // customer_id (required), agent_id and device_id (both optional) --
      // either way the caller referenced something that doesn't exist, which
      // is a 404, not a 500.
      if (error.code === "P2003") return null;
      // P2002 = unique violation on `client_call_id`: two reports of the same
      // call raced each other past the lookup above. The other one won, and it
      // created exactly the row this one was going to -- so return that, which
      // is the same answer a retry a second later would have got.
      if (error.code === "P2002" && clientCallId) {
        const raced = await findExistingCallId(clientCallId, null);
        const call = raced ? await getCallById(raced) : null;
        if (call) return { call, created: false };
      }
    }
    throw error;
  }

  if (callRequestId) {
    try {
      await prisma.callRequest.update({
        where: { id: callRequestId },
        data: { callId: id },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) {
        throw error;
      }
      // callRequestId didn't match a real request -- the call itself was
      // still created successfully; the link is best-effort, not required.
    }
  }

  const call = await getCallById(id);
  // Non-null in practice: we just created this row and nothing deletes calls.
  if (!call) throw new Error(`Call ${id} disappeared immediately after being created.`);
  return { call, created: true };
}

/**
 * PATCH /api/calls/{id} -- the call result.
 *
 * Deliberately the *whole* of the call result and nothing else: it writes what
 * happened on the phone (outcome, answer/end time, duration, failure reason,
 * agent, device) and returns. It does not look for a recording, does not wait
 * for transcription, and does not touch the AI summary -- those arrive later
 * through their own endpoints, and any of them failing leaves everything
 * written here intact.
 *
 * Naturally idempotent: it is a patch of stated fields, so sending the same
 * result twice writes the same values twice and changes nothing. `deviceId` is
 * the one exception to "last write wins", and only in one direction -- it
 * fills in a call whose device is still unknown and never overwrites one that
 * is already recorded, because which phone made a call is a fact about the
 * past.
 *
 * Returns null if the call doesn't exist.
 */
export async function updateCall(id: string, patch: UpdateCallInput): Promise<Call | null> {
  if (patch.deviceId) {
    // Same reasoning as startCall: an unfamiliar handset is registered, not
    // rejected. Separate statement rather than a CTE because the UPDATE below
    // goes through Prisma's query builder, and this runs once per call rather
    // than on a poll.
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO "devices" ("device_id", "last_seen_at", "created_at", "updated_at")
      VALUES (${patch.deviceId}, ${now}::timestamp(3), ${now}::timestamp(3), ${now}::timestamp(3))
      ON CONFLICT ("device_id") DO UPDATE
        SET "last_seen_at" = ${now}::timestamp(3), "updated_at" = ${now}::timestamp(3)
    `;
  }

  try {
    await prisma.call.update({
      where: { id },
      data: {
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.answeredAt !== undefined && {
          answeredAt: patch.answeredAt ? new Date(patch.answeredAt) : null,
        }),
        ...(patch.endedAt !== undefined && { endedAt: new Date(patch.endedAt) }),
        ...(patch.durationSeconds !== undefined && { durationSeconds: patch.durationSeconds }),
        ...(patch.failureReason !== undefined && { failureReason: patch.failureReason }),
        ...(patch.agentId !== undefined && { agentId: patch.agentId }),
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }

  if (patch.deviceId) {
    // Fill-in-only, expressed where it can't race: one statement, and the
    // `IS NULL` guard is part of it. `agent_id` is filled in the same way and
    // in the same statement -- from the handset's assigned agent, and only
    // when the call still has no agent of its own, for the same reason
    // startCall does it (see "Who the call belongs to" above).
    await prisma.$executeRaw`
      UPDATE "calls" c
      SET "device_id" = ${patch.deviceId},
          "agent_id" = COALESCE(
            c."agent_id",
            (SELECT d."agent_id" FROM "devices" d WHERE d."device_id" = ${patch.deviceId})
          ),
          "updated_at" = ${new Date()}
      WHERE c."call_id" = ${id} AND c."device_id" IS NULL
    `;
  }

  return getCallById(id);
}

/**
 * Per-customer call summary *and* current open call request for a whole page
 * of customers, in one round trip.
 *
 * Replaces what the customers list used to do: call `getCallStatsForCustomer`
 * once per row, i.e. 25 separate full call-history queries (each with four
 * joins) to render 25 numbers. Measured against the real Neon database that
 * cost ~6.1s of the ~11s page load -- and `Promise.all` did not help, because
 * this project's Neon adapter effectively serializes concurrent queries
 * (measured: 4 trivial queries take ~1.0s sequentially and ~2.6s in
 * parallel). Fewer queries is the only lever that works here, so this is one.
 *
 * It now also folds in what used to be a second query for the newest still-open
 * call request per customer, via a second LATERAL -- same key set, same page,
 * so asking for it separately was one avoidable round trip per page render.
 *
 * `LEFT JOIN LATERAL ... LIMIT 1` rather than `DISTINCT ON`: the page needs the
 * newest call *and* the total per customer, and lateral subqueries express both
 * without repeating the scan in application code. Both use the existing
 * `calls(customer_id, started_at)` and `call_requests(status, requested_at)`
 * indexes. Every column is cast to a plain scalar type because this project's
 * Neon adapter can't deserialize Postgres enum columns through `$queryRaw`.
 */
export interface CustomerCallOverviewRow {
  summary: CustomerCallSummary | null;
  openRequest: { id: string; status: CallRequestStatus; requestedAt: string } | null;
}

export async function getCustomerCallOverviews(
  customerIds: string[]
): Promise<Map<string, CustomerCallOverviewRow>> {
  const overviews = new Map<string, CustomerCallOverviewRow>();
  if (customerIds.length === 0) return overviews;

  const rows = await prisma.$queryRaw<
    {
      customer_id: string;
      total_calls: number | null;
      started_at: Date | null;
      status: string | null;
      duration_seconds: number | null;
      request_id: string | null;
      request_status: string | null;
      request_requested_at: Date | null;
    }[]
  >`
    SELECT
      ids."customer_id",
      lc."total_calls",
      lc."started_at",
      lc."status",
      lc."duration_seconds",
      orq."request_id",
      orq."request_status",
      orq."request_requested_at"
    FROM (SELECT unnest(ARRAY[${Prisma.join(customerIds)}]::text[]) AS "customer_id") ids
    LEFT JOIN LATERAL (
      SELECT
        c."started_at",
        c."status"::text        AS "status",
        c."duration_seconds",
        (SELECT COUNT(*)::int FROM "calls" c2 WHERE c2."customer_id" = ids."customer_id") AS "total_calls"
      FROM "calls" c
      WHERE c."customer_id" = ids."customer_id"
      ORDER BY c."started_at" DESC
      LIMIT 1
    ) lc ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        r."call_request_id"  AS "request_id",
        r."status"::text     AS "request_status",
        r."requested_at"     AS "request_requested_at"
      FROM "call_requests" r
      WHERE r."customer_id" = ids."customer_id"
        AND r."status" IN ('PENDING', 'ACCEPTED')
      ORDER BY r."requested_at" DESC
      LIMIT 1
    ) orq ON TRUE
  `;

  for (const row of rows) {
    overviews.set(row.customer_id, {
      summary:
        row.started_at === null
          ? null
          : {
              customerId: row.customer_id,
              totalCalls: row.total_calls ?? 0,
              lastCallAt: row.started_at.toISOString(),
              lastCallStatus: (row.status as CallStatus | null) ?? null,
              lastCallDurationSeconds: row.duration_seconds ?? 0,
            },
      openRequest:
        row.request_id === null || row.request_requested_at === null
          ? null
          : {
              id: row.request_id,
              status: row.request_status as CallRequestStatus,
              requestedAt: row.request_requested_at.toISOString(),
            },
    });
  }
  return overviews;
}

/**
 * The change-detection read behind `GET /api/customers/{id}/call-status` --
 * everything lib/calls/pulse.ts needs to decide "has anything changed, and is
 * anything still coming", in **one** statement.
 *
 * Two deliberate choices, both because this is the one query in the project
 * that runs *repeatedly* (every few seconds while a call is in flight) rather
 * than once per page view:
 *
 * 1. **Booleans, not text.** It does not reuse getCustomerCallOverview, which
 *    carries transcript and summary bodies. `has_transcript_text` is the only
 *    part of a transcript that matters for detecting change, and selecting it
 *    instead keeps a poll's cost flat no matter how long the transcript is --
 *    the difference between a poll that is cheap and one that is only cheap
 *    today.
 *
 * 2. **`UNION ALL`, not two queries.** The calls and the call requests are
 *    different shapes, so the obvious implementation is two round trips --
 *    and this project's Neon adapter serializes them, so two round trips is
 *    literally twice the latency (measured: ~1.07 s for the two-query version
 *    of this endpoint from this machine). Unioning them onto one column set
 *    and splitting the rows in JavaScript makes it one. The request branch
 *    pads the call-only columns with typed NULLs; `kind` sorts 'call' before
 *    'request', and each half keeps its own newest-first order.
 *
 * The `LIMIT`s match what the detail page fetches (CALL_HISTORY_PAGE_SIZE
 * calls, 5 requests) on purpose: the fingerprint has to cover exactly the
 * rows the page renders, or page and poller would disagree about what
 * "unchanged" means. Both halves use indexes that already exist --
 * `calls(customer_id, started_at)` and `call_requests(customer_id)`.
 *
 * Enum columns are cast to `text` for the same adapter reason as every other
 * raw query in this file.
 */
export async function getCustomerCallPulseInputs(
  customerId: string,
  limit: number = CALL_HISTORY_PAGE_SIZE
): Promise<{ calls: CallPulse[]; requests: RequestPulse[] }> {
  const take = Math.min(CALL_HISTORY_MAX_LIMIT, Math.max(1, limit));
  const rows = await prisma.$queryRaw<
    {
      kind: string;
      id: string;
      updated_at: Date;
      status: string | null;
      /** `started_at` for a call, `requested_at` for a request -- the column both halves sort on. */
      ord: Date;
      ref: string | null;
      has_recording: boolean | null;
      recording_status: string | null;
      transcript_status: string | null;
      has_transcript_text: boolean | null;
      ai_summary_status: string | null;
      has_summary_text: boolean | null;
    }[]
  >`
    (
      SELECT
        'call'                           AS kind,
        c."call_id"                      AS id,
        c."updated_at"                   AS updated_at,
        c."status"::text                 AS status,
        c."started_at"                   AS ord,
        NULL::text                       AS ref,
        (rec."recording_id" IS NOT NULL) AS has_recording,
        rec."processing_status"::text    AS recording_status,
        tr."processing_status"::text     AS transcript_status,
        (tr."text" IS NOT NULL AND btrim(tr."text") <> '')                 AS has_transcript_text,
        su."processing_status"::text     AS ai_summary_status,
        (su."summary_text" IS NOT NULL AND btrim(su."summary_text") <> '') AS has_summary_text
      FROM (
        SELECT * FROM "calls" WHERE "customer_id" = ${customerId}
        ORDER BY "started_at" DESC
        LIMIT ${take}
      ) c
      LEFT JOIN "recordings"   rec ON rec."call_id" = c."call_id"
      LEFT JOIN "transcripts"  tr  ON tr."call_id"  = c."call_id"
      LEFT JOIN "ai_summaries" su  ON su."call_id"  = c."call_id"
    )
    UNION ALL
    (
      SELECT
        'request'          AS kind,
        r."call_request_id" AS id,
        r."updated_at"      AS updated_at,
        r."status"::text    AS status,
        r."requested_at"    AS ord,
        r."call_id"         AS ref,
        NULL::boolean, NULL::text, NULL::text, NULL::boolean, NULL::text, NULL::boolean
      FROM "call_requests" r
      WHERE r."customer_id" = ${customerId}
      ORDER BY r."requested_at" DESC
      LIMIT 5
    )
    ORDER BY kind ASC, ord DESC
  `;

  const calls: CallPulse[] = [];
  const requests: RequestPulse[] = [];
  for (const row of rows) {
    if (row.kind === "call") {
      calls.push({
        id: row.id,
        updatedAt: row.updated_at.toISOString(),
        startedAt: row.ord.toISOString(),
        status: (row.status as CallStatus | null) ?? null,
        hasRecording: row.has_recording ?? false,
        recordingStatus: row.recording_status,
        transcriptStatus: row.transcript_status,
        hasTranscriptText: row.has_transcript_text ?? false,
        aiSummaryStatus: row.ai_summary_status,
        hasSummaryText: row.has_summary_text ?? false,
      });
    } else {
      requests.push({
        id: row.id,
        status: row.status as CallRequestStatus,
        updatedAt: row.updated_at.toISOString(),
        callId: row.ref,
      });
    }
  }
  return { calls, requests };
}

const EMPTY_STATS: CustomerCallStats = {
  totalCalls: 0,
  answeredCalls: 0,
  missedCalls: 0,
  incomingCalls: 0,
  outgoingCalls: 0,
  totalConversationSeconds: 0,
  lastContactedAt: null,
  lastContactedByAgent: null,
};

/**
 * The Customer Detail page's whole call area in one query: a bounded page of
 * call history with all five relations joined, plus aggregate stats computed
 * in Postgres over *every* call this customer has -- not just the page.
 *
 * The stats CTE runs once and is cross-joined onto each returned row, so the
 * numbers stay correct however small `limit` is. Before this, "stats" meant
 * counting an unbounded, fully-hydrated call list in JavaScript, which is
 * exactly the "load the whole history to show six numbers" pattern that does
 * not survive a customer with hundreds of calls.
 */
export async function getCustomerCallOverview(
  customerId: string,
  limit: number = CALL_HISTORY_PAGE_SIZE
): Promise<CustomerCallOverview> {
  const take = Math.min(CALL_HISTORY_MAX_LIMIT, Math.max(1, limit));

  const rows = await prisma.$queryRaw<(CallRow & StatsColumns)[]>`
    WITH agg AS (
      SELECT
        COUNT(*)::int                                                              AS total_calls,
        COUNT(*) FILTER (WHERE "status" = 'ANSWERED')::int                         AS answered_calls,
        COUNT(*) FILTER (WHERE "status" IN ('MISSED', 'REJECTED', 'FAILED'))::int  AS missed_calls,
        COUNT(*) FILTER (WHERE "direction" = 'INCOMING')::int                      AS incoming_calls,
        COUNT(*) FILTER (WHERE "direction" = 'OUTGOING')::int                      AS outgoing_calls,
        COALESCE(SUM("duration_seconds") FILTER (WHERE "status" = 'ANSWERED'), 0)::int AS total_conversation_seconds
      FROM "calls"
      WHERE "customer_id" = ${customerId}
    )
    SELECT ${CALL_COLUMNS},
      agg.total_calls,
      agg.answered_calls,
      agg.missed_calls,
      agg.incoming_calls,
      agg.outgoing_calls,
      agg.total_conversation_seconds
    FROM (
      SELECT * FROM "calls" WHERE "customer_id" = ${customerId}
      ORDER BY "started_at" DESC
      LIMIT ${take}
    ) c
    ${CALL_JOINS}
    CROSS JOIN agg
    ORDER BY c."started_at" DESC
  `;

  if (rows.length === 0) {
    // No calls at all -- every stat is genuinely zero, not unknown.
    return { calls: [], stats: EMPTY_STATS, truncated: false };
  }

  const calls = rows.map(toDomain);
  const head = rows[0];
  return {
    calls,
    stats: {
      totalCalls: head.total_calls,
      answeredCalls: head.answered_calls,
      missedCalls: head.missed_calls,
      incomingCalls: head.incoming_calls,
      outgoingCalls: head.outgoing_calls,
      totalConversationSeconds: head.total_conversation_seconds,
      lastContactedAt: calls[0].startedAt,
      lastContactedByAgent: calls[0].agentName,
    },
    truncated: head.total_calls > calls.length,
  };
}

interface StatsColumns {
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  total_conversation_seconds: number;
}

/**
 * ---------------------------------------------------------------------------
 * The Calls section -- every agent's calls, over a window of time
 * ---------------------------------------------------------------------------
 *
 * The team-wide counterpart to lib/agents/activity.ts, which asks the same
 * questions about one agent. Two functions, one statement each: the headline
 * numbers over *every* call in the window, and the (bounded) list beneath
 * them. They are deliberately not the same set, and the page says so.
 *
 * Every number here is counted from `calls` rows Android already reported.
 * Nothing is modelled, projected or filled in: talk time is the sum of
 * `duration_seconds` over ANSWERED calls and nothing else, "reached" means a
 * customer with at least one answered call, and calls whose outcome was never
 * reported are counted and named as exactly that rather than folded into
 * "failed".
 */
export interface CallActivityStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  rejectedCalls: number;
  failedCalls: number;
  /** Started, outcome never reported (`status IS NULL`) -- "not told yet", not "failed". */
  unreportedCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  /** Seconds actually spent talking -- ANSWERED calls only. */
  totalTalkTimeSeconds: number;
  /** Mean length of an answered call. 0 when nothing was answered. */
  averageCallSeconds: number;
  /** Distinct customers called at all. */
  uniqueCustomers: number;
  /** Distinct customers with at least one answered call. */
  customersReached: number;
  /** Distinct agents with at least one call in the window. */
  activeAgents: number;
  /** Calls with no agent recorded -- shown so the totals can be read honestly, never hidden. */
  unattributedCalls: number;
  /** Distinct handsets that reported a call in the window. */
  activeDevices: number;
  firstCallAt: string | null;
  lastCallAt: string | null;
}

const EMPTY_CALL_ACTIVITY: CallActivityStats = {
  totalCalls: 0,
  answeredCalls: 0,
  missedCalls: 0,
  rejectedCalls: 0,
  failedCalls: 0,
  unreportedCalls: 0,
  incomingCalls: 0,
  outgoingCalls: 0,
  totalTalkTimeSeconds: 0,
  averageCallSeconds: 0,
  uniqueCustomers: 0,
  customersReached: 0,
  activeAgents: 0,
  unattributedCalls: 0,
  activeDevices: 0,
  firstCallAt: null,
  lastCallAt: null,
};

interface CallActivityRow {
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  rejected_calls: number;
  failed_calls: number;
  unreported_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  talk_seconds: number;
  unique_customers: number;
  customers_reached: number;
  active_agents: number;
  unattributed_calls: number;
  active_devices: number;
  first_call_at: Date | null;
  last_call_at: Date | null;
}

/** Headline numbers for the Calls page. One statement, over every call in the window. */
export async function getCallActivity(from: Date | null, to: Date | null): Promise<CallActivityStats> {
  const lower = from ? Prisma.sql`AND "started_at" >= ${from}::timestamp(3)` : Prisma.empty;
  const upper = to ? Prisma.sql`AND "started_at" < ${to}::timestamp(3)` : Prisma.empty;

  const rows = await prisma.$queryRaw<CallActivityRow[]>`
    WITH scoped AS (
      SELECT "customer_id", "agent_id", "device_id", "status"::text AS status,
             "direction"::text AS direction, "started_at", "duration_seconds"
      FROM "calls"
      WHERE TRUE ${lower} ${upper}
    ),
    per_customer AS (
      SELECT "customer_id", COUNT(*) FILTER (WHERE status = 'ANSWERED')::int AS answered
      FROM scoped GROUP BY "customer_id"
    )
    SELECT
      COUNT(*)::int                                                                AS total_calls,
      COUNT(*) FILTER (WHERE status = 'ANSWERED')::int                             AS answered_calls,
      COUNT(*) FILTER (WHERE status = 'MISSED')::int                               AS missed_calls,
      COUNT(*) FILTER (WHERE status = 'REJECTED')::int                             AS rejected_calls,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int                               AS failed_calls,
      COUNT(*) FILTER (WHERE status IS NULL)::int                                  AS unreported_calls,
      COUNT(*) FILTER (WHERE direction = 'INCOMING')::int                          AS incoming_calls,
      COUNT(*) FILTER (WHERE direction = 'OUTGOING')::int                          AS outgoing_calls,
      COALESCE(SUM("duration_seconds") FILTER (WHERE status = 'ANSWERED'), 0)::int AS talk_seconds,
      (SELECT COUNT(*) FROM per_customer)::int                                     AS unique_customers,
      (SELECT COUNT(*) FROM per_customer WHERE answered > 0)::int                  AS customers_reached,
      COUNT(DISTINCT "agent_id")::int                                              AS active_agents,
      COUNT(*) FILTER (WHERE "agent_id" IS NULL)::int                              AS unattributed_calls,
      COUNT(DISTINCT "device_id")::int                                             AS active_devices,
      MIN("started_at")                                                            AS first_call_at,
      MAX("started_at")                                                            AS last_call_at
    FROM scoped
  `;

  const row = rows[0];
  if (!row || row.total_calls === 0) return EMPTY_CALL_ACTIVITY;

  return {
    totalCalls: row.total_calls,
    answeredCalls: row.answered_calls,
    missedCalls: row.missed_calls,
    rejectedCalls: row.rejected_calls,
    failedCalls: row.failed_calls,
    unreportedCalls: row.unreported_calls,
    incomingCalls: row.incoming_calls,
    outgoingCalls: row.outgoing_calls,
    totalTalkTimeSeconds: row.talk_seconds,
    // Mean over answered calls only: dividing talk time by calls nobody picked
    // up would report an "average call" shorter than any real call.
    averageCallSeconds: row.answered_calls > 0 ? Math.round(row.talk_seconds / row.answered_calls) : 0,
    uniqueCustomers: row.unique_customers,
    customersReached: row.customers_reached,
    activeAgents: row.active_agents,
    unattributedCalls: row.unattributed_calls,
    activeDevices: row.active_devices,
    firstCallAt: row.first_call_at ? row.first_call_at.toISOString() : null,
    lastCallAt: row.last_call_at ? row.last_call_at.toISOString() : null,
  };
}

/**
 * Every agent's calls over a window, newest first -- the Calls page's list.
 *
 * Same joined shape as every other call read in this file (one statement,
 * customer/agent/device/recording/transcript/summary included), and bounded by
 * the same ceiling: the numbers above it are computed in Postgres over all of
 * them, so the bound changes what is listed, never what is counted. Uses the
 * `calls(started_at)` index.
 */
export async function listCalls(
  from: Date | null,
  to: Date | null,
  limit: number = CALL_HISTORY_PAGE_SIZE
): Promise<Call[]> {
  const take = Math.min(CALL_HISTORY_MAX_LIMIT, Math.max(1, limit));
  const lower = from ? Prisma.sql`AND "started_at" >= ${from}::timestamp(3)` : Prisma.empty;
  const upper = to ? Prisma.sql`AND "started_at" < ${to}::timestamp(3)` : Prisma.empty;

  const rows = await prisma.$queryRaw<CallRow[]>`
    SELECT ${CALL_COLUMNS}
    FROM (
      SELECT * FROM "calls" WHERE TRUE ${lower} ${upper}
      ORDER BY "started_at" DESC
      LIMIT ${take}
    ) c
    ${CALL_JOINS}
    ORDER BY c."started_at" DESC
  `;
  return rows.map(toDomain);
}
