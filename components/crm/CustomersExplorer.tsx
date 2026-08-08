"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Customer } from "@/lib/customers/types";
import { Avatar } from "@/components/crm/Avatar";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { StateMessage } from "@/components/crm/StateMessage";
import { LinkButton } from "@/components/ui/Button";
import { formatDate, shortId } from "@/lib/format";
import styles from "./CustomersExplorer.module.css";

export interface CustomerRow extends Customer {
  totalCalls: number;
  lastCallAt: string | null;
}

/**
 * The CRM Users page's interactive region: title + search + "Add New User"
 * + the customer table, all together so search state has one owner. Takes
 * the already-fetched rows as a prop (fetched server-side in
 * app/customers/page.tsx via lib/customers/service.ts) and only filters
 * client-side -- no extra network round trip for something this small.
 *
 * Column set is deliberately narrow (Customer / Phone / Agent / Calls /
 * Last contact / Status / Actions) so it fits a normal desktop viewport
 * without horizontal scrolling. Customer ID lives in a secondary line +
 * tooltip on the Customer cell instead of its own column; location and CRM
 * entry date live on the detail page only.
 */
export function CustomersExplorer({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phoneNumber.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.location ?? "").toLowerCase().includes(q) ||
        (r.assignedAgent ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Customers</h1>
          <p className={styles.subtitle}>
            {rows.length} customer{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className={styles.actions}>
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
        {rows.length === 0 ? (
          <StateMessage
            title="No customers yet"
            description="Add your first customer to start building the CRM record."
            action={<LinkButton href="/customers/new">+ Add New User</LinkButton>}
          />
        ) : filtered.length === 0 ? (
          <StateMessage
            title="No matches"
            description={`Nothing matches "${query}". Try a different name, phone number, or agent.`}
          />
        ) : (
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
              {filtered.map((row) => (
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
                  <td className={styles.muted}>{row.assignedAgent ?? "Unassigned"}</td>
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
        )}
      </div>
    </div>
  );
}
