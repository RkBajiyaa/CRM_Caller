"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Customer, CustomerStatus } from "@/lib/customers/types";
import { Avatar } from "@/components/crm/Avatar";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { StateMessage } from "@/components/crm/StateMessage";
import { CallRequestButton } from "@/components/crm/CallRequestButton";
import { CallQueueRefresher } from "@/components/crm/CallQueueRefresher";
import { HoverPrefetchLink } from "@/components/crm/HoverPrefetchLink";
import { LinkButton } from "@/components/ui/Button";
import { formatDate, formatDuration } from "@/lib/format";
import { CUSTOMER_STATUSES } from "@/lib/customers/types";
import { CALL_LIFECYCLE_LABELS, isCallLifecycleActive, type CallLifecycleState } from "@/lib/call-requests/lifecycle";
import styles from "./CustomersExplorer.module.css";

export interface CustomerRow extends Customer {
  totalCalls: number;
  lastCallAt: string | null;
  lastCallDurationSeconds: number | null;
  /** Derived server-side from this customer's open call request / last call -- see lib/call-requests/lifecycle.ts. */
  lifecycle: CallLifecycleState;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "Active",
  FOLLOW_UP: "Follow-up",
  INACTIVE: "Inactive",
  CLOSED: "Closed",
};

/**
 * The CRM Users page's interactive region: title + search + status filter +
 * "Add New User" + the customer table + pagination, all together. Search
 * and status filter are real, server-side (the URL's ?q=/?status=/?page=
 * drive app/(app)/customers/page.tsx's query) -- not client-side filtering
 * over an already-paginated slice, which would silently miss matches on
 * other pages.
 *
 * Columns are the ones an agent actually acts on -- who, what number, where,
 * when they entered the CRM, how the calling has gone, and the two buttons --
 * on one line each, no horizontal scroll, at the same 13.5px density as the
 * rest of the CRM. The customer id moved to the name's tooltip rather than
 * taking a second line in every row; it's shown in full on the detail page.
 *
 * The agent name is read straight off the customer row (`assignedAgent`, kept
 * in sync by lib/agents/service.ts and lib/customers/prisma-store.ts) rather
 * than by fetching the whole agent directory on every page load -- one fewer
 * query per render, which is the dominant cost here (see the page's comment).
 */
export function CustomersExplorer({
  rows,
  pagination,
  initialQuery,
  initialStatus,
}: {
  rows: CustomerRow[];
  pagination: Pagination;
  initialQuery: string;
  initialStatus?: CustomerStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  // Debounced URL update as the user types -- avoids a server round trip
  // per keystroke while still being real search, not a client-side filter.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (query === initialQuery) return;
      const next = new URLSearchParams(searchParams.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the debounced value itself changes
  }, [query]);

  function setStatus(status: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (status) next.set("status", status);
    else next.delete("status");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    router.push(`${pathname}?${next.toString()}`);
  }

  // Only while some row is genuinely mid-call. A quiet queue polls nothing --
  // see components/crm/CallQueueRefresher.tsx.
  const queueActive = rows.some((row) => isCallLifecycleActive(row.lifecycle));

  return (
    <div>
      <CallQueueRefresher active={queueActive} />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Customers</h1>
          <p className={styles.subtitle}>
            {pagination.total} customer{pagination.total === 1 ? "" : "s"}
          </p>
        </div>
        <div className={styles.actions}>
          <select
            className={styles.statusFilter}
            value={initialStatus ?? ""}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className={styles.search}
              placeholder="Search name, phone, location, agent..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search customers"
            />
          </div>
          <LinkButton href="/customers/new">+ Add New User</LinkButton>
        </div>
      </div>

      <div className={styles.tableCard}>
        {pagination.total === 0 && !initialQuery && !initialStatus ? (
          <StateMessage
            title="No customers yet"
            description="Add your first customer to start building the CRM record."
            action={<LinkButton href="/customers/new">+ Add New User</LinkButton>}
          />
        ) : rows.length === 0 ? (
          <StateMessage
            title="No matches"
            description={
              initialQuery
                ? `Nothing matches "${initialQuery}". Try a different name, phone number, or agent.`
                : "No customers match the selected filter."
            }
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colCustomer}>Customer</th>
                  <th className={styles.colPhone}>Phone</th>
                  <th className={styles.colLocation}>Location</th>
                  <th className={styles.colEntry}>CRM entry</th>
                  <th className={styles.colCalls}>Calls</th>
                  <th className={styles.colLastCall}>Last call</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colActions}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {/* Hover/focus arms a full prefetch of this customer's
                        detail page, so pointing at a row before clicking it
                        makes the click open immediately. Deliberately not a
                        plain <Link>, which would prefetch only the loading
                        skeleton for a dynamic route -- and deliberately not
                        eager, which would render 25 customers' call histories
                        on the server to serve one click. See
                        components/crm/HoverPrefetchLink.tsx. */}
                    <td>
                      <HoverPrefetchLink
                        href={`/customers/${row.id}`}
                        className={styles.customerCell}
                        title={`Customer ID: ${row.id}`}
                      >
                        <Avatar name={row.name} size="sm" />
                        <span className={styles.customerText}>
                          <span className={styles.nameLink}>{row.name}</span>
                          <span className={styles.customerMeta}>{row.assignedAgent ?? "Unassigned"}</span>
                        </span>
                      </HoverPrefetchLink>
                    </td>
                    <td>
                      <HoverPrefetchLink href={`/customers/${row.id}`} className={styles.phoneLink}>
                        {row.phoneNumber}
                      </HoverPrefetchLink>
                    </td>
                    <td className={styles.muted} title={row.location ?? undefined}>
                      {row.location ?? "--"}
                    </td>
                    <td className={styles.muted}>{formatDate(row.crmEntryCreatedAt)}</td>
                    <td className={styles.callsCell}>{row.totalCalls}</td>
                    <td>
                      <LastCallCell row={row} />
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className={styles.actionsCell}>
                      <CallRequestButton customerId={row.id} lifecycle={row.lifecycle} />
                      <HoverPrefetchLink href={`/customers/${row.id}`} className={styles.viewLink}>
                        View
                      </HoverPrefetchLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                <span className={styles.pageInfo}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className={styles.pageButtons}>
                  <button
                    type="button"
                    className={styles.pageButton}
                    disabled={pagination.page <= 1}
                    onClick={() => goToPage(pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={styles.pageButton}
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => goToPage(pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One line, never two: while something is actually in flight the state is
 * what matters, otherwise the date of the last call (with its duration in the
 * tooltip) is. Never invents an outcome -- a customer with no calls shows a
 * dash, not "No answer".
 */
function LastCallCell({ row }: { row: CustomerRow }) {
  if (isCallLifecycleActive(row.lifecycle)) {
    return <span className={styles.liveState}>{CALL_LIFECYCLE_LABELS[row.lifecycle]}</span>;
  }
  if (!row.lastCallAt) return <span className={styles.muted}>--</span>;

  const outcome = CALL_LIFECYCLE_LABELS[row.lifecycle];
  const duration = row.lastCallDurationSeconds ? formatDuration(row.lastCallDurationSeconds) : null;
  return (
    <span className={styles.muted} title={duration ? `${outcome} -- ${duration}` : outcome}>
      {formatDate(row.lastCallAt)}
    </span>
  );
}
