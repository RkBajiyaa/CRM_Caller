/**
 * Date-window vocabulary for agent activity: the presets, the resolved range,
 * and the arithmetic that turns one into the other.
 *
 * **Deliberately free of any database import.** This module is reached from a
 * Client Component (components/crm/ActivityRangeFilter.tsx), and the sibling
 * lib/agents/activity.ts imports Prisma -- so keeping these pure functions in
 * their own file is what stops the Neon driver (and `node:module` with it)
 * being pulled into the browser bundle. Same split, for the same reason, as
 * lib/calls/pulse.ts against lib/calls/service.ts.
 */

export type ActivityPreset = "today" | "week" | "month" | "all" | "custom";

export const ACTIVITY_PRESETS: { value: ActivityPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export interface ActivityRange {
  preset: ActivityPreset;
  /** Inclusive lower bound. Null = no lower bound ("all time"). */
  from: Date | null;
  /** Exclusive upper bound. Null = no upper bound. */
  to: Date | null;
}

/**
 * Turns a preset (or an explicit from/to pair) into absolute instants.
 *
 * `tzOffsetMinutes` is the viewer's offset from UTC, as `Date.getTimezoneOffset()`
 * reports it (i.e. **minutes behind UTC**: IST is -330). It exists because
 * "today" and "this week" are questions about somebody's local calendar, and a
 * server rendering them in UTC would tell an agent in India that their 9am
 * call happened yesterday. The client filter sends its own offset; the default
 * of 0 (UTC) only applies to a request that didn't say, and is what the very
 * first server render uses.
 *
 * `week` starts Monday -- a working week, not a US calendar week.
 */
export function resolveActivityRange(
  preset: ActivityPreset | undefined,
  fromParam?: string | null,
  toParam?: string | null,
  tzOffsetMinutes = 0,
  now: Date = new Date()
): ActivityRange {
  if (preset === "custom" || (!preset && (fromParam || toParam))) {
    const from = fromParam ? parseBoundary(fromParam, tzOffsetMinutes, false) : null;
    const to = toParam ? parseBoundary(toParam, tzOffsetMinutes, true) : null;
    return { preset: "custom", from, to };
  }

  const chosen: ActivityPreset = preset ?? "month";
  if (chosen === "all") return { preset: "all", from: null, to: null };

  // Shift into the viewer's local clock, find the boundary there, shift back.
  const offsetMs = tzOffsetMinutes * 60_000;
  const local = new Date(now.getTime() - offsetMs);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());

  let localStart: number;
  if (chosen === "today") {
    localStart = localMidnight;
  } else if (chosen === "week") {
    // getUTCDay(): 0 = Sunday. Monday-based, so Sunday is 6 days into the week.
    const dayOfWeek = (new Date(localMidnight).getUTCDay() + 6) % 7;
    localStart = localMidnight - dayOfWeek * 86_400_000;
  } else {
    localStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  }

  return { preset: chosen, from: new Date(localStart + offsetMs), to: null };
}

/**
 * A custom-range boundary. Accepts a bare `YYYY-MM-DD` (interpreted in the
 * viewer's local day, with `endOfDay` pushing it to the following midnight so
 * the range is inclusive of the day the agent typed) or any full ISO instant,
 * which is taken at face value.
 */
function parseBoundary(value: string, tzOffsetMinutes: number, endOfDay: boolean): Date | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [y, m, d] = value.split("-").map(Number);
  const localMidnight = Date.UTC(y, m - 1, d + (endOfDay ? 1 : 0));
  return new Date(localMidnight + tzOffsetMinutes * 60_000);
}

/** Human label for a resolved range -- shared by the pages so the heading and the filter always agree. */
export function rangeLabel(range: ActivityRange): string {
  if (range.preset === "custom") {
    const from = range.from ? range.from.toISOString().slice(0, 10) : "the beginning";
    const to = range.to ? new Date(range.to.getTime() - 1).toISOString().slice(0, 10) : "now";
    return `${from} to ${to}`;
  }
  return ACTIVITY_PRESETS.find((p) => p.value === range.preset)?.label ?? "This month";
}

/** The current range as a query string, for carrying the window across a navigation. */
export function rangeQueryString(range: ActivityRange, tz: number): string {
  const params = new URLSearchParams();
  if (range.preset === "custom") {
    if (range.from) params.set("from", range.from.toISOString().slice(0, 10));
    if (range.to) params.set("to", new Date(range.to.getTime() - 1).toISOString().slice(0, 10));
  } else {
    params.set("range", range.preset);
  }
  if (tz !== 0) params.set("tz", String(tz));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
