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
    return toDomain(row);
  } catch {
    return null;
  }
}
