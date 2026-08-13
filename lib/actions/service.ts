import { Prisma } from "@/lib/generated/prisma/client";
import type { ActionDefaultArgs, ActionGetPayload } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type { Action, CreateActionInput, UpdateActionInput } from "@/lib/actions/types";

// See lib/calls/service.ts's comment on why `satisfies` replaces `Prisma.validator` here.
const actionWithAgent = {
  include: { assignedAgent: { select: { name: true } } },
} satisfies ActionDefaultArgs;
type ActionWithAgent = ActionGetPayload<typeof actionWithAgent>;

function toDomain(row: ActionWithAgent): Action {
  return {
    id: row.id,
    customerId: row.customerId,
    callId: row.callId,
    assignedAgentId: row.assignedAgentId,
    assignedAgentName: row.assignedAgent?.name ?? null,
    type: row.type,
    notes: row.notes,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

/**
 * Follow-ups for one customer, soonest-due first (CRM_ARCHITECTURE.md Phase 8
 * -- "Reach out again" / "Follow up tomorrow" etc.).
 *
 * Hand-written join rather than Prisma's `include`, for the reason spelled out
 * at the top of lib/calls/service.ts: an `include` is a *second* SQL statement,
 * and this project's Neon adapter serializes them, so pulling one agent name
 * alongside the list cost an entire extra round trip (measured: 630 ms / 2 SQL
 * before, ~350 ms / 1 SQL after). Ordering is byte-for-byte what Prisma emitted
 * -- Postgres sorts an enum by its declaration order, which is the same order
 * Prisma's `status: "asc"` used (PENDING, IN_PROGRESS, COMPLETED, CANCELLED).
 * Enum columns are cast to text because this adapter cannot deserialize
 * Postgres enums through `$queryRaw`.
 */
export async function listActionsForCustomer(customerId: string): Promise<Action[]> {
  const rows = await prisma.$queryRaw<
    {
      action_id: string;
      customer_id: string;
      call_id: string | null;
      assigned_agent_id: string | null;
      assigned_agent_name: string | null;
      type: string;
      notes: string | null;
      due_date: Date | null;
      status: string;
      created_at: Date;
      completed_at: Date | null;
    }[]
  >`
    SELECT
      a."action_id",
      a."customer_id",
      a."call_id",
      a."assigned_agent_id",
      ag."name"        AS assigned_agent_name,
      a."type"::text   AS type,
      a."notes",
      a."due_date",
      a."status"::text AS status,
      a."created_at",
      a."completed_at"
    FROM "actions" a
    LEFT JOIN "agents" ag ON ag."agent_id" = a."assigned_agent_id"
    WHERE a."customer_id" = ${customerId}
    ORDER BY a."status" ASC, a."due_date" ASC, a."created_at" DESC
  `;

  return rows.map((row) => ({
    id: row.action_id,
    customerId: row.customer_id,
    callId: row.call_id,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentName: row.assigned_agent_name,
    type: row.type as Action["type"],
    notes: row.notes,
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    status: row.status as Action["status"],
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  }));
}

export async function createAction(input: CreateActionInput): Promise<Action> {
  const row = await prisma.action.create({
    data: {
      customerId: input.customerId,
      callId: input.callId ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      type: input.type ?? "FOLLOW_UP",
      notes: input.notes ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    ...actionWithAgent,
  });
  return toDomain(row);
}

export async function updateAction(id: string, patch: UpdateActionInput): Promise<Action | null> {
  const completingNow = patch.status === "COMPLETED";
  try {
    const row = await prisma.action.update({
      where: { id },
      data: {
        ...(patch.assignedAgentId !== undefined && { assignedAgentId: patch.assignedAgentId }),
        ...(patch.type !== undefined && { type: patch.type }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.dueDate !== undefined && { dueDate: patch.dueDate ? new Date(patch.dueDate) : null }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(completingNow && { completedAt: new Date() }),
      },
      ...actionWithAgent,
    });
    return toDomain(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
