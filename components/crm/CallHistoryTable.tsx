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
 * exists yet). Columns match what a real call record will eventually
 * carry (CRM_ARCHITECTURE.md #13), including recording/transcript/AI
 * summary placeholders, so this table doesn't need restructuring once
 * that data is real -- only the values change from mock to fetched.
 */
export function CallHistoryTable({ calls }: { calls: CallRecord[] }) {
  if (calls.length === 0) {
    return <StateMessage title="No calls yet" description="No call history recorded for this customer." />;
  }

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date / time</th>
            <th>Agent</th>
            <th>Direction</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Recording</th>
            <th>Transcript</th>
            <th>AI summary</th>
            <th>Follow-up</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id}>
              <td>{formatDateTime(call.timestamp)}</td>
              <td>{call.agent}</td>
              <td>{DIRECTION_LABEL[call.direction]}</td>
              <td>
                <Badge tone={call.outcome === "ANSWERED" ? "success" : "danger"}>
                  {call.outcome === "ANSWERED" ? "Answered" : "Missed"}
                </Badge>
              </td>
              <td className={styles.muted}>{call.outcome === "ANSWERED" ? formatDuration(call.durationSeconds) : "--"}</td>
              <td>
                {call.hasRecording ? (
                  <Badge tone="neutral">Available</Badge>
                ) : (
                  <span className={styles.muted}>None</span>
                )}
              </td>
              <td className={styles.transcript}>{call.transcript ?? <span className={styles.muted}>--</span>}</td>
              <td>
                <span className={styles.muted} title="AI summaries are not implemented yet">
                  Not available yet
                </span>
              </td>
              <td className={styles.muted}>{call.followUp ?? "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
