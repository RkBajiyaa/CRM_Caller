import Link from "next/link";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { label: "Customers", href: "/customers", active: true },
  { label: "Calls", href: null, active: false },
  { label: "Reports", href: null, active: false },
  { label: "Settings", href: null, active: false },
];

/** Static primary navigation. Only "Customers" is a real, built section this phase -- the rest are shown, disabled, to communicate where the product is headed without faking pages that don't exist yet. */
export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>CC</span>
        <span className={styles.brandName}>Conbun CRM</span>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) =>
          item.href ? (
            <Link key={item.label} href={item.href} className={`${styles.navItem} ${styles.navItemActive}`}>
              {item.label}
            </Link>
          ) : (
            <span key={item.label} className={styles.navItemDisabled} aria-disabled="true">
              {item.label}
              <span className={styles.soon}>Soon</span>
            </span>
          )
        )}
      </nav>
      <div className={styles.footer}>
        <p className={styles.footerText}>Conbun Call CRM</p>
        <p className={styles.footerVersion}>Phase 2 -- v0.1.0</p>
      </div>
    </aside>
  );
}
