"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { HoverPrefetchLink } from "@/components/crm/HoverPrefetchLink";
import type { Call } from "@/lib/calls/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { StateMessage } from "@/components/crm/StateMessage";
import { callStatusToLifecycle, CALL_LIFECYCLE_LABELS } from "@/lib/call-requests/lifecycle";
import { formatDateTime, formatDuration } from "@/lib/format";
import styles from "./CallsTable.module.css";

const DIRECTION_LABEL: Record<Call["direction"], string> = { INCOMING: "In", OUTGOING: "Out" };

const CALL_STATUS_BADGE: Record<NonNullable<Call["status"]>, { label: string; tone: BadgeTone }> = {
  ANSWERED: { label: "Connected", tone: "success" },
  MISSED: { label: "Missed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
  FAILED: { label: "Failed", tone: "danger" },
};

const PIPELINE_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  DONE: { label: "Ready", tone: "accent" },
  PROCESSING: { label: "Working", tone: "warning" },
  PENDING: { label: "Waiting", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};
const NOT_AVAILABLE: { label: string; tone: BadgeTone } = { label: "Not available", tone: "neutral" };

/**
 * Same rule as the customer-side call history: content is what makes a stage
 * "Ready", and no content never reads as "Failed". A call with no transcript
 * has no transcript whether the pipeline failed, was never asked, or has not
 * reported back -- and only the genuinely in-flight states claim there is
 * something still to wait for.
 */
function contentBadge(status: string | null, hasContent: boolean) {
  if (hasContent) return PIPELINE_BADGE.DONE;
  if (status === "PENDING" || status === "PROCESSING") return PIPELINE_BADGE[status];
  return NOT_AVAILABLE;
}

/**
 * Recording state, as the agent should read it.
 *
 * Recording is genuinely different from transcript and summary -- a recording
 * is a file that either got captured or didn't, so a real capture failure on a
 * call that *was* answered still says "Failed", because that one is worth
 * chasing.
 *
 * The one case that isn't: a call nobody picked up. Conbun Call still runs its
 * recording discovery for a missed, rejected or failed call, finds nothing --
 * because there was nothing to find -- and registers the recording as FAILED
 * with no `storageKey`. The CRM then printed "Failed" against a missed call,
 * which reads as a broken recorder when the truth is that silence was the
 * correct outcome. With no file stored and no call answered, that is "Not
 * available".
 *
 * Deliberately narrow: it takes *both* conditions. An answered call whose
 * recording failed keeps its "Failed", and a recording that stored a file
 * keeps whatever its pipeline reported.
 */
function recordingBadge(call: Call) {
  const status = call.recordingStatus ?? "PENDING";
  if (status === "FAILED" && !call.recordingStorageKey && call.status !== "ANSWERED") {
    return NOT_AVAILABLE;
  }
  return PIPELINE_BADGE[status] ?? PIPELINE_BADGE.PENDING;
}

/**
 * The outcome cell for a call Android never finished.
 *
 * Amber while the call could still be happening; plain neutral once it can't,
 * because "Outcome unknown" is a record of something that did not arrive, not
 * a warning about something in flight. See CALL_IN_FLIGHT_WINDOW_MS.
 */
function unfinishedCallBadge(startedAt: string): { label: string; tone: BadgeTone } {
  const state = callStatusToLifecycle(null, startedAt);
  return {
    label: CALL_LIFECYCLE_LABELS[state],
    tone: state === "IN_PROGRESS" ? "warning" : "neutral",
  };
}

/**
 * A list of calls across customers -- one agent's (the Agent page) or the
 * whole team's (the Calls page). `showAgent` is the only difference between
 * the two: on an agent's own page the agent column would repeat the page title
 * on every row.
 *
 * Deliberately a separate component from CallHistoryTable rather than a
 * generalisation of it: that table is the working customer-profile view and
 * this pass does not rewrite it. The two answer different questions -- that one
 * is "everything about this customer's calls", this one is "who called whom" --
 * so the leading columns differ and the detail here is only what a call-level
 * reader needs: the transcript and summary, in place. The full per-call detail
 * stays one click away on the customer.
 */
export function CallsTable({
  calls,
  showAgent = false,
  emptyTitle = "No calls in this period",
  emptyDescription = "Nothing was reported for this agent in the selected date range.",
}: {
  calls: Call[];
  showAgent?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (calls.length === 0) {
    return <StateMessage title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.colWhen}>Date / time</th>
          <th className={styles.colCustomer}>Customer</th>
          {showAgent && <th className={styles.colAgent}>Agent</th>}
          <th className={styles.colDevice}>Device</th>
          <th className={styles.colDirection}>Dir</th>
          <th className={styles.colStatus}>Outcome</th>
          <th className={styles.colDuration}>Duration</th>
          <th className={styles.colBadge}>Recording</th>
          <th className={styles.colBadge}>Transcript</th>
          <th className={styles.colBadge}>Summary</th>
          <th className={styles.colExpand}>
            <span className={styles.srOnly}>Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => {
          const hasTranscript = Boolean(call.transcriptText && call.transcriptText.trim());
          const hasSummary = Boolean(call.aiSummaryText && call.aiSummaryText.trim());
          const transcriptBadge = contentBadge(call.transcriptStatus, hasTranscript);
          const summaryBadge = contentBadge(call.aiSummaryStatus, hasSummary);
          const recording = call.hasRecording ? recordingBadge(call) : NOT_AVAILABLE;
          const expanded = expandedId === call.id;

          return (
            <Fragment key={call.id}>
              <tr className={expanded ? styles.rowExpanded : undefined}>
                <td>{formatDateTime(call.startedAt)}</td>
                <td>
                  {/* Intent-gated prefetch, the same component the customers
                      and agents lists use: the customer page is force-dynamic,
                      so a plain Link would fetch only its skeleton and the
                      click would still wait on the database. */}
                  <HoverPrefetchLink href={`/customers/${call.customerId}`} className={styles.customerLink}>
                    {call.customerName ?? call.phoneNumber}
                  </HoverPrefetchLink>
                </td>
                {showAgent && (
                  <td className={call.agentName ? undefined : styles.unknown}>
                    {call.agentName ?? "Not recorded"}
                  </td>
                )}
                <td className={styles.mono} title={call.deviceId ?? undefined}>
                  {call.deviceLabel ?? call.deviceId ?? "--"}
                </td>
                <td className={styles.muted}>{DIRECTION_LABEL[call.direction]}</td>
                <td>
                  {call.status ? (
                    <Badge tone={CALL_STATUS_BADGE[call.status].tone}>{CALL_STATUS_BADGE[call.status].label}</Badge>
                  ) : (
                    <Badge tone={unfinishedCallBadge(call.startedAt).tone}>
                      {unfinishedCallBadge(call.startedAt).label}
                    </Badge>
                  )}
                </td>
                <td className={styles.muted}>
                  {call.durationSeconds > 0 ? formatDuration(call.durationSeconds) : "--"}
                </td>
                <td>
                  {/* No recording row at all reads "Not available" too -- the
                      same statement the transcript and summary columns make in
                      the same situation. */}
                  <Badge tone={recording.tone}>{recording.label}</Badge>
                </td>
                <td>
                  {hasTranscript ? (
                    <button
                      type="button"
                      className={styles.viewButton}
                      aria-controls={`agent-call-${call.id}`}
                      onClick={() => setExpandedId(expanded ? null : call.id)}
                    >
                      View<span className={styles.srOnly}> transcript for this call</span>
                    </button>
                  ) : (
                    <Badge tone={transcriptBadge.tone}>{transcriptBadge.label}</Badge>
                  )}
                </td>
                <td>
                  {hasSummary ? (
                    <button
                      type="button"
                      className={styles.viewButton}
                      aria-controls={`agent-call-${call.id}`}
                      onClick={() => setExpandedId(expanded ? null : call.id)}
                    >
                      View<span className={styles.srOnly}> summary for this call</span>
                    </button>
                  ) : (
                    <Badge tone={summaryBadge.tone}>{summaryBadge.label}</Badge>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.expandButton}
                    aria-expanded={expanded}
                    aria-controls={`agent-call-${call.id}`}
                    onClick={() => setExpandedId(expanded ? null : call.id)}
                    title={expanded ? "Hide call details" : "Show call details"}
                  >
                    <span className={expanded ? styles.chevronOpen : styles.chevron} aria-hidden="true">
                      ▸
                    </span>
                    <span className={styles.srOnly}>{expanded ? "Hide" : "Show"} details for this call</span>
                  </button>
                </td>
              </tr>

              {expanded && (
                <tr className={styles.detailRow} id={`agent-call-${call.id}`}>
                  <td colSpan={showAgent ? 11 : 10}>
                    <div className={styles.detail}>
                      <section className={styles.panel}>
                        <header className={styles.panelHeader}>
                          <h4 className={styles.panelTitle}>
                            Transcript{call.transcriptLanguage ? ` (${call.transcriptLanguage})` : ""}
                          </h4>
                          <Badge tone={transcriptBadge.tone}>{transcriptBadge.label}</Badge>
                        </header>
                        {hasTranscript ? (
                          <p className={styles.longText}>{call.transcriptText}</p>
                        ) : (
                          <p className={styles.empty}>
                            {call.transcriptStatus === "PENDING" || call.transcriptStatus === "PROCESSING"
                              ? "Transcription has not finished yet."
                              : "Not available -- no transcript is stored for this call."}
                          </p>
                        )}
                      </section>

                      <section className={styles.panel}>
                        <header className={styles.panelHeader}>
                          <h4 className={styles.panelTitle}>AI summary</h4>
                          <Badge tone={summaryBadge.tone}>{summaryBadge.label}</Badge>
                        </header>
                        {hasSummary ? (
                          <>
                            <p className={styles.longText}>{call.aiSummaryText}</p>
                            {call.aiSummaryKeyPoints.length > 0 && (
                              <ul className={styles.keyPoints}>
                                {call.aiSummaryKeyPoints.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            )}
                          </>
                        ) : (
                          <p className={styles.empty}>
                            {call.aiSummaryStatus === "PENDING" || call.aiSummaryStatus === "PROCESSING"
                              ? "Summarization has not finished yet."
                              : "Not available -- no summary is stored for this call."}
                          </p>
                        )}
                      </section>

                      <p className={styles.detailFooter}>
                        {call.failureReason ? `Reason: ${call.failureReason} · ` : ""}
                        <Link href={`/customers/${call.customerId}`} className={styles.customerLink}>
                          Open {call.customerName ?? "customer"} for full call detail
                        </Link>
                      </p>
                    </div>
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
