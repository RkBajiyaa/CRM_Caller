/**
 * Real persistence layer -- backed by the live Neon Postgres database via
 * Prisma. This is what lib/customers/service.ts now calls; the mock store
 * (lib/customers/mock-store.ts) that previously stood in for this has been
 * removed from the app entirely (see CHANGELOG.md).
 *
 * Implements the exact same five functions the mock store did, with the
 * same signatures, so no caller (API routes, Server Components) needed to
 * change -- this file is the swap CRM_ARCHITECTURE.md always described.
 */
import { Prisma } from "@/lib/generated/prisma/client";
import type { CustomerModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from "@/lib/customers/types";

function toDomain(row: CustomerModel): Customer {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phoneNumber,
    location: row.location,
    assignedAgent: row.assignedAgent,
    accountCreatedAt: row.accountCreatedAt ? row.accountCreatedAt.toISOString() : null,
    crmEntryCreatedAt: row.crmEntryCreatedAt.toISOString(),
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function dbListCustomers(): Promise<Customer[]> {
  const rows = await prisma.customer.findMany({ orderBy: { crmEntryCreatedAt: "desc" } });
  return rows.map(toDomain);
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
  const row = await prisma.customer.create({
    data: {
      name: input.name,
      phoneNumber: input.phoneNumber,
      location: input.location ?? null,
      assignedAgent: input.assignedAgent ?? null,
      accountCreatedAt: input.accountCreatedAt ? new Date(input.accountCreatedAt) : null,
      status: input.status ?? "ACTIVE",
      notes: input.notes ?? null,
    },
  });
  return toDomain(row);
}

/** `id`/`crmEntryCreatedAt` are not accepted by UpdateCustomerInput at the type level, so there is nothing here that could touch them. */
export async function dbUpdateCustomer(id: string, patch: UpdateCustomerInput): Promise<Customer | null> {
  try {
    const row = await prisma.customer.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.phoneNumber !== undefined && { phoneNumber: patch.phoneNumber }),
        ...(patch.location !== undefined && { location: patch.location }),
        ...(patch.assignedAgent !== undefined && { assignedAgent: patch.assignedAgent }),
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
