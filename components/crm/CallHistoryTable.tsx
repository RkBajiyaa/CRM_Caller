import type { CallRecord } from "@/lib/mock-data/calls";
import { Badge } from "@/components/ui/Badge";
import { StateMessage } from "@/components/crm/StateMessage";
import { formatDateTime, formatDuration } from "@/lib/format";
import styles from "./CallHistoryTable.module.css";

const DIRECTION_LABEL: Record<CallRecord["direction"], string> = {
  INCOMING: "Incoming",
  OUTGOING: "Outgoing",
};

/**
 * Renders mock call history (lib/mock-data/calls.ts -- no calls table
 * exists yet). Shows availability, not invented content: recording,
 * transcript, and AI summary are each a status badge ("Available" /
 * "Not available yet"), never fabricated transcript text or a summary
 * presented as if it were real -- per explicit instruction not to invent
 * recordings/transcripts/AI summaries.
 */
export function CallHistoryTable({ calls }: { calls: CallRecord[] }) {
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
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => (
          <tr key={call.id}>
            <td>{formatDateTime(call.timestamp)}</td>
            <td className={styles.muted}>{call.agent}</td>
            <td className={styles.muted}>{DIRECTION_LABEL[call.direction]}</td>
            <td>
              <Badge tone={call.outcome === "ANSWERED" ? "success" : "danger"}>
                {call.outcome === "ANSWERED" ? "Answered" : "Missed"}
              </Badge>
            </td>
            <td className={styles.muted}>{call.outcome === "ANSWERED" ? formatDuration(call.durationSeconds) : "--"}</td>
            <td>
              {call.hasRecording ? <Badge tone="accent">Available</Badge> : <Badge tone="neutral">None</Badge>}
            </td>
            <td>
              {call.transcript ? <Badge tone="accent">Available</Badge> : <Badge tone="neutral">None</Badge>}
            </td>
            <td>
              <Badge tone="neutral">Not available yet</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
