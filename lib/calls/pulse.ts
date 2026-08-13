/**
 * "Has anything about this customer's calling changed, and should the CRM
 * keep watching?" -- pure functions, no database, no React.
 *
 * This exists so the CRM stops needing a manual browser refresh during the
 * one workflow where data arrives on its own: a call is placed on the phone,
 * then its outcome, then (separately, later, and each able to fail alone) its
 * recording, transcript and summary. Everything else in the CRM changes only
 * because someone in the CRM changed it.
 *
 * The design constraint is the sprint's own: *do not poll aggressively, and
 * stop once there is nothing to wait for*. So this module answers two
 * questions and nothing else:
 *
 *   `version` -- a short fingerprint over exactly the fields the customer
 *     detail page displays about calls. The client compares strings; when it
 *     changes, and only then, the page re-renders (one `router.refresh()`).
 *     A poll that finds no change costs one small JSON response and repaints
 *     nothing.
 *
 *   `active`  -- whether anything is still expected to arrive. False means
 *     the client stops polling entirely, which is the point.
 *
 * Nothing here is stored, and no new status is invented: `version` is derived
 * from existing columns, and the lifecycle comes from the existing
 * lib/call-requests/lifecycle.ts vocabulary. Both the server-rendered page
 * and the status endpoint run these same functions over the same records, so
 * the two can never disagree about what "unchanged" means.
 */
import type { Call, CallStatus } from "@/lib/calls/types";
import type { CallRequest, CallRequestStatus } from "@/lib/call-requests/types";
import { callLifecycleState, isCallLifecycleActive, type CallLifecycleState } from "@/lib/call-requests/lifecycle";

/**
 * How long after a call's last change the CRM keeps watching for its
 * recording / transcript / summary to show up.
 *
 * This is what stops the poll from running forever. A call that simply never
 * produced a recording (most calls -- the audio never leaves the phone unless
 * Android finds and reports a file) is indistinguishable from one whose
 * recording is still on its way, so the only honest way to stop is a
 * deadline. Fifteen minutes is comfortably longer than Android's
 * transcribe-then-summarize pipeline takes and short enough that an idle CRM
 * tab is silent.
 *
 * Past the deadline the data still appears -- on the next navigation or
 * refresh, like any other page. Only the automatic watching stops.
 */
export const PIPELINE_WATCH_WINDOW_MS = 15 * 60 * 1000;

/** The per-call facts the detail page shows and this module fingerprints. Deliberately booleans and short enums -- no transcript or summary text, so a poll stays small however long the transcript is. */
export interface CallPulse {
  id: string;
  updatedAt: string;
  status: CallStatus | null;
  hasRecording: boolean;
  recordingStatus: string | null;
  transcriptStatus: string | null;
  hasTranscriptText: boolean;
  aiSummaryStatus: string | null;
  hasSummaryText: boolean;
}

export interface RequestPulse {
  id: string;
  status: CallRequestStatus;
  updatedAt: string;
  callId: string | null;
}

export interface CallActivityPulse {
  version: string;
  lifecycle: CallLifecycleState;
  active: boolean;
}

/** Narrows a full `Call` to the fields that matter for change detection. Used by the page, which already holds `Call[]` and must not spend a query to re-derive what it has. */
export function callToPulse(call: Call): CallPulse {
  return {
    id: call.id,
    updatedAt: call.updatedAt,
    status: call.status,
    hasRecording: call.hasRecording,
    recordingStatus: call.recordingStatus,
    transcriptStatus: call.transcriptStatus,
    hasTranscriptText: Boolean(call.transcriptText && call.transcriptText.trim()),
    aiSummaryStatus: call.aiSummaryStatus,
    hasSummaryText: Boolean(call.aiSummaryText && call.aiSummaryText.trim()),
  };
}

export function requestToPulse(request: CallRequest): RequestPulse {
  return {
    id: request.id,
    status: request.status,
    updatedAt: request.updatedAt,
    callId: request.callId,
  };
}

/**
 * djb2. A hash, not a checksum with security properties -- all it has to do
 * is change when the input changes, for a client comparing it to the string
 * it saw last. Hand-rolled rather than `node:crypto` so this module stays
 * pure and importable from anywhere, and so the value stays short enough to
 * be uninteresting in a JSON body.
 */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/** True while any of this call's three post-call stages could still legitimately arrive. */
function pipelineUnsettled(call: CallPulse): boolean {
  const stageWaiting = (status: string | null, hasContent: boolean) =>
    !hasContent && (status === null || status === "PENDING" || status === "PROCESSING");
  return (
    stageWaiting(call.recordingStatus, call.hasRecording) ||
    stageWaiting(call.transcriptStatus, call.hasTranscriptText) ||
    stageWaiting(call.aiSummaryStatus, call.hasSummaryText)
  );
}

/**
 * Whether a recording / transcript / summary is still plausibly coming for
 * this call at all.
 *
 * A call nobody answered has no conversation to record, transcribe or
 * summarize, so waiting on those stages for a MISSED, REJECTED or FAILED call
 * means polling for a quarter of an hour over something that will never
 * arrive -- on every unanswered call, which is a great many of them. Only a
 * call that connected (or one whose outcome hasn't been reported yet, where
 * we genuinely do not know) is worth watching.
 */
function canStillProduceOutputs(call: CallPulse): boolean {
  return call.status === "ANSWERED" || call.status === null;
}

/**
 * The whole watch decision, from the records the page already loaded.
 *
 * `calls` and `requests` must both be newest-first, which is how every reader
 * in this project already fetches them.
 */
export function callActivityPulse(
  calls: CallPulse[],
  requests: RequestPulse[],
  now: number = Date.now()
): CallActivityPulse {
  const latestRequest = requests[0] ?? null;
  const latestCall = calls[0] ?? null;

  // Same derivation the detail page and the customers list use -- the request
  // it produced, not merely the newest unrelated call (lifecycle.ts).
  const requestCall = latestRequest?.callId ? calls.find((c) => c.id === latestRequest.callId) : undefined;
  const lifecycle = latestRequest
    ? callLifecycleState(latestRequest.status, requestCall?.status ?? null, Boolean(latestRequest.callId))
    : callLifecycleState(null, latestCall?.status ?? null, Boolean(latestCall));

  // A call is in flight -- keep watching, the outcome is coming.
  let active = isCallLifecycleActive(lifecycle);

  // Otherwise: keep watching only while a *recent* call still has a stage
  // that hasn't landed. Both halves matter -- "recent" is what makes this
  // terminate, "unsettled" is what stops a fully-processed call from being
  // polled at all.
  if (!active) {
    active = calls.some(
      (call) =>
        canStillProduceOutputs(call) &&
        now - Date.parse(call.updatedAt) < PIPELINE_WATCH_WINDOW_MS &&
        pipelineUnsettled(call)
    );
  }

  const signature = [
    ...calls.map((c) =>
      [
        c.id,
        c.updatedAt,
        c.status ?? "-",
        c.hasRecording ? "r" : "-",
        c.recordingStatus ?? "-",
        c.transcriptStatus ?? "-",
        c.hasTranscriptText ? "t" : "-",
        c.aiSummaryStatus ?? "-",
        c.hasSummaryText ? "s" : "-",
      ].join(":")
    ),
    ...requests.map((r) => [r.id, r.status, r.updatedAt, r.callId ?? "-"].join(":")),
  ].join("|");

  return { version: hash(signature), lifecycle, active };
}
