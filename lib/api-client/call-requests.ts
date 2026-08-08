"use client";

import type { CallRequest } from "@/lib/call-requests/types";

/** Browser-side fetch wrapper for POST /api/call-requests -- the CRM "Call" button. Same pattern as lib/api-client/customers.ts. */

export interface ApiError {
  error: string;
  details?: unknown;
}

export async function createCallRequest(
  customerId: string
): Promise<{ data: CallRequest } | { error: ApiError; status: number }> {
  const res = await fetch("/api/call-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
  const body = await res.json();
  if (!res.ok) return { error: body as ApiError, status: res.status };
  return body as { data: CallRequest };
}
