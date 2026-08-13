"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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

/**
 * Recording / transcript / AI summary each move through their own pipeline
 * after the call ends, and each can fail on its own without touching the
 * others (that independence is the point -- see CRM_ARCHITECTURE.md and this
 * pass's CHANGELOG entry). So each gets its own badge, and a stage that hasn't
 * produced anything says so rather than borrowing another stage's state.
 */
const PIPELINE_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  DONE: { label: "Ready", tone: "accent" },
  PROCESSING: { label: "Working", tone: "warning" },
  PENDING: { label: "Waiting", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
};
const NOT_STARTED: { label: string; tone: BadgeTone } = { label: "--", tone: "neutral" };
const NOT_AVAILABLE: { label: string; tone: BadgeTone } = { label: "Not available", tone: "neutral" };

const ACTION_STATUS_LABEL: Record<Action["status"], string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ACTION_TYPE_LABEL: Record<Action["type"], string> = {
  FOLLOW_UP: "Follow up",
  REACH_OUT: "Reach out again",
  CALLBACK: "Callback",
  OTHER: "Other",
};

/**
 * Transcript / AI summary state, as the agent should read it.
 *
 * Stored content is the only thing that makes one of these stages "Ready" --
 * and when there is no content, the badge never says "Failed". A call with no
 * transcript has no transcript whether the pipeline reported FAILED, was never
 * asked, or never reported back at all; "Failed" reads as "something broke, go
 * chase it", which is the wrong instruction for what is usually just a call
 * that has nothing to show. Only the genuinely in-flight states still say so,
 * because there really is something to wait for there.
 *
 * Recording is deliberately not routed through here: it keeps its existing
 * PIPELINE_BADGE behaviour untouched, "Failed" included -- a recording is a
 * file that either got captured or didn't, and this pass was scoped to the
 * transcript and summary columns only.
 */
function contentBadge(status: string | null, hasContent: boolean) {
  if (hasContent) return PIPELINE_BADGE.DONE;
  if (status === "PENDING" || status === "PROCESSING") return PIPELINE_BADGE[status];
  return NOT_AVAILABLE;
}

/** Which of the expanded row's long-form panels a "View" click asked for. */
type FocusTarget = { callId: string; panel: "transcript" | "summary"; nonce: number };

