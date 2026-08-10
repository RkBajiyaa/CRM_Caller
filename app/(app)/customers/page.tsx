import type { Metadata } from "next";
import { listCustomers } from "@/lib/customers/service";
import { getCallSummariesForCustomers } from "@/lib/calls/service";
import { getOpenCallRequestsForCustomers } from "@/lib/call-requests/service";
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
// hatch. Rendering a page of customers is therefore held to a fixed four
// queries regardless of page size: the customers, their count, one batched
// call summary, and one batched open-call-request lookup. It used to be
// 2 + 25 -- see CHANGELOG.md 2026-08-10.
export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = params.status as CustomerStatus | undefined;
  const page = params.page ? Number(params.page) : 1;

  const result = await listCustomers({ q, status, page });
  const customerIds = result.data.map((customer) => customer.id);

  // Call activity for the whole page in one query each, instead of a full
  // call-history fetch per row.
  const summaries = await getCallSummariesForCustomers(customerIds);
  const openRequests = await getOpenCallRequestsForCustomers(customerIds);

  const rows: CustomerRow[] = result.data.map((customer) => {
    const summary = summaries.get(customer.id);
    const openRequest = openRequests.get(customer.id);
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
