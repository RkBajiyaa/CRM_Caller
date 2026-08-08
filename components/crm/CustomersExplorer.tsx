"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Customer } from "@/lib/customers/types";
import { Avatar } from "@/components/crm/Avatar";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { DemoDataBadge } from "@/components/crm/DemoDataBadge";
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
          <div className={styles.subtitleRow}>
            <p className={styles.subtitle}>
              {rows.length} customer{rows.length === 1 ? "" : "s"}
            </p>
            <DemoDataBadge kind="customers" />
          </div>
        </div>
        <div className={styles.actions}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search name, phone, ID, agent..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
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
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Phone number</th>
                  <th>Customer ID</th>
                  <th>Location</th>
                  <th>CRM entry date</th>
                  <th>Assigned agent</th>
                  <th>Calls</th>
                  <th>Last call</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.avatarCell}>
                      <Avatar name={row.name} size="sm" />
                    </td>
                    <td>
                      <Link href={`/customers/${row.id}`} className={styles.nameLink}>
                        {row.name}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/customers/${row.id}`} className={styles.phoneLink}>
                        {row.phoneNumber}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.idCell} title={row.id}>
                        {shortId(row.id)}
                      </span>
                    </td>
                    <td className={styles.muted}>{row.location ?? "--"}</td>
                    <td className={styles.muted}>{formatDate(row.crmEntryCreatedAt)}</td>
                    <td className={styles.muted}>{row.assignedAgent ?? "Unassigned"}</td>
                    <td className={styles.muted}>{row.totalCalls}</td>
                    <td className={styles.muted}>{formatDate(row.lastCallAt)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
