/**
 * Shared Customer types -- used by the service layer, API routes, and UI
 * alike. Deliberately a plain TypeScript shape, not the Prisma-generated
 * type, so UI/API code never depends on Prisma internals directly (only
 * lib/customers/service.ts's implementation does). Mirrors
 * prisma/schema.prisma's Customer model field-for-field; dates are ISO
 * strings here since this shape crosses the API/JSON boundary.
 */

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "FOLLOW_UP" | "CLOSED";

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "FOLLOW_UP",
  "CLOSED",
];

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
  location: string | null;
  assignedAgent: string | null;
  /** Application/account creation date -- distinct from crmEntryCreatedAt. */
  accountCreatedAt: string | null;
  /** Backend-generated at creation time. Never "last login". */
  crmEntryCreatedAt: string;
  status: CustomerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Add New User input. Deliberately excludes `id` and `crmEntryCreatedAt` --
 * both are always generated server-side (CLAUDE.md rule #5), never accepted
 * from a client.
 */
export interface CreateCustomerInput {
  name: string;
  phoneNumber: string;
  location?: string | null;
  assignedAgent?: string | null;
  accountCreatedAt?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

/** Partial profile edit. `id`/`crmEntryCreatedAt` are never editable. */
export type UpdateCustomerInput = Partial<
  Omit<CreateCustomerInput, "phoneNumber"> & { phoneNumber: string }
>;
