import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCustomers, createCustomer, findCustomerByPhoneNumber } from "@/lib/customers/service";
import { createCustomerSchema } from "@/lib/customers/validation";

/**
 * GET /api/customers?q=<search>
 * Lists customers, optionally filtered by name/phone/id substring match.
 * Currently backed by mock data (lib/customers/mock-store.ts) -- see that
 * file's header. Response shape is what the real backend will return too.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const customers = await listCustomers();
  const filtered = q
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phoneNumber.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      )
    : customers;
  return NextResponse.json({ data: filtered });
}

/**
 * POST /api/customers
 * Creates a customer. `id` and `crmEntryCreatedAt` are always generated
 * here, never accepted from the request body (CLAUDE.md rule #5).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const existing = await findCustomerByPhoneNumber(parsed.data.phoneNumber);
  if (existing) {
    return NextResponse.json(
      { error: "A customer with this phone number already exists.", customerId: existing.id },
      { status: 409 }
    );
  }

  const customer = await createCustomer(parsed.data);
  return NextResponse.json({ data: customer }, { status: 201 });
}
