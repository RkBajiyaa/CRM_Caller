import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers/service";
import { listCallsForCustomer, getCallStatsForCustomer } from "@/lib/calls/service";
import { listActionsForCustomer } from "@/lib/actions/service";
import { PageHeader } from "@/components/crm/PageHeader";
import { Avatar } from "@/components/crm/Avatar";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { StatCard } from "@/components/crm/StatCard";
import { CallHistoryTable } from "@/components/crm/CallHistoryTable";
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomerById(id);
  return { title: customer ? `${customer.name} -- Conbun CRM` : "Customer not found -- Conbun CRM" };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  // All real data now -- calls/recordings/transcripts/AI-summary status
  // come from the actual `calls`/`recordings`/`transcripts`/`ai_summaries`
  // tables (lib/calls/service.ts), not the earlier mock module. A brand
  // new customer legitimately has zero calls; the empty state below
  // reflects that honestly instead of showing sample data.
  const [calls, stats, actions] = [
    await listCallsForCustomer(id),
    await getCallStatsForCustomer(id),
    await listActionsForCustomer(id),
  ];
  const actionsByCallId = new Map(actions.filter((a) => a.callId).map((a) => [a.callId as string, a]));

  return (
    <div>
      <PageHeader title={customer.name} backHref="/customers" backLabel="Customers" />

      <div className={styles.layout}>
        <Card className={styles.profileCard}>
          <div className={styles.profileHead}>
            <Avatar name={customer.name} size="lg" />
            <div className={styles.profileHeadText}>
              <h2 className={styles.name}>{customer.name}</h2>
              <a href={`tel:${customer.phoneNumber}`} className={styles.phone}>
                {customer.phoneNumber}
              </a>
              <div className={styles.statusRow}>
                <StatusBadge status={customer.status} />
              </div>
            </div>
          </div>

          <dl className={styles.fieldGrid}>
            <ProfileField label="Customer ID" value={customer.id} mono />
            <ProfileField label="Assigned agent" value={customer.assignedAgent ?? "Unassigned"} />
            <ProfileField label="Location" value={customer.location ?? "--"} />
            <ProfileField label="Account created" value={formatDate(customer.accountCreatedAt)} />
            <ProfileField label="CRM entry date" value={formatDate(customer.crmEntryCreatedAt)} />
          </dl>

          {customer.notes && (
            <div className={styles.notes}>
              <p className={styles.notesLabel}>Notes</p>
              <p className={styles.notesBody}>{customer.notes}</p>
            </div>
          )}
        </Card>

        <div className={styles.mainColumn}>
          <Card>
            <CardHeader title="Call activity" subtitle="Summary across all recorded calls" />
            <div className={styles.statsGrid}>
              <StatCard label="Total calls" value={stats.totalCalls} />
              <StatCard label="Answered" value={stats.answeredCalls} />
              <StatCard label="Missed" value={stats.missedCalls} />
              <StatCard label="Outgoing" value={stats.outgoingCalls} />
              <StatCard label="Total talk time" value={formatDuration(stats.totalConversationSeconds)} />
              <StatCard
                label="Last contacted"
                value={stats.lastContactedAt ? formatDateTime(stats.lastContactedAt) : "Never"}
                hint={stats.lastContactedByAgent ? `by ${stats.lastContactedByAgent}` : undefined}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Follow-ups" subtitle="Reach-outs, callbacks, and other pending actions for this customer" />
            <FollowUpList actions={actions} customerId={customer.id} />
          </Card>

          <Card padded={false}>
            <div className={styles.historyHeader}>
              <CardHeader
                title="Call history"
                subtitle="Recording, transcript, and AI summary availability per call"
              />
            </div>
            <CallHistoryTable calls={calls} actionsByCallId={actionsByCallId} />
          </Card>
        </div>
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
