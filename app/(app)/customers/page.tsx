import type { Metadata } from "next";
import { listCustomers } from "@/lib/customers/service";
import { getCallStatsForCustomer } from "@/lib/calls/service";
import { listAgents } from "@/lib/agents/service";
import { CustomersExplorer, type CustomerRow } from "@/components/crm/CustomersExplorer";
import type { CustomerStatus } from "@/lib/customers/types";

export const metadata: Metadata = { title: "Customers -- Conbun CRM" };

// This page reads live, mutable data from Postgres (lib/customers/service.ts).
// Without this, Next.js's static analysis would prerender it once at build
// time and serve that snapshot forever in production, so a newly-added
// customer would never appear without a full rebuild. Force per-request
// rendering instead.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

// Server Component: fetches directly through the service layer (no
// self-HTTP round trip needed -- this *is* the backend at render time).
// Client-side mutations (Add New User) go through /api/customers instead;
// see lib/api-client/customers.ts. Search/status filter/pagination are all
// real, server-side, driven by the URL (?q=&status=&page=) so a browser
// refresh or shared link reproduces the same view.
export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = params.status as CustomerStatus | undefined;
  const page = params.page ? Number(params.page) : 1;

  const [result, agents] = [
    await listCustomers({ q, status, page }),
    await listAgents(),
  ];

  // Call stats have their own real table now (lib/calls/service.ts) --
  // joined here at read time (CRM_ARCHITECTURE.md #7). One query per row
  // on this page (max 25) rather than a batch aggregate -- simplest thing
  // that works at V1 scale; revisit if the customer list grows enough for
  // this to matter.
  const rows: CustomerRow[] = await Promise.all(
    result.data.map(async (customer) => {
      const stats = await getCallStatsForCustomer(customer.id);
      return { ...customer, totalCalls: stats.totalCalls, lastCallAt: stats.lastContactedAt };
    })
  );

  return (
    <CustomersExplorer
      rows={rows}
      agents={agents}
      pagination={{ page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages }}
      initialQuery={q ?? ""}
      initialStatus={status}
    />
  );
}
