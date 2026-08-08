/**
 * Customer service -- the single seam between "where customer data comes
 * from" and everything that uses it (API routes, Server Components).
 * Backed by lib/customers/prisma-store.ts, which reads/writes the real
 * `customers` table on Neon Postgres.
 */
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersParams,
  ListCustomersResult,
} from "@/lib/customers/types";
import {
  dbListCustomers,
  dbGetCustomerById,
  dbFindCustomerByPhoneNumber,
  dbCreateCustomer,
  dbUpdateCustomer,
} from "@/lib/customers/prisma-store";

export async function listCustomers(params: ListCustomersParams = {}): Promise<ListCustomersResult> {
  return dbListCustomers(params);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return dbGetCustomerById(id);
}

export async function findCustomerByPhoneNumber(phoneNumber: string): Promise<Customer | null> {
  return dbFindCustomerByPhoneNumber(phoneNumber);
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return dbCreateCustomer(input);
}

export async function updateCustomer(
  id: string,
  patch: UpdateCustomerInput
): Promise<Customer | null> {
  return dbUpdateCustomer(id, patch);
}
