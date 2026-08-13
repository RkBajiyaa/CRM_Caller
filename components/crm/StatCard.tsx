import styles from "./StatCard.module.css";

/**
 * `compact` is a denser variant of the same card -- same border, same label
 * treatment, smaller value. It exists so a six-across stat strip (the Customer
 * Detail page's "Call activity") can sit above the call history without
 * out-shouting it; the default size is unchanged for every other caller.
 */
export function StatCard({
  label,
  value,
  hint,
  compact = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className={[styles.card, compact && styles.compact].filter(Boolean).join(" ")}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value} title={String(value)}>
        {value}
      </p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
