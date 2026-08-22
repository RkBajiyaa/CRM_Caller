import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgentWithDevices } from "@/lib/agents/service";
import { getAgentActivity } from "@/lib/agents/activity";
import { resolveActivityRange, rangeLabel, type ActivityPreset } from "@/lib/agents/activity-range";
import { listCallsForAgent, CALL_HISTORY_PAGE_SIZE } from "@/lib/calls/service";
import { isDeviceOnline } from "@/lib/devices/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { Avatar } from "@/components/crm/Avatar";
import { StatCard } from "@/components/crm/StatCard";
import { CallsTable } from "@/components/crm/CallsTable";
import { ActivityRangeFilter } from "@/components/crm/ActivityRangeFilter";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCalendarDate, formatDateTime, formatDuration } from "@/lib/format";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

const PRESETS = new Set<ActivityPreset>(["today", "week", "month", "all", "custom"]);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// generateMetadata and the page body both need the agent, and Next.js runs
// them as two separate calls -- same reasoning as the customer detail page.
// The devices ride along in the same statement (see getAgentWithDevices), so
// this one cached call covers what used to be two round trips.
const getAgent = cache(getAgentWithDevices);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const found = await getAgent(id);
  return { title: found ? `${found.agent.name} -- Conbun CRM` : "Agent not found -- Conbun CRM" };
}

/**
 * Agent activity.
 *
 * Everything here is counted from `calls` rows Android already reports.
 * Nothing is invented -- and specifically, the time between calls is **not**
 * reported as idle time: the CRM has no attendance or work-session data, and
 * labelling unexplained gaps as idleness would be presenting a guess as a
 * measurement (sprint item 11).
 *
 * **Three** queries for the page: the agent *and their devices* in one
 * statement, one statement covering both the headline numbers and the daily
 * breakdown, and the call list. It was four; every statement costs ~270ms
 * against Neon from outside Vercel whatever it asks for, so removing one is a
 * real quarter off the page's time to first byte and not a rearrangement. They
 * stay sequential on purpose -- `Promise.all` is measurably *slower* on this
 * project's adapter (CLAUDE.md, 2026-08-10), so fewer queries is the only
 * lever there is.
 *
 * The aggregate numbers are computed in Postgres over *every* call in the
 * window; the list below them is bounded, so the two are not the same set and
 * the page says so.
 */
