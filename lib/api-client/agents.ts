"use client";

import type { Agent, CreateAgentInput, UpdateAgentInput } from "@/lib/agents/types";

export interface ApiError {
  error: string;
  details?: unknown;
}

export async function createAgentRequest(
  input: CreateAgentInput
): Promise<{ data: Agent } | { error: ApiError; status: number }> {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: Agent };
}

export async function updateAgentRequest(
  id: string,
  patch: UpdateAgentInput
): Promise<{ data: Agent } | { error: ApiError; status: number }> {
  const res = await fetch(`/api/agents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: Agent };
}
