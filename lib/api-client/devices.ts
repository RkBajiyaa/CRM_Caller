"use client";

import type { Device, UpdateDeviceInput } from "@/lib/devices/types";

/** Browser-side fetch wrappers for the devices endpoints. Same pattern as lib/api-client/agents.ts. */

export interface ApiError {
  error: string;
  details?: unknown;
}

export async function updateDeviceRequest(
  id: string,
  patch: UpdateDeviceInput
): Promise<{ data: Device } | { error: ApiError; status: number }> {
  const res = await fetch(`/api/devices/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: Device };
}

export async function registerDeviceRequest(input: {
  id: string;
  label?: string | null;
  agentId?: string | null;
}): Promise<{ data: Device } | { error: ApiError; status: number }> {
  const res = await fetch("/api/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: Device };
}
