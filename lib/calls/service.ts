import { Prisma } from "@/lib/generated/prisma/client";
import type { CallDefaultArgs, CallGetPayload } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type {
  Call,
  CallStatus,
  StartCallInput,
  UpdateCallInput,
  CustomerCallStats,
  CustomerCallSummary,
} from "@/lib/calls/types";

// `Prisma.validator` doesn't exist in Prisma 7's generated client -- `satisfies`
// against the model's own *DefaultArgs type is the current equivalent way to
// get a strongly-typed include/select shape without repeating it.
const callWithRelations = {
  include: {
    agent: { select: { name: true } },
    // Recording duration/status come along with the existence check -- same
    // row, same join, no extra round trip, and it lets the Customer Detail
    // page show what Android actually reported instead of just "yes/no".
    recording: { select: { id: true, durationSeconds: true, processingStatus: true } },
    // `text` too: the transcript is the point of the whole pipeline, and
    // fetching it here is what lets Call History display it inline rather
    // than only badge whether it exists (CRM_ARCHITECTURE.md Phase 6).
    transcript: { select: { processingStatus: true, text: true, language: true } },
    aiSummary: { select: { processingStatus: true } },
    callRequest: { select: { id: true, status: true } },
  },
} satisfies CallDefaultArgs;
type CallWithRelations = CallGetPayload<typeof callWithRelations>;

function toDomain(row: CallWithRelations): Call {
  return {
    id: row.id,
    customerId: row.customerId,
    agentId: row.agentId,
    agentName: row.agent?.name ?? null,
    phoneNumber: row.phoneNumber,
    direction: row.direction,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    durationSeconds: row.durationSeconds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasRecording: row.recording !== null,
    recordingDurationSeconds: row.recording?.durationSeconds ?? null,
    recordingStatus: row.recording?.processingStatus ?? null,
    transcriptStatus: row.transcript?.processingStatus ?? null,
    transcriptText: row.transcript?.text ?? null,
    transcriptLanguage: row.transcript?.language ?? null,
    aiSummaryStatus: row.aiSummary?.processingStatus ?? null,
    callRequestId: row.callRequest?.id ?? null,
    callRequestStatus: row.callRequest?.status ?? null,
  };
}

/** Call history for a customer, most recent first -- what the Customer Detail page's Call History section reads. */
export async function listCallsForCustomer(customerId: string): Promise<Call[]> {
  const rows = await prisma.call.findMany({
    where: { customerId },
    orderBy: { startedAt: "desc" },
    ...callWithRelations,
  });
  return rows.map(toDomain);
}

export async function getCallById(id: string): Promise<Call | null> {
  const row = await prisma.call.findUnique({ where: { id }, ...callWithRelations });
  return row ? toDomain(row) : null;
}

/**
 * POST /api/calls -- "start" a call. `status` is left null (not yet
 * known) until "finish" (updateCall).
 *
 * If `callRequestId` is present (Android fulfilling a CRM-created
 * CallRequest), links that request's `callId` to the new call as a
 * second, separate write -- not wrapped in a `$transaction`, since this
 * environment's Neon adapter can't open the WebSocket session Prisma's
 * interactive transactions need (see lib/customers/prisma-store.ts's
 * comment). Two plain sequential writes is the correct fix here anyway,
 * not just a workaround: the call itself must exist regardless of
 * whether the (optional, best-effort) link succeeds. If `callRequestId`
 * doesn't match a real request, the link is silently skipped -- it
 * doesn't fail call creation, since the call was still started
 * successfully and Android can retry the link separately via
 * `PATCH /api/call-requests/{id}`.
 */
