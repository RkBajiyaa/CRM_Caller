/** Small formatting helpers shared by CRM UI components. Pure functions, no dependencies. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}:${String(remMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Initials for the default avatar placeholder, e.g. "Priya Sharma" -> "PS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Shortened id for compact display, e.g. table cells -- full id remains in the detail page / title attribute. */
export function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

/**
 * A plain calendar date (`YYYY-MM-DD`) that has already been resolved in
 * somebody's local timezone -- an agent-activity day bucket, say.
 *
 * Formatted in UTC on purpose. `new Date("2026-08-22")` is midnight *UTC*, so
 * handing it to `formatDate` re-interprets an already-local date as an instant
 * and shifts it back a day for every viewer west of Greenwich. This one keeps
 * the date it was given.
 */
export function formatCalendarDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
