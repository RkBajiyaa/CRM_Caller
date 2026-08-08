/**
 * Shared Customer types -- used by the service layer, API routes, and UI
 * alike. Deliberately a plain TypeScript shape, not the Prisma-generated
 * type, so UI/API code never depends on Prisma internals directly (only
 * lib/customers/prisma-store.ts's implementation does). Mirrors
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
  /**
   * Denormalized display name -- kept in sync with assignedAgentId's agent
   * record on every write (see prisma/schema.prisma's comment on this
   * column). Preserved for backward compatibility with the existing UI/API
   * contract; prefer `assignedAgentId` for anything that needs the real
   * relation (permissions, "my customers" queries).
   */
  assignedAgent: string | null;
  assignedAgentId: string | null;
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
  assignedAgentId?: string | null;
  accountCreatedAt?: string | null;
  status?: CustomerStatus;
  notes?: string | null;
}

/** Partial profile edit. `id`/`crmEntryCreatedAt` are never editable. */
export type UpdateCustomerInput = Partial<
  Omit<CreateCustomerInput, "phoneNumber"> & { phoneNumber: string }
>;

export interface ListCustomersParams {
  q?: string;
  status?: CustomerStatus;
  assignedAgentId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListCustomersResult {
  data: Customer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
