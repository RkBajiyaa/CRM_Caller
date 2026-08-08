/**
 * Customer service -- the single seam between "where customer data comes
 * from" and everything that uses it (API routes, Server Components).
 *
 * Today: backed by lib/customers/mock-store.ts (in-memory seed data --
 * see that file's header for why). When a real Neon connection exists and
 * the initial migration is applied, this file is the only place that
 * changes: swap these five function bodies to call `prisma.customer.*`
 * (via lib/db/prisma.ts) instead of the mock-store functions. No caller
 * needs to change, since the exported function signatures and the
 * `Customer` shape they return are already what the Prisma-backed
 * versions will return too (see prisma/schema.prisma's Customer model,
 * which this mock intentionally mirrors field-for-field).
 */
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from "@/lib/customers/types";
import {
  mockListCustomers,
  mockGetCustomerById,
  mockFindCustomerByPhoneNumber,
  mockCreateCustomer,
  mockUpdateCustomer,
} from "@/lib/customers/mock-store";

export async function listCustomers(): Promise<Customer[]> {
  return mockListCustomers();
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return mockGetCustomerById(id);
}

export async function findCustomerByPhoneNumber(phoneNumber: string): Promise<Customer | null> {
  return mockFindCustomerByPhoneNumber(phoneNumber);
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return mockCreateCustomer(input);
}

export async function updateCustomer(
  id: string,
  patch: UpdateCustomerInput
): Promise<Customer | null> {
  return mockUpdateCustomer(id, patch);
}
