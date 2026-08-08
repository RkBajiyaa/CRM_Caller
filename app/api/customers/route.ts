import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCustomers, createCustomer, findCustomerByPhoneNumber } from "@/lib/customers/service";
import { createCustomerSchema } from "@/lib/customers/validation";
import { requireAuth } from "@/lib/auth/session";
import { CUSTOMER_STATUSES, type CustomerStatus } from "@/lib/customers/types";

/**
 * GET /api/customers?q=&status=&assignedAgentId=&page=&pageSize=
 * Lists customers with server-side search/filter/pagination. Backed by the
 * real `customers` table on Neon Postgres via lib/customers/service.ts.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const result = await listCustomers({
    q: params.get("q")?.trim() || undefined,
    status: status && (CUSTOMER_STATUSES as string[]).includes(status) ? (status as CustomerStatus) : undefined,
    assignedAgentId: params.get("assignedAgentId")?.trim() || undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
  });
  return NextResponse.json(result);
}

/**
 * POST /api/customers
 * Creates a customer. `id` and `crmEntryCreatedAt` are always generated
 * here, never accepted from the request body (CLAUDE.md rule #5).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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
