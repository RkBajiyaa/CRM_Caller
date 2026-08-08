"use client";

import type { Customer, CreateCustomerInput } from "@/lib/customers/types";

/**
 * Browser-side fetch wrappers for /api/customers/*. This is the only way
 * Client Components (the Add New User form, any future inline edit) talk
 * to customer data -- never a direct import of lib/customers/service.ts,
 * which is server-only. Server Components fetch customer data directly
 * via the service layer instead (see app/customers/page.tsx) since they
 * already run on the server; this file exists for the interactive paths.
 */

export interface ApiError {
  error: string;
  details?: unknown;
}

export async function createCustomerRequest(
  input: CreateCustomerInput
): Promise<{ data: Customer } | { error: ApiError; status: number }> {
  const res = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) {
    return { error: body as ApiError, status: res.status };
  }
  return body as { data: Customer };
}
