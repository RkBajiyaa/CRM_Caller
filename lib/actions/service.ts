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

/** Follow-ups for one customer, soonest-due first (CRM_ARCHITECTURE.md Phase 8 -- "Reach out again" / "Follow up tomorrow" etc.). */
export async function listActionsForCustomer(customerId: string): Promise<Action[]> {
  const rows = await prisma.action.findMany({
    where: { customerId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    ...actionWithAgent,
  });
  return rows.map(toDomain);
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
