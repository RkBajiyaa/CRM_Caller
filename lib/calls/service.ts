import { Prisma } from "@/lib/generated/prisma/client";
import type { CallDefaultArgs, CallGetPayload } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type { Call, StartCallInput, UpdateCallInput, CustomerCallStats } from "@/lib/calls/types";

// `Prisma.validator` doesn't exist in Prisma 7's generated client -- `satisfies`
// against the model's own *DefaultArgs type is the current equivalent way to
// get a strongly-typed include/select shape without repeating it.
const callWithRelations = {
  include: {
    agent: { select: { name: true } },
    recording: { select: { id: true } },
    transcript: { select: { processingStatus: true } },
    aiSummary: { select: { processingStatus: true } },
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
    transcriptStatus: row.transcript?.processingStatus ?? null,
    aiSummaryStatus: row.aiSummary?.processingStatus ?? null,
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

/** POST /api/calls -- "start" a call. `status` is left null (not yet known) until "finish" (updateCall). */
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

/** Aggregate call-activity stats for the Customer Detail page's "Call activity" cards. Computed in application code from the same rows listCallsForCustomer would return -- call volume per customer is small enough that this doesn't need a separate aggregate query. */
export async function getCallStatsForCustomer(customerId: string): Promise<CustomerCallStats> {
  const calls = await listCallsForCustomer(customerId);
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
