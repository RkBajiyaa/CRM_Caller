import styles from "./TableSkeleton.module.css";

/** Minimal loading placeholder for the customers table -- rendered by app/customers/loading.tsx while the server fetch is in flight. One subtle CSS pulse, nothing more elaborate. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading customers">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <div className={`${styles.bar} ${styles.avatar}`} />
          <div className={`${styles.bar} ${styles.wide}`} />
          <div className={`${styles.bar} ${styles.medium}`} />
          <div className={`${styles.bar} ${styles.narrow}`} />
        </div>
      ))}
    </div>
  );
}
