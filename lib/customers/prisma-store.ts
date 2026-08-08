/**
 * Real persistence layer -- backed by the live Neon Postgres database via
 * Prisma. lib/customers/service.ts calls this; there is no mock customer
 * data anywhere in the app.
 *
 * Implements the same function shapes the earlier mock store did, so no
 * caller (API routes, Server Components) needed to change when this
 * replaced it -- this file is the swap CRM_ARCHITECTURE.md always
 * described.
 */
import { Prisma } from "@/lib/generated/prisma/client";
import type { CustomerModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersParams,
  ListCustomersResult,
} from "@/lib/customers/types";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toDomain(row: CustomerModel): Customer {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phoneNumber,
    location: row.location,
    assignedAgent: row.assignedAgent,
    assignedAgentId: row.assignedAgentId,
    accountCreatedAt: row.accountCreatedAt ? row.accountCreatedAt.toISOString() : null,
    crmEntryCreatedAt: row.crmEntryCreatedAt.toISOString(),
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Looks up an agent's current name for denormalizing into Customer.assignedAgent -- see that column's schema comment. Returns null (clears the display field) if the id doesn't resolve to a real agent, rather than silently keeping a stale name. */
async function resolveAgentName(assignedAgentId: string | null | undefined): Promise<string | null> {
  if (!assignedAgentId) return null;
  const agent = await prisma.agent.findUnique({ where: { id: assignedAgentId }, select: { name: true } });
  return agent?.name ?? null;
}

export async function dbListCustomers(params: ListCustomersParams): Promise<ListCustomersResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.CustomerWhereInput = {
    ...(params.status && { status: params.status }),
    ...(params.assignedAgentId && { assignedAgentId: params.assignedAgentId }),
    ...(params.q && {
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { phoneNumber: { contains: params.q, mode: "insensitive" } },
        { location: { contains: params.q, mode: "insensitive" } },
        { assignedAgent: { contains: params.q, mode: "insensitive" } },
      ],
    }),
  };

  // Two independent queries instead of Prisma's $transaction([...]) -- this
  // environment's Neon adapter can't open the WebSocket session interactive
  // transactions need (see CHANGELOG.md); plain sequential queries avoid it
  // and a page count being off by one row for a split second is harmless.
  const [rows, total] = [
    await prisma.customer.findMany({
      where,
      orderBy: { crmEntryCreatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    await prisma.customer.count({ where }),
  ];

  return {
    data: rows.map(toDomain),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function dbGetCustomerById(id: string): Promise<Customer | null> {
  const row = await prisma.customer.findUnique({ where: { id } });
  return row ? toDomain(row) : null;
}

export async function dbFindCustomerByPhoneNumber(phoneNumber: string): Promise<Customer | null> {
  const row = await prisma.customer.findUnique({ where: { phoneNumber } });
  return row ? toDomain(row) : null;
}

/** `id` and `crmEntryCreatedAt` are never set here -- the schema's `@default(uuid())` / `@default(now())` generate them (CLAUDE.md rule #5). */
export async function dbCreateCustomer(input: CreateCustomerInput): Promise<Customer> {
  const assignedAgent = await resolveAgentName(input.assignedAgentId);
  const row = await prisma.customer.create({
    data: {
      name: input.name,
      phoneNumber: input.phoneNumber,
      location: input.location ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      assignedAgent,
      accountCreatedAt: input.accountCreatedAt ? new Date(input.accountCreatedAt) : null,
      status: input.status ?? "ACTIVE",
      notes: input.notes ?? null,
    },
  });
  return toDomain(row);
}

/** `id`/`crmEntryCreatedAt` are not accepted by UpdateCustomerInput at the type level, so there is nothing here that could touch them. */
export async function dbUpdateCustomer(id: string, patch: UpdateCustomerInput): Promise<Customer | null> {
  const assignedAgent =
    patch.assignedAgentId !== undefined ? await resolveAgentName(patch.assignedAgentId) : undefined;

  try {
    const row = await prisma.customer.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.phoneNumber !== undefined && { phoneNumber: patch.phoneNumber }),
        ...(patch.location !== undefined && { location: patch.location }),
        ...(patch.assignedAgentId !== undefined && { assignedAgentId: patch.assignedAgentId, assignedAgent }),
        ...(patch.accountCreatedAt !== undefined && {
          accountCreatedAt: patch.accountCreatedAt ? new Date(patch.accountCreatedAt) : null,
        }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
      },
    });
    return toDomain(row);
  } catch (error) {
    // P2025 = "record to update not found" -- return null like the rest of
    // this service's "not found" contract, instead of letting a Prisma
    // error type leak out of this module.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