export default async function AgentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const search = await searchParams;

  const found = await getAgent(id);
  if (!found) notFound();
  const { agent, devices } = found;

  const rangeParam = one(search.range);
  const preset = rangeParam && PRESETS.has(rangeParam as ActivityPreset) ? (rangeParam as ActivityPreset) : undefined;
  const tzRaw = Number(one(search.tz));
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 840 ? tzRaw : 0;
  const range = resolveActivityRange(preset, one(search.from), one(search.to), tz);

  const { stats, days } = await getAgentActivity(id, range, tz);
  const calls = await listCallsForAgent(id, range.from, range.to);

  const listTruncated = stats.totalCalls > calls.length;
  const window = rangeLabel(range);

  return (
    <div>
      <PageHeader
        title={agent.name}
        backHref="/agents"
        backLabel="Agents"
        subtitle={`${agent.email} · ${agent.role === "ADMIN" ? "Admin" : "Agent"}`}
        actions={<ActivityRangeFilter basePath={`/agents/${agent.id}`} range={range} tz={tz} />}
      />

      <div className={styles.layout}>
        <Card className={styles.identity}>
          <div className={styles.identityHead}>
            <Avatar name={agent.name} size="md" />
            <div className={styles.identityText}>
              <div className={styles.identityNameRow}>
                <h2 className={styles.name}>{agent.name}</h2>
                <Badge tone={agent.isActive ? "success" : "neutral"}>
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className={styles.email}>{agent.email}</p>
            </div>
            <div className={styles.devices}>
              <span className={styles.devicesLabel}>Devices</span>
              {devices.length === 0 ? (
                <span className={styles.devicesEmpty}>
                  None assigned &mdash; call requests for this agent&rsquo;s customers stay unrouted
                </span>
              ) : (
                <ul className={styles.deviceList}>
                  {devices.map((device) => (
                    <li key={device.id} className={styles.deviceItem}>
                      <span className={styles.deviceName}>{device.label ?? device.id}</span>
                      <span className={styles.deviceId}>{device.id}</span>
                      {!device.isActive ? (
                        <Badge tone="neutral">Retired</Badge>
                      ) : isDeviceOnline(device.lastSeenAt) ? (
                        <Badge tone="success">Online</Badge>
                      ) : (
                        <Badge tone="neutral">
                          {device.lastSeenAt ? `Last seen ${formatDateTime(device.lastSeenAt)}` : "Never seen"}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Call activity"
            subtitle={`${window} · every call in the window, not just the ones listed below`}
          />
          <div className={styles.statsGrid}>
            <StatCard label="Total calls" value={stats.totalCalls} compact />
            <StatCard label="Answered" value={stats.answeredCalls} compact />
            <StatCard label="Missed" value={stats.missedCalls} compact />
            <StatCard label="Failed" value={stats.failedCalls} compact />
            <StatCard label="Talk time" value={formatDuration(stats.totalTalkTimeSeconds)} compact />
            <StatCard
              label="Avg call"
              value={formatDuration(stats.averageCallSeconds)}
              hint="answered calls only"
              compact
            />
            <StatCard label="Customers" value={stats.uniqueCustomers} hint="unique, contacted" compact />
            <StatCard
              label="Rejected"
              value={stats.rejectedCalls}
              hint={stats.unreportedCalls > 0 ? `${stats.unreportedCalls} not yet reported` : undefined}
              compact
            />
          </div>
          <p className={styles.note}>
            {stats.firstCallAt ? (
              <>
                First call {formatDateTime(stats.firstCallAt)} &middot; last call{" "}
                {formatDateTime(stats.lastCallAt)} &middot; {stats.outgoingCalls} outgoing,{" "}
                {stats.incomingCalls} incoming.
                {stats.unreportedCalls > 0 && (
                  <>
                    {" "}
                    {stats.unreportedCalls} call{stats.unreportedCalls === 1 ? "" : "s"} started but never reported
                    an outcome &mdash; not yet received, not failed.
                  </>
                )}
              </>
            ) : (
              <>No calls recorded for this agent in this period.</>
            )}
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Customer reach"
            subtitle="Total calls and unique customers are deliberately different numbers"
          />
          <div className={styles.statsGrid}>
            <StatCard label="Customers contacted" value={stats.uniqueCustomers} compact />
            <StatCard label="Reached" value={stats.customersReached} hint="answered at least once" compact />
            <StatCard label="Not reached" value={stats.customersNotReached} hint="called, never answered" compact />
            <StatCard label="Called more than once" value={stats.repeatCustomers} compact />
            <StatCard
              label="Calls per customer"
              value={stats.uniqueCustomers > 0 ? (stats.totalCalls / stats.uniqueCustomers).toFixed(1) : "--"}
              compact
            />
            <StatCard label="Total calls" value={stats.totalCalls} compact />
          </div>
        </Card>

        {days.length > 0 && (
          <Card padded={false}>
            <div className={styles.sectionHeader}>
              <CardHeader title="Day by day" subtitle={`Activity per day, ${window.toLowerCase()}`} />
            </div>
            <table className={styles.daysTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className={styles.num}>Calls</th>
                  <th className={styles.num}>Answered</th>
                  <th className={styles.num}>Customers</th>
                  <th className={styles.num}>Talk time</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date}>
                    <td>{formatCalendarDate(day.date)}</td>
                    <td className={styles.num}>{day.calls}</td>
                    <td className={styles.num}>{day.answered}</td>
                    <td className={styles.num}>{day.uniqueCustomers}</td>
                    <td className={styles.num}>{formatDuration(day.talkTimeSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card padded={false}>
          <div className={styles.sectionHeader}>
            <CardHeader
              title="Calls"
              subtitle={
                listTruncated
                  ? `Latest ${calls.length} of ${stats.totalCalls} calls in this period -- the counts above cover all of them`
                  : `Every call this agent made or took ${window.toLowerCase()}`
              }
            />
          </div>
          <CallsTable calls={calls} />
          {listTruncated && (
            <p className={styles.historyNote}>
              Showing the {CALL_HISTORY_PAGE_SIZE} most recent calls. Narrow the date range to see others.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
