"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/crm/LogoutButton";
import { initials } from "@/lib/format";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  agentName: string | null;
  agentRole: "ADMIN" | "AGENT" | null;
}

/** Primary navigation. "Agents" only shows for admins (role-gated both here and, authoritatively, at the API level -- lib/auth/session.ts's requireRole). "Calls"/"Reports" remain disabled placeholders -- no standalone pages for those yet, call data lives inside the customer detail page. Client Component (not the parent Server Component layout) specifically so `usePathname()` can highlight the current section correctly now that there's more than one real link. */
export function Sidebar({ agentName, agentRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = [
    { label: "Customers", href: "/customers" as const },
    ...(agentRole === "ADMIN" ? [{ label: "Agents", href: "/agents" as const }] : []),
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>CC</span>
        <span className={styles.brandName}>Conbun CRM</span>
      </div>
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            >
              {item.label}
            </Link>
          );
        })}
        <span className={styles.navItemDisabled} aria-disabled="true">
          Calls
          <span className={styles.soon}>Soon</span>
        </span>
        <span className={styles.navItemDisabled} aria-disabled="true">
          Reports
          <span className={styles.soon}>Soon</span>
        </span>
      </nav>
      <div className={styles.footer}>
        {agentName ? (
          <div className={styles.userRow}>
            <span className={styles.userAvatar}>{initials(agentName)}</span>
            <div className={styles.userText}>
              <span className={styles.userName}>{agentName}</span>
              <span className={styles.userRole}>{agentRole === "ADMIN" ? "Admin" : "Agent"}</span>
            </div>
            <LogoutButton />
          </div>
        ) : (
          <p className={styles.footerText}>Conbun Call CRM</p>
        )}
      </div>
    </aside>
  );
}
