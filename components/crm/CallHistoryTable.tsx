import { Fragment } from "react";
import type { Call } from "@/lib/calls/types";
import type { Action } from "@/lib/actions/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StateMessage } from "@/components/crm/StateMessage";
import { callStatusToLifecycle, CALL_LIFECYCLE_LABELS } from "@/lib/call-requests/lifecycle";
import { formatDateTime, formatDuration } from "@/lib/format";
import styles from "./CallHistoryTable.module.css";

const DIRECTION_LABEL: Record<Call["direction"], string> = {
  INCOMING: "In",
  OUTGOING: "Out",
};

const CALL_STATUS_BADGE: Record<NonNullable<Call["status"]>, { label: string; tone: BadgeTone }> = {
  ANSWERED: { label: "Connected", tone: "success" },
  MISSED: { label: "Missed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  FAILED: { label: "Failed", tone: "danger" },
};

const TRANSCRIPT_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  DONE: { label: "Ready", tone: "accent" },
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
 * not mock data. Every cell reflects what Android actually reported: a call
 * with no outcome yet shows "In progress" rather than a guess, a call with no
 * recording shows "None" rather than a placeholder, and the AI summary column
 * says "Not available yet" because that is genuinely what the API reports
 * when no summary has been submitted (CRM_ARCHITECTURE.md Phase 7).
 *
 * The transcript is shown, not just counted: when Android's Whisper pipeline
 * has uploaded text (POST /api/calls/{id}/transcript), the row expands to
 * reveal it. Collapsed by default so a long transcript can't push the rest of
 * the history off the screen.
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
          <th className={styles.colDirection}>Dir</th>
          <th className={styles.colStatus}>Outcome</th>
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
          const transcriptBadge = call.transcriptStatus
            ? (TRANSCRIPT_BADGE[call.transcriptStatus] ?? TRANSCRIPT_BADGE.PENDING)
            : TRANSCRIPT_BADGE.PENDING;
          // Prefer the recording's own reported duration when there is one --
          // it's what the file actually contains, which can differ from the
          // call-log duration Android reports for the call itself.
          const durationSeconds = call.durationSeconds || call.recordingDurationSeconds || 0;
          const hasTranscriptText = Boolean(call.transcriptText && call.transcriptText.trim());

          return (
            <Fragment key={call.id}>
            <tr className={hasTranscriptText ? styles.rowWithTranscript : undefined}>
              <td>{formatDateTime(call.startedAt)}</td>
              <td className={styles.muted}>{call.agentName ?? "Unassigned"}</td>
              <td className={styles.muted}>{DIRECTION_LABEL[call.direction]}</td>
              <td>
                {call.status ? (
                  <Badge tone={CALL_STATUS_BADGE[call.status].tone}>{CALL_STATUS_BADGE[call.status].label}</Badge>
                ) : (
                  <Badge tone="warning">{CALL_LIFECYCLE_LABELS[callStatusToLifecycle(null)]}</Badge>
                )}
              </td>
              <td className={styles.muted}>{durationSeconds > 0 ? formatDuration(durationSeconds) : "--"}</td>
              <td>
                <Badge tone={call.hasRecording ? "accent" : "neutral"}>{call.hasRecording ? "Available" : "None"}</Badge>
              </td>
              <td>
                <Badge tone={hasTranscriptText ? "accent" : transcriptBadge.tone}>
                  {hasTranscriptText ? "Ready" : transcriptBadge.label}
                </Badge>
              </td>
              <td>
                <Badge tone={call.aiSummaryStatus === "DONE" ? "accent" : "neutral"}>
                  {call.aiSummaryStatus === "DONE" ? "Available" : "Not available yet"}
                </Badge>
              </td>
              <td className={styles.muted}>{action ? ACTION_STATUS_LABEL[action.status] : "--"}</td>
            </tr>
            {hasTranscriptText && (
              // Its own full-width row rather than something crammed into the
              // Transcript cell: a transcript is prose, and the cells above
              // are single-line fixed-width by design.
              <tr className={styles.transcriptRow}>
                <td colSpan={9}>
                  <details className={styles.transcript}>
                    <summary className={styles.transcriptSummary}>
                      Transcript
                      {call.transcriptLanguage ? ` (${call.transcriptLanguage})` : ""}
                    </summary>
                    <p className={styles.transcriptText}>{call.transcriptText}</p>
                  </details>
                </td>
              </tr>
            )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
