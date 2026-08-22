import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActivityRange } from "@/lib/agents/activity-range";

/**
 * Agent activity: what one agent actually did, over a window of time.
 *
 * Everything here is derived from `calls` rows that Android already reports --
 * no new status is stored, nothing is inferred, and in particular **no time is
 * classified as "idle"**. The CRM knows when calls happened and how long they
 * lasted; it does not know whether the gaps were meetings, breaks or admin
 * work, and calling them idle would be inventing attendance data the system
 * has never been given (sprint item 11). If work-session data ever exists,
 * "unaccounted time" becomes computable then -- not before.
 */

export interface AgentActivityStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  rejectedCalls: number;
  failedCalls: number;
  /**
   * Calls that were started but whose outcome was never reported -- `status IS
   * NULL`. Counted and named separately rather than folded into "failed",
   * because "we have not been told yet" is a different fact from "it failed"
   * (sprint item 12), and an Android app that was offline or killed mid-call
   * produces exactly this.
   */
  unreportedCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  /** Seconds actually spent talking -- summed over ANSWERED calls only. */
  totalTalkTimeSeconds: number;
  /** Mean length of an answered call. 0 when nothing was answered. */
  averageCallSeconds: number;
  /** Distinct customers this agent called at all -- deliberately not the same number as totalCalls (sprint item 10). */
  uniqueCustomers: number;
  /** Distinct customers with at least one answered call -- customers actually reached. */
  customersReached: number;
  /** Distinct customers called but never reached. */
  customersNotReached: number;
  /** Distinct customers called more than once -- repeated attempts. */
  repeatCustomers: number;
  firstCallAt: string | null;
  lastCallAt: string | null;
}

export interface AgentActivityDay {
  /**
   * `YYYY-MM-DD` in the *viewer's* calendar, not UTC -- see the `tzOffsetMinutes`
   * argument to getAgentActivity. A plain calendar date, deliberately not an
   * instant: rendering it must not shift it again (lib/format.ts's
   * formatCalendarDate).
   */
  date: string;
  calls: number;
  answered: number;
  talkTimeSeconds: number;
  uniqueCustomers: number;
}

export interface AgentActivity {
  stats: AgentActivityStats;
  days: AgentActivityDay[];
}

const EMPTY_STATS: AgentActivityStats = {
  totalCalls: 0,
  answeredCalls: 0,
  missedCalls: 0,
  rejectedCalls: 0,
  failedCalls: 0,
  unreportedCalls: 0,
  incomingCalls: 0,
  outgoingCalls: 0,
  totalTalkTimeSeconds: 0,
  averageCallSeconds: 0,
  uniqueCustomers: 0,
  customersReached: 0,
  customersNotReached: 0,
  repeatCustomers: 0,
  firstCallAt: null,
  lastCallAt: null,
};

/** How many day-buckets the activity breakdown returns. A quarter of daily rows is plenty for a page that shows recent activity, and bounds a "custom range" of ten years. */
const MAX_ACTIVITY_DAYS = 92;

interface ActivityRow {
  kind: string;
  day: Date | null;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  rejected_calls: number;
  failed_calls: number;
  unreported_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  talk_seconds: number;
  unique_customers: number;
  customers_reached: number | null;
  repeat_customers: number | null;
  first_call_at: Date | null;
  last_call_at: Date | null;
}

/**
 * The whole agent-activity panel -- headline numbers *and* the day-by-day
 * breakdown -- in one statement.
 *
 * `UNION ALL` rather than two queries for the same reason
 * `getCustomerCallPulseInputs` uses one: this project's Neon adapter
 * serializes statements, so a second query is a second full round trip. The
 * two halves share a column set; `kind` tells them apart and the day columns
 * are typed NULLs on the totals row.
 *
 * Both halves read the same `scoped` CTE, so the totals and the daily rows can
 * never disagree about which calls are in the window. Uses the
 * `calls(agent_id, started_at)` index added alongside this pass.
 */