function formatBytes(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Real call history -- backed by lib/calls/service.ts (the `calls` table),
 * not mock data. Every cell reflects what Android actually reported: a call
 * with no outcome yet shows "In progress" rather than a guess, a call with no
 * recording shows "--" rather than a placeholder, and a call with no AI
 * summary says so, because that is genuinely what the API reports when none
 * has been submitted (CRM_ARCHITECTURE.md Phase 7).
 *
 * One compact line per call; everything else -- timings, the call request that
 * produced it, recording metadata, the transcript, the summary, the follow-up
 * -- opens underneath the row it belongs to. That is deliberately where the
 * detail lives: the same call, in place, rather than a second page that would
 * cost another round trip to load data this component was already handed.
 */
export function CallHistoryTable({
  calls,
  actionsByCallId,
  customerName,
}: {
  calls: Call[];
  actionsByCallId: Map<string, Action>;
  customerName: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Set by the Transcript/Summary "View" buttons: which panel to open the row
  // on and scroll to. `nonce` makes clicking the same View twice re-scroll,
  // since the callId/panel pair on its own would be unchanged state.
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const focusedPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!focus) return;
    // Runs after the detail row has committed, so the ref is attached by now.
    focusedPanelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);

  function openPanel(callId: string, panel: FocusTarget["panel"]) {
    setExpandedId(callId);
    setFocus((current) => ({ callId, panel, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function toggleRow(callId: string, expanded: boolean) {
    setExpandedId(expanded ? null : callId);
    setFocus(null);
  }

  if (calls.length === 0) {
    return <StateMessage title="No calls yet" description="No call history recorded for this customer." />;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.colWhen}>Date / time</th>
          <th className={styles.colDirection}>Dir</th>
          <th className={styles.colStatus}>Outcome</th>
          <th className={styles.colDuration}>Duration</th>
          <th className={styles.colAgent}>Agent</th>
          <th className={styles.colBadge}>Recording</th>
          <th className={styles.colBadge}>Transcript</th>
          <th className={styles.colBadge}>Summary</th>
          <th className={styles.colFollowUp}>Follow-up</th>
          <th className={styles.colExpand}>
            <span className={styles.srOnly}>Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => {
          const action = actionsByCallId.get(call.id);
          const hasTranscriptText = Boolean(call.transcriptText && call.transcriptText.trim());
          const hasSummary = Boolean(call.aiSummaryText && call.aiSummaryText.trim());
          const transcriptBadge = contentBadge(call.transcriptStatus, hasTranscriptText);
          const summaryBadge = contentBadge(call.aiSummaryStatus, hasSummary);
          const recordingBadge = call.hasRecording
            ? (PIPELINE_BADGE[call.recordingStatus ?? "PENDING"] ?? PIPELINE_BADGE.PENDING)
            : NOT_STARTED;
          // Fall back to the recording's own reported duration only for a call
          // that was actually answered -- it's what the audio file contains,
          // which can differ slightly from the call-log duration Android
          // reports. For a missed, rejected or failed call the fallback was
          // actively wrong: a recorder that captured 40 seconds of ringing
          // would put "0:40" in the Duration column of a call nobody picked
          // up, making it read exactly like a conversation. No answer means no
          // conversation time, so the column shows "--" and the recording's
          // real length stays visible under Recording in the expanded row.
          const answered = call.status === "ANSWERED";
          const durationSeconds = call.durationSeconds || (answered ? call.recordingDurationSeconds || 0 : 0);
          const expanded = expandedId === call.id;

          return (
            <Fragment key={call.id}>
              <tr className={expanded ? styles.rowExpanded : undefined}>
                <td>{formatDateTime(call.startedAt)}</td>
                <td className={styles.muted}>{DIRECTION_LABEL[call.direction]}</td>
                <td>
                  {call.status ? (
                    <Badge tone={CALL_STATUS_BADGE[call.status].tone}>{CALL_STATUS_BADGE[call.status].label}</Badge>
                  ) : (
                    <Badge tone="warning">{CALL_LIFECYCLE_LABELS[callStatusToLifecycle(null)]}</Badge>
                  )}
                </td>
                <td className={styles.muted}>{durationSeconds > 0 ? formatDuration(durationSeconds) : "--"}</td>
                <td className={styles.muted}>{call.agentName ?? "Unassigned"}</td>
                <td>
                  <Badge tone={recordingBadge.tone}>{call.hasRecording ? recordingBadge.label : "--"}</Badge>
                </td>
                {/* Content that exists offers the way to read it, in place of
                    a badge that only said it existed. Nothing is fetched or
                    generated by this click -- the text is already on `call`,
                    delivered by the same query that filled this row. */}
                <td>
                  {hasTranscriptText ? (
                    <ViewButton
                      what="transcript"
                      onClick={() => openPanel(call.id, "transcript")}
                      controls={`call-detail-${call.id}`}
                    />
                  ) : (
                    <Badge tone={transcriptBadge.tone}>{transcriptBadge.label}</Badge>
                  )}
                </td>
                <td>
                  {hasSummary ? (
                    <ViewButton
                      what="summary"
                      onClick={() => openPanel(call.id, "summary")}
                      controls={`call-detail-${call.id}`}
                    />
                  ) : (
                    <Badge tone={summaryBadge.tone}>{summaryBadge.label}</Badge>
                  )}
                </td>
                <td className={styles.muted}>{action ? ACTION_STATUS_LABEL[action.status] : "--"}</td>
                <td>
                  <button
                    type="button"
                    className={styles.expandButton}
                    aria-expanded={expanded}
                    aria-controls={`call-detail-${call.id}`}
                    onClick={() => toggleRow(call.id, expanded)}
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
                <tr className={styles.detailRow} id={`call-detail-${call.id}`}>
                  <td colSpan={10}>
                    <div className={styles.detail}>
                      <dl className={styles.detailFacts}>
                        <Fact label="Customer" value={customerName} />
                        <Fact label="Mobile number" value={call.phoneNumber} href={`tel:${call.phoneNumber}`} />
                        <Fact
                          label="Call status"
                          value={
                            call.status
                              ? CALL_STATUS_BADGE[call.status].label
                              : CALL_LIFECYCLE_LABELS[callStatusToLifecycle(null)]
                          }
                        />
                        <Fact label="Direction" value={call.direction === "OUTGOING" ? "Outgoing" : "Incoming"} />
                        <Fact label="Agent" value={call.agentName ?? "Unassigned"} />
                        <Fact label="Started" value={formatDateTime(call.startedAt)} />
                        {/* Only rendered when the reporting client actually sent
                            it -- an absent answer time is never faked from the
                            duration. */}
                        {call.answeredAt && <Fact label="Answered" value={formatDateTime(call.answeredAt)} />}
                        <Fact label="Ended" value={call.endedAt ? formatDateTime(call.endedAt) : "Not reported"} />
                        <Fact
                          label="Duration"
                          value={call.durationSeconds > 0 ? formatDuration(call.durationSeconds) : "--"}
                        />
                        {call.failureReason && <Fact label="Reason" value={call.failureReason} />}
                        <Fact label="Call ID" value={call.id} mono />
                      </dl>

                      <div className={styles.detailPanels}>
                        <Panel title="Call request">
                          {call.callRequestId ? (
                            <dl className={styles.miniFacts}>
                              <MiniFact label="Queue status" value={call.callRequestStatus ?? "--"} />
                              <MiniFact
                                label="Requested"
                                value={
                                  call.callRequestRequestedAt ? formatDateTime(call.callRequestRequestedAt) : "--"
                                }
                              />
                              <MiniFact label="Request ID" value={call.callRequestId} mono />
                            </dl>
                          ) : (
                            <p className={styles.empty}>
                              Not from a CRM call request -- this call was placed on the phone directly.
                            </p>
                          )}
                        </Panel>

                        <Panel title="Recording">
                          {call.hasRecording ? (
                            <dl className={styles.miniFacts}>
                              <MiniFact label="State" value={call.recordingStatus ?? "Registered"} />
                              <MiniFact
                                label="Length"
                                value={
                                  call.recordingDurationSeconds
                                    ? formatDuration(call.recordingDurationSeconds)
                                    : "Not reported"
                                }
                              />
                              {call.recordingMimeType && <MiniFact label="Format" value={call.recordingMimeType} />}
                              {formatBytes(call.recordingSizeBytes) && (
                                <MiniFact label="Size" value={formatBytes(call.recordingSizeBytes) as string} />
                              )}
                              {call.recordingStorageKey && (
                                <MiniFact label="Reference" value={call.recordingStorageKey} mono />
                              )}
                            </dl>
                          ) : (
                            <p className={styles.empty}>
                              No recording registered for this call. The audio file itself never leaves the phone --
                              the CRM only ever stores metadata.
                            </p>
                          )}
                        </Panel>

                        <Panel title="Follow-up">
                          {action ? (
                            <dl className={styles.miniFacts}>
                              <MiniFact label="Type" value={ACTION_TYPE_LABEL[action.type]} />
                              <MiniFact label="Status" value={ACTION_STATUS_LABEL[action.status]} />
                              {action.dueDate && (
                                <MiniFact label="Due" value={formatDateTime(action.dueDate)} />
                              )}
                              {action.assignedAgentName && (
                                <MiniFact label="Assigned to" value={action.assignedAgentName} />
                              )}
                              {action.notes && <MiniFact label="Notes" value={action.notes} />}
                            </dl>
                          ) : (
                            <p className={styles.empty}>No follow-up linked to this call.</p>
                          )}
                        </Panel>
                      </div>

                      <Panel
                        title={`Transcript${call.transcriptLanguage ? ` (${call.transcriptLanguage})` : ""}`}
                        badge={<Badge tone={transcriptBadge.tone}>{transcriptBadge.label}</Badge>}
                        ref={
                          focus?.callId === call.id && focus.panel === "transcript" ? focusedPanelRef : undefined
                        }
                        highlighted={focus?.callId === call.id && focus.panel === "transcript"}
                      >
                        {hasTranscriptText ? (
                          <p className={styles.longText}>{call.transcriptText}</p>
                        ) : (
                          <p className={styles.empty}>
                            {call.transcriptStatus === "PENDING" || call.transcriptStatus === "PROCESSING"
                              ? "Transcription has not finished yet."
                              : "Not available -- no transcript is stored for this call. The call record above is unaffected."}
                          </p>
                        )}
                      </Panel>

                      <Panel
                        title="AI summary"
                        badge={<Badge tone={summaryBadge.tone}>{summaryBadge.label}</Badge>}
                        ref={focus?.callId === call.id && focus.panel === "summary" ? focusedPanelRef : undefined}
                        highlighted={focus?.callId === call.id && focus.panel === "summary"}
                      >
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
                            <dl className={styles.miniFacts}>
                              {call.aiSummaryCustomerIntent && (
                                <MiniFact label="Customer intent" value={call.aiSummaryCustomerIntent} />
                              )}
                              {call.aiSummarySentiment && (
                                <MiniFact label="Sentiment" value={call.aiSummarySentiment} />
                              )}
                              {call.aiSummaryRecommendedAction && (
                                <MiniFact label="Recommended action" value={call.aiSummaryRecommendedAction} />
                              )}
                              <MiniFact
                                label="Follow-up needed"
                                value={call.aiSummaryFollowUpRequired ? "Yes" : "No"}
                              />
                              {call.aiSummaryGeneratedAt && (
                                <MiniFact label="Generated" value={formatDateTime(call.aiSummaryGeneratedAt)} />
                              )}
                            </dl>
                          </>
                        ) : (
                          <p className={styles.empty}>
                            {call.aiSummaryStatus === "PENDING" || call.aiSummaryStatus === "PROCESSING"
                              ? "Summarization has not finished yet."
                              : "Not available -- no summary is stored for this call. The CRM never generates one itself."}
                          </p>
                        )}
                      </Panel>
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

function Fact({ label, value, href, mono }: { label: string; value: string; href?: string; mono?: boolean }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={[styles.factValue, mono && styles.mono].filter(Boolean).join(" ")} title={value}>
        {href ? (
          <a href={href} className={styles.factLink}>
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function MiniFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.miniFact}>
      <dt className={styles.miniFactLabel}>{label}</dt>
      <dd className={[styles.miniFactValue, mono && styles.mono].filter(Boolean).join(" ")} title={value}>
        {value}
      </dd>
    </div>
  );
}

function Panel({
  title,
  badge,
  children,
  ref,
  highlighted,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  /** Set on the panel a "View" click targeted, so the effect can scroll to it. */
  ref?: React.Ref<HTMLElement>;
  highlighted?: boolean;
}) {
  return (
    <section ref={ref} className={[styles.panel, highlighted && styles.panelFocused].filter(Boolean).join(" ")}>
      <header className={styles.panelHeader}>
        <h4 className={styles.panelTitle}>{title}</h4>
        {badge}
      </header>
      {children}
    </section>
  );
}

/**
 * The Transcript/Summary column's affordance when there is something to read.
 * Opens this call's existing detail row and scrolls to the matching panel --
 * same page, same data, no request.
 */
function ViewButton({ what, onClick, controls }: { what: string; onClick: () => void; controls: string }) {
  return (
    <button type="button" className={styles.viewButton} onClick={onClick} aria-controls={controls}>
      View
      <span className={styles.srOnly}> {what} for this call</span>
    </button>
  );
}
