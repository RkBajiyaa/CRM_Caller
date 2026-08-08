import { initials } from "@/lib/format";
import styles from "./Avatar.module.css";

/**
 * Blank/default profile picture placeholder -- initials on a neutral
 * background, no image upload exists yet. Same component at every size so
 * the table and detail-page avatars are visually consistent.
 */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={[styles.avatar, styles[size]].join(" ")} aria-hidden="true">
      {initials(name)}
    </div>
  );
}