export async function getAgentActivity(
  agentId: string,
  range: ActivityRange,
  /**
   * The viewer's offset from UTC in minutes, as `Date.getTimezoneOffset()`
   * reports it (IST = -330). Day buckets are cut on *this* calendar, so a call
   * an agent made at 12:40am local doesn't land in the previous day's row
   * while the call list beside it prints today's date. Only the daily
   * breakdown uses it; the totals are timestamp comparisons and don't care.
   */
  tzOffsetMinutes = 0
): Promise<AgentActivity> {
  const lower = range.from ? Prisma.sql`AND "started_at" >= ${range.from}::timestamp(3)` : Prisma.empty;
  const upper = range.to ? Prisma.sql`AND "started_at" < ${range.to}::timestamp(3)` : Prisma.empty;

  const rows = await prisma.$queryRaw<ActivityRow[]>`
    WITH scoped AS (
      SELECT "call_id", "customer_id", "status"::text AS status, "direction"::text AS direction,
             "started_at", "duration_seconds",
             -- The day bucket, cut on the viewer's calendar rather than UTC.
             -- Computed once here rather than inline in the daily SELECT and
             -- again in its GROUP BY: those would be two separate bind
             -- parameters, and Postgres cannot see that two placeholders hold
             -- the same value, so it rejects the grouping.
             date_trunc('day', "started_at" - make_interval(mins => ${tzOffsetMinutes})) AS local_day
      FROM "calls"
      WHERE "agent_id" = ${agentId} ${lower} ${upper}
    ),
    per_customer AS (
      SELECT "customer_id",
             COUNT(*)::int                                        AS calls,
             COUNT(*) FILTER (WHERE status = 'ANSWERED')::int     AS answered
      FROM scoped
      GROUP BY "customer_id"
    )
    (
      SELECT
        'total'::text                                                     AS kind,
        NULL::timestamp                                                   AS day,
        COUNT(*)::int                                                     AS total_calls,
        COUNT(*) FILTER (WHERE status = 'ANSWERED')::int                  AS answered_calls,
        COUNT(*) FILTER (WHERE status = 'MISSED')::int                    AS missed_calls,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int                  AS rejected_calls,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int                    AS failed_calls,
        COUNT(*) FILTER (WHERE status IS NULL)::int                       AS unreported_calls,
        COUNT(*) FILTER (WHERE direction = 'INCOMING')::int               AS incoming_calls,
        COUNT(*) FILTER (WHERE direction = 'OUTGOING')::int               AS outgoing_calls,
        COALESCE(SUM("duration_seconds") FILTER (WHERE status = 'ANSWERED'), 0)::int AS talk_seconds,
        (SELECT COUNT(*) FROM per_customer)::int                          AS unique_customers,
        (SELECT COUNT(*) FROM per_customer WHERE answered > 0)::int       AS customers_reached,
        (SELECT COUNT(*) FROM per_customer WHERE calls > 1)::int          AS repeat_customers,
        MIN("started_at")                                                 AS first_call_at,
        MAX("started_at")                                                 AS last_call_at
      FROM scoped
    )
    UNION ALL
    (
      SELECT
        'day'::text                                                       AS kind,
        "local_day"                                                       AS day,
        COUNT(*)::int                                                     AS total_calls,
        COUNT(*) FILTER (WHERE status = 'ANSWERED')::int                  AS answered_calls,
        0, 0, 0, 0, 0, 0,
        COALESCE(SUM("duration_seconds") FILTER (WHERE status = 'ANSWERED'), 0)::int AS talk_seconds,
        COUNT(DISTINCT "customer_id")::int                                AS unique_customers,
        NULL::int, NULL::int, NULL::timestamp, NULL::timestamp
      FROM scoped
      GROUP BY "local_day"
      ORDER BY day DESC
      LIMIT ${MAX_ACTIVITY_DAYS}
    )
    ORDER BY kind ASC, day DESC NULLS FIRST
  `;

  const totalRow = rows.find((r) => r.kind === "total");
  if (!totalRow || totalRow.total_calls === 0) {
    return { stats: EMPTY_STATS, days: [] };
  }

  const uniqueCustomers = totalRow.unique_customers;
  const customersReached = totalRow.customers_reached ?? 0;

  return {
    stats: {
      totalCalls: totalRow.total_calls,
      answeredCalls: totalRow.answered_calls,
      missedCalls: totalRow.missed_calls,
      rejectedCalls: totalRow.rejected_calls,
      failedCalls: totalRow.failed_calls,
      unreportedCalls: totalRow.unreported_calls,
      incomingCalls: totalRow.incoming_calls,
      outgoingCalls: totalRow.outgoing_calls,
      totalTalkTimeSeconds: totalRow.talk_seconds,
      // Mean over answered calls, not over every call: dividing talk time by
      // calls nobody picked up would report an "average call" shorter than any
      // call that actually happened.
      averageCallSeconds:
        totalRow.answered_calls > 0 ? Math.round(totalRow.talk_seconds / totalRow.answered_calls) : 0,
      uniqueCustomers,
      customersReached,
      customersNotReached: uniqueCustomers - customersReached,
      repeatCustomers: totalRow.repeat_customers ?? 0,
      firstCallAt: totalRow.first_call_at ? totalRow.first_call_at.toISOString() : null,
      lastCallAt: totalRow.last_call_at ? totalRow.last_call_at.toISOString() : null,
    },
    days: rows
      .filter((r) => r.kind === "day" && r.day !== null)
      .map((r) => ({
        date: (r.day as Date).toISOString().slice(0, 10),
        calls: r.total_calls,
        answered: r.answered_calls,
        talkTimeSeconds: r.talk_seconds,
        uniqueCustomers: r.unique_customers,
      })),
  };
}

