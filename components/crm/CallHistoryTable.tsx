import type { Call } from "@/lib/calls/types";
import type { Action } from "@/lib/actions/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StateMessage } from "@/components/crm/StateMessage";
import { formatDateTime, formatDuration } from "@/lib/format";
import styles from "./CallHistoryTable.module.css";

const DIRECTION_LABEL: Record<Call["direction"], string> = {
  INCOMING: "Incoming",
  OUTGOING: "Outgoing",
};

const CALL_STATUS_BADGE: Record<NonNullable<Call["status"]>, { label: string; tone: BadgeTone }> = {
  ANSWERED: { label: "Answered", tone: "success" },
  MISSED: { label: "Missed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  FAILED: { label: "Failed", tone: "danger" },
};

const PROCESSING_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  DONE: { label: "Available", tone: "accent" },
  PROCESSING: { label: "Processing", tone: "warning" },
  PENDING: { label: "Pending", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};

const ACTION_STATUS_LABEL: Record<Action["status"], string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/**
 * Real call history -- backed by lib/calls/service.ts (the `calls` table),
 * not mock data. Recording/transcript/AI-summary each show their real
 * processingStatus as a badge, never fabricated content -- "Not available
 * yet" for AI summary is not a placeholder string, it's what the API
 * genuinely reports when no summary has been submitted
 * (CRM_ARCHITECTURE.md Phase 7).
 */
export function CallHistoryTable({ calls, actionsByCallId }: { calls: Call[]; actionsByCallId: Map<string, Action> }) {
  if (calls.length === 0) {
    return <StateMessage title="No calls yet" description="No call history recorded for this customer." />;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.colWhen}>Date / time</th>
          <th className={styles.colAgent}>Agent</th>
          <th className={styles.colDirection}>Direction</th>
          <th className={styles.colStatus}>Status</th>
          <th className={styles.colDuration}>Duration</th>
          <th className={styles.colBadge}>Recording</th>
          <th className={styles.colBadge}>Transcript</th>
          <th className={styles.colBadge}>AI summary</th>
          <th className={styles.colFollowUp}>Follow-up</th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => {
          const action = actionsByCallId.get(call.id);
          const recordingBadge = call.hasRecording ? PROCESSING_BADGE.DONE : PROCESSING_BADGE.PENDING;
          const transcriptBadge = call.transcriptStatus ? PROCESSING_BADGE[call.transcriptStatus] : PROCESSING_BADGE.PENDING;
          const summaryBadge = call.aiSummaryStatus ? PROCESSING_BADGE[call.aiSummaryStatus] : PROCESSING_BADGE.PENDING;
          return (
            <tr key={call.id}>
              <td>{formatDateTime(call.startedAt)}</td>
              <td className={styles.muted}>{call.agentName ?? "Unassigned"}</td>
              <td className={styles.muted}>{DIRECTION_LABEL[call.direction]}</td>
              <td>
                {call.status ? (
                  <Badge tone={CALL_STATUS_BADGE[call.status].tone}>{CALL_STATUS_BADGE[call.status].label}</Badge>
                ) : (
                  <Badge tone="warning">In progress</Badge>
                )}
              </td>
              <td className={styles.muted}>{call.status === "ANSWERED" ? formatDuration(call.durationSeconds) : "--"}</td>
              <td>
                <Badge tone={call.hasRecording ? "accent" : "neutral"}>{recordingBadge.label === "Available" ? "Available" : "None"}</Badge>
              </td>
              <td>
                <Badge tone={transcriptBadge.tone}>{transcriptBadge.label}</Badge>
              </td>
              <td>
                <Badge tone={summaryBadge.tone}>{call.aiSummaryStatus === "DONE" ? "Available" : "Not available yet"}</Badge>
              </td>
              <td className={styles.muted}>{action ? ACTION_STATUS_LABEL[action.status] : "--"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
