import type { Metadata } from "next";
import { listCustomers } from "@/lib/customers/service";
import { getMockCallStats } from "@/lib/mock-data/calls";
import { CustomersExplorer, type CustomerRow } from "@/components/crm/CustomersExplorer";

export const metadata: Metadata = { title: "Customers -- Conbun CRM" };

// This page reads mutable data (mock store today, a live database later --
// see lib/customers/service.ts). Without this, Next.js's static analysis
// would prerender it once at build time and serve that snapshot forever in
// production, so a newly-added customer would never appear without a full
// rebuild. Force per-request rendering instead.
export const dynamic = "force-dynamic";

// Server Component: fetches directly through the service layer (no
// self-HTTP round trip needed -- this *is* the backend at render time).
// Client-side mutations (Add New User) go through /api/customers instead;
// see lib/api-client/customers.ts.
export default async function CustomersPage() {
  const customers = await listCustomers();

  // Call stats have no database table yet (see lib/mock-data/calls.ts) --
  // joined here at read time the same way a real calls table eventually
  // would be (CRM_ARCHITECTURE.md #7), just against mock data for now.
  const rows: CustomerRow[] = customers.map((customer) => {
    const stats = getMockCallStats(customer.id);
    return { ...customer, totalCalls: stats.totalCalls, lastCallAt: stats.lastContactedAt };
  });

  return <CustomersExplorer rows={rows} />;
}
