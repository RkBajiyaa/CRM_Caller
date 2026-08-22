import type { Metadata } from "next";
import { listAgents } from "@/lib/agents/service";
import { getAgentSummaries } from "@/lib/agents/activity";
import {
  resolveActivityRange,
  rangeLabel,
  rangeQueryString,
  type ActivityPreset,
} from "@/lib/agents/activity-range";
import { listDevices } from "@/lib/devices/service";
import { PageHeader } from "@/components/crm/PageHeader";
import { AgentsTable } from "@/components/crm/AgentsTable";
import { DevicesTable } from "@/components/crm/DevicesTable";
import { ActivityRangeFilter } from "@/components/crm/ActivityRangeFilter";
import { Card, CardHeader } from "@/components/ui/Card";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Agents -- Conbun CRM" };
export const dynamic = "force-dynamic";

const PRESETS = new Set<ActivityPreset>(["today", "week", "month", "all", "custom"]);

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The Agent section.
 *
 * Two things in one page, because they are two halves of the same question --
 * who is calling, and from which phone. No authentication in this build (see
 * CHANGELOG.md), so this is open like every other page.
 *
 * Three queries for the whole page, whatever the team size: the agent
 * directory, one grouped activity query covering every agent at once, and the
 * device list. Deliberately not "activity per agent in a loop" -- this
 * project's Neon adapter serializes statements, so that would be one round
 * trip per agent (see lib/agents/activity.ts).
 */
export default async function AgentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rangeParam = one(params.range);
  const preset = rangeParam && PRESETS.has(rangeParam as ActivityPreset) ? (rangeParam as ActivityPreset) : undefined;
  const tzRaw = Number(one(params.tz));
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 840 ? tzRaw : 0;
  const range = resolveActivityRange(preset, one(params.from), one(params.to), tz);

  const agents = await listAgents();
  const summaries = await getAgentSummaries(range);
  const devices = await listDevices();

  const deviceCounts = new Map<string, number>();
  for (const device of devices) {
    if (device.agentId) deviceCounts.set(device.agentId, (deviceCounts.get(device.agentId) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Who is calling, from which phone, and what that adds up to."
        actions={<ActivityRangeFilter basePath="/agents" range={range} tz={tz} />}
      />

      <div className={styles.layout}>
        <Card padded={false}>
          <div className={styles.sectionHeader}>
            <CardHeader
              title="Team"
              subtitle={`Call activity ${rangeLabel(range).toLowerCase()} -- open an agent for their full breakdown`}
            />
          </div>
          <AgentsTable
            agents={agents}
            summaries={summaries}
            deviceCounts={deviceCounts}
            rangeLabel={rangeLabel(range)}
            rangeQuery={rangeQueryString(range, tz)}
          />
        </Card>

        <Card padded={false}>
          <div className={styles.sectionHeader}>
            <CardHeader
              title="Devices"
              subtitle="Each phone running Conbun Call. Assigning a device to an agent is what routes that agent's call requests to it."
            />
          </div>
          <DevicesTable devices={devices} agents={agents} />
        </Card>
      </div>
    </div>
  );
}
