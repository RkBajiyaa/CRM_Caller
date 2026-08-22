"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACTIVITY_PRESETS, type ActivityRange } from "@/lib/agents/activity-range";
import styles from "./ActivityRangeFilter.module.css";

/**
 * Today / this week / this month / all time, plus a custom range.
 *
 * The `tz` it puts on every link is the browser's own UTC offset
 * (`Date.getTimezoneOffset()`), because "today" and "this week" are questions
 * about the viewer's calendar, not the server's -- without it an agent in IST
 * would be told their 9am call happened yesterday. Server-side rendering has
 * no timezone to read, so the very first paint resolves the default window in
 * UTC and every click after that is in local time; the only window where that
 * is visibly different is "Today", which is one click away from being correct.
 */
export function ActivityRangeFilter({
  basePath,
  range,
  tz,
}: {
  basePath: string;
  range: ActivityRange;
  /** The offset the current page was resolved with -- echoed back so a link doesn't silently change the window's meaning. */
  tz: number;
}) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(range.preset === "custom");
  const [from, setFrom] = useState(range.from ? range.from.toISOString().slice(0, 10) : "");
  const [to, setTo] = useState(
    range.to ? new Date(range.to.getTime() - 1).toISOString().slice(0, 10) : ""
  );

  // Read at render time on the client; 0 during SSR, which is exactly the
  // offset the server resolved the default window with.
  const localTz = typeof window === "undefined" ? tz : new Date().getTimezoneOffset();

  function href(preset: string) {
    const params = new URLSearchParams({ range: preset });
    if (localTz !== 0) params.set("tz", String(localTz));
    return `${basePath}?${params.toString()}`;
  }

  function applyCustom() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (localTz !== 0) params.set("tz", String(localTz));
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.presets} role="group" aria-label="Date range">
        {ACTIVITY_PRESETS.map((preset) => (
          <Link
            key={preset.value}
            href={href(preset.value)}
            className={range.preset === preset.value ? `${styles.preset} ${styles.presetActive}` : styles.preset}
          >
            {preset.label}
          </Link>
        ))}
        <button
          type="button"
          className={range.preset === "custom" ? `${styles.preset} ${styles.presetActive}` : styles.preset}
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
        >
          Custom
        </button>
      </div>

      {customOpen && (
        <div className={styles.custom}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>From</span>
            <input type="date" className={styles.date} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>To</span>
            <input type="date" className={styles.date} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className={styles.apply} onClick={applyCustom} disabled={!from && !to}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
