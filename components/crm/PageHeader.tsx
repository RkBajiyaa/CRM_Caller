import Link from "next/link";
import { ReactNode } from "react";
import styles from "./PageHeader.module.css";

/** Page title row: title/subtitle on the left, actions on the right. Used by every page that isn't the searchable Customers list (which bundles its own header -- see CustomersExplorer). */
export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className={styles.header}>
      <div>
        {backHref && (
          <Link href={backHref} className={styles.back}>
            &larr; {backLabel ?? "Back"}
          </Link>
        )}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