export async function startCall(input: StartCallInput): Promise<Call> {
  const row = await prisma.call.create({
    data: {
      customerId: input.customerId,
      phoneNumber: input.phoneNumber,
      direction: input.direction,
      agentId: input.agentId ?? null,
      startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
    },
    ...callWithRelations,
  });

  if (input.callRequestId) {
    try {
      await prisma.callRequest.update({
        where: { id: input.callRequestId },
        data: { callId: row.id },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) {
        throw error;
      }
      // callRequestId didn't match a real request -- the call itself was
      // still created successfully; the link is best-effort, not required.
    }
  }

  return toDomain(row);
}

/** PATCH /api/calls/{id} -- "finish" a call (status/endedAt/durationSeconds), or amend agentId. Returns null if the call doesn't exist. */
export async function updateCall(id: string, patch: UpdateCallInput): Promise<Call | null> {
  try {
    const row = await prisma.call.update({
      where: { id },
      data: {
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.endedAt !== undefined && { endedAt: new Date(patch.endedAt) }),
        ...(patch.durationSeconds !== undefined && { durationSeconds: patch.durationSeconds }),
        ...(patch.agentId !== undefined && { agentId: patch.agentId }),
      },
      ...callWithRelations,
    });
    return toDomain(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}

/**
 * Per-customer call summary for a *page* of customers, in one round trip.
 *
 * Replaces what the customers list used to do: call `getCallStatsForCustomer`
 * once per row, i.e. 25 separate full call-history queries (each with four
 * joins) to render 25 numbers. Measured against the real Neon database that
 * cost ~6.1s of the ~11s page load -- and `Promise.all` did not help, because
 * this project's Neon adapter effectively serializes concurrent queries
 * (measured: 4 trivial queries take ~1.0s sequentially and ~2.6s in
 * parallel). Fewer queries is the only lever that works here, so this is one.
 *
 * Raw SQL rather than `groupBy`: `DISTINCT ON` + a partition COUNT gets the
 * per-customer total *and* the most recent call's outcome together, which
 * `groupBy` cannot express -- it would take two queries and still not return
 * the last call's status. Uses the `calls(customer_id, started_at)` index.
 * Every column is cast to a plain scalar type because this project's Neon
 * adapter can't deserialize Postgres enum/`name` columns through `$queryRaw`.
 */
export async function getCallSummariesForCustomers(
  customerIds: string[]
): Promise<Map<string, CustomerCallSummary>> {
  const summaries = new Map<string, CustomerCallSummary>();
  if (customerIds.length === 0) return summaries;

  const rows = await prisma.$queryRaw<
    {
      customer_id: string;
      total_calls: bigint;
      started_at: Date;
      status: string | null;
      duration_seconds: number;
    }[]
  >`
    SELECT DISTINCT ON ("customer_id")
      "customer_id",
      COUNT(*) OVER (PARTITION BY "customer_id") AS total_calls,
      "started_at",
      "status"::text AS status,
      "duration_seconds"
    FROM "calls"
    WHERE "customer_id" IN (${Prisma.join(customerIds)})
    ORDER BY "customer_id", "started_at" DESC
  `;

  for (const row of rows) {
    summaries.set(row.customer_id, {
      customerId: row.customer_id,
      totalCalls: Number(row.total_calls),
      lastCallAt: row.started_at.toISOString(),
      lastCallStatus: (row.status as CallStatus | null) ?? null,
      lastCallDurationSeconds: row.duration_seconds,
    });
  }
  return summaries;
}

/**
 * Aggregate call-activity stats for the Customer Detail page's "Call
 * activity" cards.
 *
 * Pass the calls you already have (the detail page renders the same list
 * right below these cards) to compute them without a second identical query
 * -- that duplicate round trip was pure waste on every detail-page load.
 * Omitting the argument keeps the original self-fetching behaviour for any
 * caller that only wants the numbers.
 */
export async function getCallStatsForCustomer(
  customerId: string,
  knownCalls?: Call[]
): Promise<CustomerCallStats> {
  const calls = knownCalls ?? (await listCallsForCustomer(customerId));
  const answered = calls.filter((c) => c.status === "ANSWERED");
  const missed = calls.filter((c) => c.status === "MISSED" || c.status === "REJECTED" || c.status === "FAILED");
  const incoming = calls.filter((c) => c.direction === "INCOMING");
  const outgoing = calls.filter((c) => c.direction === "OUTGOING");
  const last = calls[0] ?? null;
  return {
    totalCalls: calls.length,
    answeredCalls: answered.length,
    missedCalls: missed.length,
    incomingCalls: incoming.length,
    outgoingCalls: outgoing.length,
    totalConversationSeconds: answered.reduce((sum, c) => sum + c.durationSeconds, 0),
    lastContactedAt: last?.startedAt ?? null,
    lastContactedByAgent: last?.agentName ?? null,
  };
}
