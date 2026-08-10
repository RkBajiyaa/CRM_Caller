/**
 * One vocabulary for "what is happening with this call right now", derived
 * from the two records that already exist -- a `CallRequest` and the `Call`
 * it links to. Pure functions only.
 *
 * This is deliberately NOT a new status column and NOT a second call system.
 * Nothing here is stored, nothing here is sent to Android, and neither
 * `CallRequestStatus` nor `CallStatus` changes meaning. It exists because
 * neither record on its own answers the question the CRM has to display:
 *
 *   - `CallRequest.status` describes the *request*: has Android seen it, has
 *     it started dialing. Android marks it COMPLETED the moment the `Call`
 *     row is created (see ConbunCall_V4's CallSessionTracker.onCallInitiated),
 *     i.e. at the *start* of the phone call -- so COMPLETED means "dialed",
 *     never "the call is over".
 *   - `Call.status` describes the *outcome*, and is deliberately null until
 *     Android finishes the call with PATCH /api/calls/{id}.
 *
 * Combining them is the only way to distinguish "ringing" from "talking"
 * from "nobody picked up", which is exactly the distinction the CRM was
 * missing. If the two ever disagree, `Call` wins -- it is the record of what
 * actually happened on the phone.
 */
import type { CallRequestStatus } from "@/lib/call-requests/types";
import type { CallStatus } from "@/lib/calls/types";

export type CallLifecycleState =
  /** No call request and no call -- nothing has been attempted. */
  | "NONE"
  /** Created in the CRM, Android hasn't picked it up yet. */
  | "QUEUED"
  /** Android accepted the request and is placing the call. */
  | "DIALING"
  /** The phone call exists and hasn't been reported finished yet. */
  | "IN_PROGRESS"
  /** Finished and answered -- someone actually talked. */
  | "CONNECTED"
  /** Finished without being answered (missed or rejected). */
  | "NOT_ANSWERED"
  /** The request or the call itself failed. */
  | "FAILED"
  /** Cancelled before it became a call. */
  | "CANCELLED"
  /** Dialed, but no outcome was ever reported (e.g. the app died mid-call). */
  | "UNKNOWN";

export const CALL_LIFECYCLE_LABELS: Record<CallLifecycleState, string> = {
  NONE: "No calls",
  QUEUED: "Queued",
  DIALING: "Dialing",
  IN_PROGRESS: "In progress",
  CONNECTED: "Connected",
  NOT_ANSWERED: "Not answered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  UNKNOWN: "Outcome unknown",
};

/** True while the CRM should expect this to change on its own shortly -- what the UI polls/refreshes on. */
export function isCallLifecycleActive(state: CallLifecycleState): boolean {
  return state === "QUEUED" || state === "DIALING" || state === "IN_PROGRESS";
}

/** Maps a finished (or unfinished) `Call.status` on its own, with no request context. */
export function callStatusToLifecycle(status: CallStatus | null | undefined): CallLifecycleState {
  switch (status) {
    case "ANSWERED":
      return "CONNECTED";
    case "MISSED":
    case "REJECTED":
      return "NOT_ANSWERED";
    case "FAILED":
      return "FAILED";
    default:
      // Started, never finished -- the call is (or was) live.
      return "IN_PROGRESS";
  }
}

/**
 * The combined state.
 *
 * @param requestStatus the CallRequest's status, or null if this call didn't
 *   come from the CRM's "Call" button (an Android-originated call).
 * @param callStatus the linked Call's status; `undefined` means no Call row
 *   exists yet, which is different from `null` ("call started, not finished").
 */
export function callLifecycleState(
  requestStatus: CallRequestStatus | null | undefined,
  callStatus: CallStatus | null | undefined,
  hasCall: boolean
): CallLifecycleState {
  if (hasCall) {
    // A real call exists: its own outcome is the truth, whatever the request
    // says -- except that an explicitly cancelled request is worth surfacing.
    if (requestStatus === "CANCELLED" && callStatus == null) return "CANCELLED";
    return callStatusToLifecycle(callStatus);
  }

  switch (requestStatus) {
    case "PENDING":
      return "QUEUED";
    case "ACCEPTED":
      return "DIALING";
    case "CANCELLED":
      return "CANCELLED";
    case "FAILED":
      return "FAILED";
    case "COMPLETED":
      // Android reports COMPLETED when it creates the Call row, so a
      // COMPLETED request with no call attached means that link never landed.
      return "UNKNOWN";
    default:
      return "NONE";
  }
}