/**
 * Headline numbers for every agent at once -- what the Agents list shows so an
 * operator can compare the team without opening three pages.
 *
 * One statement for the whole team, for the usual reason: the obvious
 * implementation is `getAgentActivity` in a loop, which on this project's Neon
 * adapter is one serialized round trip per agent.
 */
export interface AgentSummary {
  agentId: string;
  totalCalls: number;
  answeredCalls: number;
  totalTalkTimeSeconds: number;
  uniqueCustomers: number;
  lastCallAt: string | null;
}

export async function getAgentSummaries(range: ActivityRange): Promise<Map<string, AgentSummary>> {
  const lower = range.from ? Prisma.sql`AND "started_at" >= ${range.from}::timestamp(3)` : Prisma.empty;
  const upper = range.to ? Prisma.sql`AND "started_at" < ${range.to}::timestamp(3)` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      agent_id: string;
      total_calls: number;
      answered_calls: number;
      talk_seconds: number;
      unique_customers: number;
      last_call_at: Date | null;
    }[]
  >`
    SELECT
      "agent_id",
      COUNT(*)::int                                                                AS total_calls,
      COUNT(*) FILTER (WHERE "status" = 'ANSWERED')::int                           AS answered_calls,
      COALESCE(SUM("duration_seconds") FILTER (WHERE "status" = 'ANSWERED'), 0)::int AS talk_seconds,
      COUNT(DISTINCT "customer_id")::int                                           AS unique_customers,
      MAX("started_at")                                                            AS last_call_at
    FROM "calls"
    WHERE "agent_id" IS NOT NULL ${lower} ${upper}
    GROUP BY "agent_id"
  `;

  const summaries = new Map<string, AgentSummary>();
  for (const row of rows) {
    summaries.set(row.agent_id, {
      agentId: row.agent_id,
      totalCalls: row.total_calls,
      answeredCalls: row.answered_calls,
      totalTalkTimeSeconds: row.talk_seconds,
      uniqueCustomers: row.unique_customers,
      lastCallAt: row.last_call_at ? row.last_call_at.toISOString() : null,
    });
  }
  return summaries;
}
