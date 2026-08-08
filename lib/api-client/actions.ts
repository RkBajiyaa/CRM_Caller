"use client";

import type { Action, CreateActionInput, UpdateActionInput } from "@/lib/actions/types";

/** Browser-side fetch wrappers for /api/customers/{id}/actions and /api/actions/{id} -- same pattern as lib/api-client/customers.ts. */

export interface ApiError {
  error: string;
  details?: unknown;
}

export async function createActionRequest(
  customerId: string,
  input: Omit<CreateActionInput, "customerId">
): Promise<{ data: Action } | { error: ApiError; status: number }> {
  const res = await fetch(`/api/customers/${customerId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: Action };
}

export async function updateActionRequest(
  actionId: string,
  patch: UpdateActionInput
): Promise<{ data: Action } | { error: ApiError; status: number }> {
  const res = await fetch(`/api/actions/${actionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: Action };
}
