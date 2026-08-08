"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { label: "Customers", href: "/customers" as const },
  { label: "Agents", href: "/agents" as const },
];

/**
 * Primary navigation. No authentication in this build (see CHANGELOG.md)
 * -- both real sections are always shown, there's no login/role to gate
 * them on. "Calls"/"Reports" remain disabled placeholders -- no
 * standalone pages for those yet, call data lives inside the customer
 * detail page. Client Component so `usePathname()` can highlight the
 * current section.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>CC</span>
        <span className={styles.brandName}>Conbun CRM</span>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
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
        <p className={styles.footerText}>Conbun Call CRM</p>
      </div>
    </aside>
  );
}
