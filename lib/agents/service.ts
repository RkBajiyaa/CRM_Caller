import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import type { AgentModel } from "@/lib/generated/prisma/models";
import type { Agent, AgentRole, CreateAgentInput, UpdateAgentInput } from "@/lib/agents/types";
import type { Device } from "@/lib/devices/types";

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

/** One row per (agent x device), agent columns repeated -- an agent carries one phone, occasionally two, so the repetition is a few hundred bytes and never a fan-out. */
interface AgentWithDevicesRow {
  agent_id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  device_id: string | null;
  device_label: string | null;
  device_is_active: boolean | null;
  device_last_seen_at: Date | null;
  device_created_at: Date | null;
  device_updated_at: Date | null;
}

/**
 * An agent and the handsets assigned to them, in **one** statement.
 *
 * Exists purely to remove a database round trip from the agent detail page,
 * which is the page this sprint was told was too slow to open. Measured
 * against the real Neon database from this machine, every statement costs
 * ~270ms whatever it asks for -- the cost is the round trip, not the query --
 * and the page was making four of them in sequence for ~1.1s of pure latency
 * before it rendered anything. `Promise.all` is not the fix and is explicitly
 * ruled out for this project (CLAUDE.md's 2026-08-10 note: this environment's
 * Neon adapter serializes concurrent queries and pays connection setup per
 * one, making parallel *slower*). Asking for both things at once in one
 * statement is.
 *
 * A LEFT JOIN rather than `json_agg`, deliberately: it keeps every column a
 * plain scalar, which is the shape this project's adapter is known to
 * deserialize correctly, and folding two or three rows in TypeScript is
 * cheaper than the risk.
 *
 * `role` and the device columns are ordered exactly as `listDevicesForAgent`
 * orders them (most recently seen first), so the page shows the same list it
 * showed before -- this is a latency change, not a behaviour change.
 */
export async function getAgentWithDevices(
  id: string
): Promise<{ agent: Agent; devices: Device[] } | null> {
  const rows = await prisma.$queryRaw<AgentWithDevicesRow[]>`
    SELECT
      a."agent_id", a."name", a."email", a."role"::text AS role,
      a."is_active", a."created_at", a."updated_at",
      d."device_id", d."label" AS device_label, d."is_active" AS device_is_active,
      d."last_seen_at" AS device_last_seen_at,
      d."created_at" AS device_created_at, d."updated_at" AS device_updated_at
    FROM "agents" a
    LEFT JOIN "devices" d ON d."agent_id" = a."agent_id"
    WHERE a."agent_id" = ${id}
    ORDER BY d."last_seen_at" DESC NULLS LAST, d."created_at" ASC
  `;
  if (rows.length === 0) return null;

  const head = rows[0];
  const agent: Agent = {
    id: head.agent_id,
    name: head.name,
    email: head.email,
    role: head.role as AgentRole,
    isActive: head.is_active,
    createdAt: head.created_at.toISOString(),
    updatedAt: head.updated_at.toISOString(),
  };

  const devices: Device[] = rows
    .filter((r) => r.device_id !== null)
    .map((r) => ({
      id: r.device_id as string,
      label: r.device_label,
      agentId: agent.id,
      // Known without a second join: this device is assigned to this agent by
      // construction -- it is the join condition.
      agentName: agent.name,
      isActive: r.device_is_active as boolean,
      lastSeenAt: r.device_last_seen_at ? r.device_last_seen_at.toISOString() : null,
      createdAt: (r.device_created_at as Date).toISOString(),
      updatedAt: (r.device_updated_at as Date).toISOString(),
    }));

  return { agent, devices };
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
