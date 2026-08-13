import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers/service";
import { getCustomerCallOverview, CALL_HISTORY_PAGE_SIZE } from "@/lib/calls/service";
import { listCallRequestsForCustomer } from "@/lib/call-requests/service";
import { listActionsForCustomer } from "@/lib/actions/service";
import { CALL_LIFECYCLE_LABELS, isCallLifecycleActive } from "@/lib/call-requests/lifecycle";
import { callActivityPulse, callToPulse, requestToPulse } from "@/lib/calls/pulse";
import { CallActivityRefresher } from "@/components/crm/CallActivityRefresher";
import { PageHeader } from "@/components/crm/PageHeader";
import { Avatar } from "@/components/crm/Avatar";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { StatCard } from "@/components/crm/StatCard";
import { CallHistoryTable } from "@/components/crm/CallHistoryTable";
import { CallRequestButton } from "@/components/crm/CallRequestButton";
import { FollowUpList } from "@/components/crm/FollowUpList";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Same reasoning as app/customers/page.tsx -- reads mutable data, must not
// be statically cached across requests.
export const dynamic = "force-dynamic";

// generateMetadata and the page component both need the customer, and Next.js
// runs them as two separate calls -- without this they were two identical
// database round trips for one page view. React's `cache` memoizes per
// request, so the second call is free; it does not cache across requests, so
// nothing goes stale.
const getCustomer = cache(getCustomerById);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomer(id);
  return { title: customer ? `${customer.name} -- Conbun CRM` : "Customer not found -- Conbun CRM" };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  // All real data -- calls/recordings/transcripts/AI-summary status come from
  // the actual `calls`/`recordings`/`transcripts`/`ai_summaries` tables
  // (lib/calls/service.ts). A brand new customer legitimately has zero calls;
  // the empty state below reflects that honestly instead of showing sample
  // data.
  //
  // Four queries for the whole page, whatever the customer's history looks
  // like: the customer, one joined call-history-plus-stats query, the recent
  // call requests, and the follow-ups. It was eleven before this pass --
  // Prisma issues one extra statement per `include`d relation and this
  // project's Neon adapter serializes them, so the five relations a call needs
  // cost five extra round trips per call query (see lib/calls/service.ts).
  const { calls, stats, truncated } = await getCustomerCallOverview(id);
  const callRequests = await listCallRequestsForCustomer(id);
  const actions = await listActionsForCustomer(id);
  const actionsByCallId = new Map(actions.filter((a) => a.callId).map((a) => [a.callId as string, a]));

  // What this customer's calling is doing right now, and whether anything is
  // still expected to arrive -- both derived from the two records already
  // fetched above (see lib/calls/pulse.ts, which wraps the same
  // lib/call-requests/lifecycle.ts derivation the customers list uses). No new
  // status is stored anywhere, and this costs no additional query: the page
  // stays at the four it was.
  //
  // `pulse.active` is what decides whether this page watches for updates at
  // all. Computing it here, from the same records the refresher's endpoint
  // reads, is what lets the two agree on "unchanged" without the page paying
  // for a fifth round trip to ask.
  const latestRequest = callRequests[0] ?? null;
  const pulse = callActivityPulse(calls.map(callToPulse), callRequests.map(requestToPulse));
  const lifecycle = pulse.lifecycle;
  const lifecycleLive = isCallLifecycleActive(lifecycle);

  return (
    <div>
      {/* Renders nothing. Watches for this customer's call state changing --
          outcome, recording, transcript, summary -- and refreshes the page
          when it actually does, so the active-call workflow never needs a
          manual browser refresh. Polls only while `active`, and stops on its
          own; see components/crm/CallActivityRefresher.tsx. */}
      <CallActivityRefresher customerId={customer.id} version={pulse.version} active={pulse.active} />

      <PageHeader
        title={customer.name}
        backHref="/customers"
        backLabel="Customers"
        actions={<CallRequestButton customerId={customer.id} lifecycle={lifecycle} size="md" />}
      />

      <div className={styles.layout}>
        {/* Identity strip. Deliberately one compact band across the top rather
            than the tall sticky sidebar card this used to be: the profile
            fields are reference data an agent glances at, while the call
            information below is what the page is actually for, and the sidebar
            was taking a quarter of the width away from it on every screen. */}
        <Card className={styles.identity}>
          <div className={styles.identityHead}>
            <Avatar name={customer.name} size="md" />
            <div className={styles.identityText}>
              <div className={styles.identityNameRow}>
                <h2 className={styles.name}>{customer.name}</h2>
                <StatusBadge status={customer.status} />
              </div>
              <a href={`tel:${customer.phoneNumber}`} className={styles.phone}>
                {customer.phoneNumber}
              </a>
            </div>
            {latestRequest && (
              <div className={styles.requestState}>
                <span className={[styles.requestLabel, lifecycleLive && styles.requestLive].filter(Boolean).join(" ")}>
                  {CALL_LIFECYCLE_LABELS[lifecycle]}
                </span>
                <span className={styles.requestMeta}>
                  Requested {formatDateTime(latestRequest.requestedAt)} &middot; queue {latestRequest.status}
                  {latestRequest.callId ? " · linked to a call" : ""}
                </span>
              </div>
            )}
          </div>

          <dl className={styles.identityFields}>
            <ProfileField label="Assigned agent" value={customer.assignedAgent ?? "Unassigned"} />
            <ProfileField label="Location" value={customer.location ?? "--"} />
            <ProfileField label="CRM entry" value={formatDate(customer.crmEntryCreatedAt)} />
            <ProfileField label="Account created" value={formatDate(customer.accountCreatedAt)} />
            <ProfileField label="Customer ID" value={customer.id} mono />
          </dl>

          {customer.notes && (
            <p className={styles.notes}>
              <span className={styles.notesLabel}>Notes</span>
              {customer.notes}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Call activity" subtitle="Across every recorded call, not just the ones listed below" />
          <div className={styles.statsGrid}>
            <StatCard label="Total calls" value={stats.totalCalls} compact />
            <StatCard label="Answered" value={stats.answeredCalls} compact />
            <StatCard label="Missed" value={stats.missedCalls} compact />
            <StatCard label="Outgoing" value={stats.outgoingCalls} compact />
            <StatCard label="Talk time" value={formatDuration(stats.totalConversationSeconds)} compact />
            <StatCard
              label="Last contacted"
              value={stats.lastContactedAt ? formatDate(stats.lastContactedAt) : "Never"}
              hint={stats.lastContactedByAgent ? `by ${stats.lastContactedByAgent}` : undefined}
              compact
            />
          </div>
        </Card>

        <Card padded={false}>
          <div className={styles.historyHeader}>
            <CardHeader
              title="Call history"
              subtitle={
                truncated
                  ? `Latest ${calls.length} of ${stats.totalCalls} calls -- open a row for timings, recording, transcript and summary`
                  : "Open a row for timings, recording, transcript and summary"
              }
              action={<CallRequestButton customerId={customer.id} lifecycle={lifecycle} />}
            />
          </div>
          <CallHistoryTable calls={calls} actionsByCallId={actionsByCallId} customerName={customer.name} />
          {truncated && (
            <p className={styles.historyNote}>
              Showing the {CALL_HISTORY_PAGE_SIZE} most recent calls. The counts above cover all {stats.totalCalls}.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Follow-ups" subtitle="Reach-outs, callbacks, and other pending actions for this customer" />
          <FollowUpList actions={actions} customerId={customer.id} />
        </Card>
      </div>
    </div>
  );
}

function ProfileField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.field}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={[styles.fieldValue, mono && styles.mono].filter(Boolean).join(" ")} title={value}>
        {value}
      </dd>
    </div>
  );
}
