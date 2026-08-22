"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { label: "Customers", href: "/customers" as const },
  { label: "Calls", href: "/calls" as const },
  { label: "Agents", href: "/agents" as const },
];

/**
 * Primary navigation. No authentication in this build (see CHANGELOG.md)
 * -- every real section is always shown, there's no login/role to gate
 * them on. "Calls" is a real section now (team-wide call activity over a
 * date window); "Reports" stays a disabled placeholder, because agent
 * reporting lives inside the Agents section and there is no separate
 * reporting page to link to yet. Client Component so `usePathname()` can
 * highlight the current section.
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
