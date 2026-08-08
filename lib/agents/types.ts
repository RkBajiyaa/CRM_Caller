/** Shared Agent types. Never includes passwordHash -- that never leaves lib/agents/service.ts's internal Prisma queries. */

export type AgentRole = "ADMIN" | "AGENT";

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: AgentRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  email: string;
  password: string;
  role?: AgentRole;
}

export interface UpdateAgentInput {
  name?: string;
  role?: AgentRole;
  isActive?: boolean;
}
