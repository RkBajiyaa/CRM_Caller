import type { Metadata } from "next";
import { listCustomers } from "@/lib/customers/service";
import { getCustomerCallOverviews } from "@/lib/calls/service";
import { callLifecycleState } from "@/lib/call-requests/lifecycle";
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
//
// Query budget matters more than it looks: this project's Neon adapter
// effectively serializes queries (measured -- four trivial queries take ~1.0s
// sequentially and ~2.6s wrapped in Promise.all), so page latency is close to
// `round-trip latency x number of queries` and parallelism is not an escape
// hatch. Rendering a page of customers is therefore held to a fixed three
// queries regardless of page size: the customers, their count, and one batched
// per-customer call/request overview. It was 2 + 25 before 2026-08-10, then 4;
// the fourth (a separate open-call-request lookup) is now a LATERAL inside the
// overview query, since it was keyed by the same page of customer ids.
export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = params.status as CustomerStatus | undefined;
  const page = params.page ? Number(params.page) : 1;

  const result = await listCustomers({ q, status, page });
  const customerIds = result.data.map((customer) => customer.id);

  // Call activity + current open call request for the whole page in one query,
  // instead of a full call-history fetch per row.
  const overviews = await getCustomerCallOverviews(customerIds);

  const rows: CustomerRow[] = result.data.map((customer) => {
    const overview = overviews.get(customer.id);
    const summary = overview?.summary;
    const openRequest = overview?.openRequest;
    return {
      ...customer,
      totalCalls: summary?.totalCalls ?? 0,
      lastCallAt: summary?.lastCallAt ?? null,
      lastCallDurationSeconds: summary?.lastCallDurationSeconds ?? null,
      // An open request (Android hasn't finished with it) describes the
      // current state; otherwise the last call's own outcome does.
      lifecycle: openRequest
        ? callLifecycleState(openRequest.status, undefined, false)
        : summary
          ? callLifecycleState(null, summary.lastCallStatus, true)
          : "NONE",
    };
  });

  return (
    <CustomersExplorer
      rows={rows}
      pagination={{ page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages }}
      initialQuery={q ?? ""}
      initialStatus={status}
    />
  );
}
