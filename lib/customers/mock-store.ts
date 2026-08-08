/**
 * ============================================================================
 * MOCK / SEED DATA -- NOT THE PRODUCTION DATABASE
 * ============================================================================
 *
 * This is an in-memory stand-in for the real Customer table
 * (prisma/schema.prisma already defines it), used because no live Neon
 * connection is configured yet (DATABASE_URL is still a placeholder -- see
 * CHANGELOG.md). It exists so the CRM UI can actually be viewed and tested
 * now, per explicit instruction, instead of blocking the whole UI phase on
 * database provisioning.
 *
 * State lives only in memory for the lifetime of the server process --
 * it resets on every restart and is never written to disk. Nothing here is
 * real customer data.
 *
 * Stored on `globalThis` (same reasoning as lib/db/prisma.ts's client
 * singleton): Next.js/Turbopack can instantiate a route's module graph
 * separately per route in dev, so a plain module-level `let customers = []`
 * was found NOT to be shared between app/api/customers/* and
 * app/customers/[id]/page.tsx during verification -- a customer created (or
 * even just seeded) was invisible from the other side, which is a real bug,
 * not a cosmetic one. `globalThis` is one process-wide object every module
 * graph resolves the same way, so this fixes it structurally rather than by
 * accident of import order.
 *
 * This is the ONLY file that will change when the database is connected:
 * lib/customers/service.ts re-exports this module's functions today; once
 * DATABASE_URL is real, a lib/customers/prisma-store.ts implementing the
 * exact same five functions replaces this import in service.ts (and a real
 * Postgres table has no cross-module-graph sharing problem to begin with).
 * No caller (API routes, Server Components) needs to change.
 */
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/lib/customers/types";

function seedCustomer(
  overrides: Partial<Customer> & Pick<Customer, "name" | "phoneNumber">
): Customer {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    location: null,
    assignedAgent: null,
    accountCreatedAt: null,
    crmEntryCreatedAt: now,
    status: "ACTIVE",
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function buildSeedCustomers(): Customer[] {
  return [
    seedCustomer({
      name: "Priya Sharma",
      phoneNumber: "+91 98765 43210",
      location: "Jaipur, Rajasthan",
      assignedAgent: "Rahul Bajiya",
      accountCreatedAt: daysAgo(210),
      crmEntryCreatedAt: daysAgo(180),
      status: "ACTIVE",
      notes: "Prefers evening calls after 6pm.",
    }),
    seedCustomer({
      name: "Arjun Mehta",
      phoneNumber: "+91 91234 56780",
      location: "Jaipur, Rajasthan",
      assignedAgent: "Rahul Bajiya",
      accountCreatedAt: daysAgo(95),
      crmEntryCreatedAt: daysAgo(90),
      status: "FOLLOW_UP",
      notes: "Asked for a callback about renewal pricing.",
    }),
    seedCustomer({
      name: "Sanya Kapoor",
      phoneNumber: "+91 99887 76655",
      location: "Udaipur, Rajasthan",
      assignedAgent: "Neha Verma",
      accountCreatedAt: daysAgo(340),
      crmEntryCreatedAt: daysAgo(300),
      status: "ACTIVE",
    }),
    seedCustomer({
      name: "Vikram Singh",
      phoneNumber: "+91 90000 11223",
      location: "Jodhpur, Rajasthan",
      assignedAgent: "Neha Verma",
      accountCreatedAt: daysAgo(400),
      crmEntryCreatedAt: daysAgo(60),
      status: "INACTIVE",
      notes: "No response on last 3 attempts.",
    }),
    seedCustomer({
      name: "Fatima Khan",
      phoneNumber: "+91 98123 45670",
      location: "Jaipur, Rajasthan",
      assignedAgent: "Rahul Bajiya",
      accountCreatedAt: daysAgo(30),
      crmEntryCreatedAt: daysAgo(28),
      status: "ACTIVE",
    }),
    seedCustomer({
      name: "Karan Joshi",
      phoneNumber: "+91 97001 22334",
      location: "Kota, Rajasthan",
      assignedAgent: null,
      accountCreatedAt: daysAgo(500),
      crmEntryCreatedAt: daysAgo(500),
      status: "CLOSED",
      notes: "Account closed at customer's request.",
    }),
  ];
}

const globalForMockStore = globalThis as unknown as {
  __conbunCrmMockCustomers: Customer[] | undefined;
};

// Seeded exactly once per process, regardless of how many separate module
// graphs import this file.
const customers: Customer[] = globalForMockStore.__conbunCrmMockCustomers ?? buildSeedCustomers();
globalForMockStore.__conbunCrmMockCustomers = customers;

export function mockListCustomers(): Customer[] {
  return [...customers].sort(
    (a, b) => new Date(b.crmEntryCreatedAt).getTime() - new Date(a.crmEntryCreatedAt).getTime()
  );
}

export function mockGetCustomerById(id: string): Customer | null {
  return customers.find((c) => c.id === id) ?? null;
}

export function mockFindCustomerByPhoneNumber(phoneNumber: string): Customer | null {
  const normalized = phoneNumber.replace(/[^\d+]/g, "");
  return (
    customers.find((c) => c.phoneNumber.replace(/[^\d+]/g, "") === normalized) ?? null
  );
}

export function mockCreateCustomer(input: CreateCustomerInput): Customer {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: crypto.randomUUID(),
    name: input.name,
    phoneNumber: input.phoneNumber,
    location: input.location ?? null,
    assignedAgent: input.assignedAgent ?? null,
    accountCreatedAt: input.accountCreatedAt ?? null,
    crmEntryCreatedAt: now,
    status: input.status ?? "ACTIVE",
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  customers.push(customer);
  return customer;
}

export function mockUpdateCustomer(
  id: string,
  patch: UpdateCustomerInput
): Customer | null {
  const index = customers.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const current = customers[index];
  const updated: Customer = {
    ...current,
    ...patch,
    id: current.id, // immutable
    crmEntryCreatedAt: current.crmEntryCreatedAt, // immutable
    updatedAt: new Date().toISOString(),
  };
  customers[index] = updated;
  return updated;
}
