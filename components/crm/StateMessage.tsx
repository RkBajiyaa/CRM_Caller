import { ReactNode } from "react";
import styles from "./StateMessage.module.css";

/** Shared shell for empty / error / loading messages inside a table or panel area, so all three read as one consistent visual language rather than three different ad hoc treatments. */
export function StateMessage({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className={[styles.wrap, tone === "danger" && styles.danger].filter(Boolean).join(" ")}>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
