"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Customer, CustomerStatus } from "@/lib/customers/types";
import type { Agent } from "@/lib/agents/types";
import { Avatar } from "@/components/crm/Avatar";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { StateMessage } from "@/components/crm/StateMessage";
import { LinkButton } from "@/components/ui/Button";
import { formatDate, shortId } from "@/lib/format";
import { CUSTOMER_STATUSES } from "@/lib/customers/types";
import styles from "./CustomersExplorer.module.css";

export interface CustomerRow extends Customer {
  totalCalls: number;
  lastCallAt: string | null;
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
 * Column set is deliberately narrow (Customer / Phone / Agent / Calls /
 * Last contact / Status / Actions) so it fits a normal desktop viewport
 * without horizontal scrolling. Customer ID lives in a secondary line +
 * tooltip on the Customer cell instead of its own column; location and CRM
 * entry date live on the detail page only.
 */
export function CustomersExplorer({
  rows,
  agents,
  pagination,
  initialQuery,
  initialStatus,
}: {
  rows: CustomerRow[];
  agents: Agent[];
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

  const agentById = new Map(agents.map((a) => [a.id, a]));

  return (
    <div>
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
              placeholder="Search name, phone, agent..."
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
                  <th className={styles.colAgent}>Agent</th>
                  <th className={styles.colCalls}>Calls</th>
                  <th className={styles.colLastContact}>Last contact</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={styles.colActions}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/customers/${row.id}`} className={styles.customerCell}>
                        <Avatar name={row.name} size="sm" />
                        <span className={styles.customerText}>
                          <span className={styles.nameLink}>{row.name}</span>
                          <span className={styles.customerMeta} title={row.id}>
                            {shortId(row.id)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/customers/${row.id}`} className={styles.phoneLink}>
                        {row.phoneNumber}
                      </Link>
                    </td>
                    <td className={styles.muted}>
                      {row.assignedAgentId ? (agentById.get(row.assignedAgentId)?.name ?? row.assignedAgent) : "Unassigned"}
                    </td>
                    <td className={styles.callsCell}>{row.totalCalls}</td>
                    <td className={styles.muted}>{formatDate(row.lastCallAt)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className={styles.actionsCell}>
                      <Link href={`/customers/${row.id}`} className={styles.viewLink}>
                        View
                      </Link>
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
