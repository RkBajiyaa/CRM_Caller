import styles from "./Badge.module.css";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "accent";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={[styles.badge, styles[tone]].join(" ")}>{children}</span>;
}
