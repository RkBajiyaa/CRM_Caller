import type { Metadata } from "next";
import { getCallActivity, listCalls, CALL_HISTORY_PAGE_SIZE } from "@/lib/calls/service";
import {
  resolveActivityRange,
  rangeLabel,
  type ActivityPreset,
} from "@/lib/agents/activity-range";
import { PageHeader } from "@/components/crm/PageHeader";
import { StatCard } from "@/components/crm/StatCard";
import { CallsTable } from "@/components/crm/CallsTable";
import { ActivityRangeFilter } from "@/components/crm/ActivityRangeFilter";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatDateTime, formatDuration } from "@/lib/format";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Calls -- Conbun CRM" };
export const dynamic = "force-dynamic";

const PRESETS = new Set<ActivityPreset>(["today", "week", "month", "all", "custom"]);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** How many calls the list shows. The numbers above it always cover the whole window. */
const CALLS_PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Calls section -- every agent's call activity, in one window of time.
 *
 * The team-wide view of what the Agent page shows for one person, and it reads
 * the same way on purpose: the same date filter (Today / This week / This
 * month / All time / Custom), the same stat strip, the same call table.
 *
 * **Two queries for the whole page**, whatever the volume: one aggregate over
 * every call in the window, and one bounded list. Sequential on purpose --
 * `Promise.all` is measurably slower on this project's Neon adapter (CLAUDE.md,
 * 2026-08-10), so fewer statements is the only lever there is.
 *
 * Every number comes from `calls` rows Android actually reported. Nothing is
 * modelled: there is no "idle time", no "utilisation", no projected figure. A
 * call whose outcome was never reported is counted as exactly that, and calls
 * with no agent recorded are shown as a number rather than quietly divided up.
 */
export default async function CallsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rangeParam = one(params.range);
  const preset = rangeParam && PRESETS.has(rangeParam as ActivityPreset) ? (rangeParam as ActivityPreset) : undefined;
  const tzRaw = Number(one(params.tz));
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 840 ? tzRaw : 0;
  const range = resolveActivityRange(preset, one(params.from), one(params.to), tz);

  const stats = await getCallActivity(range.from, range.to);
  const calls = await listCalls(range.from, range.to, CALLS_PAGE_SIZE);

  const window = rangeLabel(range);
  const listTruncated = stats.totalCalls > calls.length;

  return (
    <div>
      <PageHeader
        title="Calls"
        subtitle="Every call reported by the Conbun Call app, newest first."
        actions={<ActivityRangeFilter basePath="/calls" range={range} tz={tz} />}
      />

      <div className={styles.layout}>
        <Card>
          <CardHeader
            title={`Call activity — ${window.toLowerCase()}`}
            subtitle="Counted over every call in the window, not just the ones listed below"
          />
          <div className={styles.statsGrid}>
            <StatCard label="Total calls" value={stats.totalCalls} />
            <StatCard label="Answered" value={stats.answeredCalls} hint={`${stats.customersReached} customers reached`} />
            <StatCard label="Missed" value={stats.missedCalls} />
            <StatCard
              label="Talk time"
              value={formatDuration(stats.totalTalkTimeSeconds)}
              hint="answered calls only"
            />
            <StatCard
              label="Avg call"
              value={formatDuration(stats.averageCallSeconds)}
              hint="answered calls only"
            />
            <StatCard label="Customers" value={stats.uniqueCustomers} hint="unique, contacted" />
          </div>

          <div className={styles.secondaryGrid}>
            <StatCard label="Outgoing" value={stats.outgoingCalls} compact />
            <StatCard label="Incoming" value={stats.incomingCalls} compact />
            <StatCard label="Rejected" value={stats.rejectedCalls} compact />
            <StatCard label="Failed" value={stats.failedCalls} compact />
            <StatCard
              label="No outcome yet"
              value={stats.unreportedCalls}
              hint="started, never reported"
              compact
            />
            <StatCard label="Agents calling" value={stats.activeAgents} compact />
          </div>

          <p className={styles.note}>
            {stats.totalCalls > 0 ? (
              <>
                First call {formatDateTime(stats.firstCallAt)} &middot; last call{" "}
                {formatDateTime(stats.lastCallAt)}.
                {stats.activeDevices > 0 && (
                  <>
                    {" "}
                    {stats.activeDevices} device{stats.activeDevices === 1 ? "" : "s"} reported calls in this
                    period.
                  </>
                )}
                {stats.unattributedCalls > 0 && (
                  <>
                    {" "}
                    {stats.unattributedCalls} call{stats.unattributedCalls === 1 ? "" : "s"} arrived with no agent
                    recorded &mdash; counted here, but not on any agent&rsquo;s page.
                  </>
                )}
              </>
            ) : (
              <>No calls were reported in this period.</>
            )}
          </p>
        </Card>

        <Card padded={false}>
          <div className={styles.sectionHeader}>
            <CardHeader
              title="Call log"
              subtitle={
                listTruncated
                  ? `Latest ${calls.length} of ${stats.totalCalls} calls in this period — the numbers above cover all of them`
                  : `Every call reported ${window.toLowerCase()}`
              }
            />
          </div>
          <CallsTable
            calls={calls}
            showAgent
            emptyTitle="No calls in this period"
            emptyDescription="Nothing was reported by any device in the selected date range."
          />
          {listTruncated && (
            <p className={styles.historyNote}>
              Showing the {CALLS_PAGE_SIZE} most recent calls. Narrow the date range to see others. (A
              customer&rsquo;s own page lists up to {CALL_HISTORY_PAGE_SIZE} of their calls at a time.)
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
