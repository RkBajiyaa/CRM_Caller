import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import type { AgentModel } from "@/lib/generated/prisma/models";
import type { Agent, CreateAgentInput, UpdateAgentInput } from "@/lib/agents/types";

function toDomain(row: AgentModel): Agent {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAgents(): Promise<Agent[]> {
  const rows = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toDomain);
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const row = await prisma.agent.findUnique({ where: { id } });
  return row ? toDomain(row) : null;
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const passwordHash = await hashPassword(input.password);
  const row = await prisma.agent.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role ?? "AGENT",
    },
  });
  return toDomain(row);
}

export async function updateAgent(id: string, patch: UpdateAgentInput): Promise<Agent | null> {
  try {
    const row = await prisma.agent.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.role !== undefined && { role: patch.role }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
      },
    });

    // Keep the denormalized display name honest. `Customer.assignedAgent` is
    // a copy of this agent's name (see prisma/schema.prisma) that
    // lib/customers/prisma-store.ts refreshes whenever a customer's
    // assignment changes -- but renaming the agent itself used to leave every
    // already-assigned customer showing the old name until it was reassigned.
    // A second plain write, not a transaction (CLAUDE.md rule #11), and only
    // when the name actually changed. This is what lets the customers list
    // render the agent column straight from the customer row instead of
    // fetching the whole agent directory on every page load.
    if (patch.name !== undefined) {
      await prisma.customer.updateMany({
        where: { assignedAgentId: id },
        data: { assignedAgent: row.name },
      });
    }

    return toDomain(row);
  } catch {
    return null;
  }
}
