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

/**
 * How long a call with no reported outcome can still plausibly be happening.
 *
 * `Call.status` stays null from "the phone started dialing" until Android
 * reports the result, and if that report never arrives -- the app was killed
 * mid-call, the phone went offline and the retry never ran -- the row stays
 * null forever. Reading that as "in progress" a week later is wrong twice
 * over: it tells an operator a call is live when it is long over, and it makes
 * the customer page poll the server for twenty minutes waiting for an outcome
 * that is never coming.
 *
 * So "in progress" is bounded by the clock. An hour is deliberately generous
 * -- far longer than any call this CRM has recorded, so a genuinely long call
 * is never mislabelled -- and anything past it becomes "Outcome unknown",
 * which is what the record actually says. Nothing is written or changed by
 * this; it is how an existing null is *read*.
 */
export const CALL_IN_FLIGHT_WINDOW_MS = 60 * 60 * 1000;

/** True while the CRM should expect this to change on its own shortly -- what the UI polls/refreshes on. */
export function isCallLifecycleActive(state: CallLifecycleState): boolean {
  return state === "QUEUED" || state === "DIALING" || state === "IN_PROGRESS";
}

/**
 * Maps a finished (or unfinished) `Call.status` on its own, with no request
 * context.
 *
 * `startedAt` is optional and only matters for the unfinished case: without it
 * a null status still reads "In progress", exactly as it always did; with it,
 * a call that started longer ago than CALL_IN_FLIGHT_WINDOW_MS reads "Outcome
 * unknown" instead.
 */
export function callStatusToLifecycle(
  status: CallStatus | null | undefined,
  startedAt?: string | null,
  now: number = Date.now()
): CallLifecycleState {
  switch (status) {
    case "ANSWERED":
      return "CONNECTED";
    case "MISSED":
    case "REJECTED":
      return "NOT_ANSWERED";
    case "FAILED":
      return "FAILED";
    default:
      // Started, never finished. Still live if it could still be happening;
      // otherwise an outcome that was never reported -- see the window above.
      return isStale(startedAt, now) ? "UNKNOWN" : "IN_PROGRESS";
  }
}

function isStale(startedAt: string | null | undefined, now: number): boolean {
  if (!startedAt) return false;
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && now - started > CALL_IN_FLIGHT_WINDOW_MS;
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
  hasCall: boolean,
  /**
   * When these records last said anything, so a state that means "right now"
   * can stop claiming it. Both fields are optional and omitting them keeps the
   * original, clock-free behaviour exactly.
   *
   * - `callStartedAt` -- when the call began; see callStatusToLifecycle.
   * - `requestAt` -- when the request was last heard about (its `updatedAt`,
   *   or its `requestedAt` where that is all the caller has).
   */
  at: { callStartedAt?: string | null; requestAt?: string | null; now?: number } = {}
): CallLifecycleState {
  const now = at.now ?? Date.now();

  if (hasCall) {
    // A real call exists: its own outcome is the truth, whatever the request
    // says -- except that an explicitly cancelled request is worth surfacing.
    if (requestStatus === "CANCELLED" && callStatus == null) return "CANCELLED";
    return callStatusToLifecycle(callStatus, at.callStartedAt, now);
  }

  switch (requestStatus) {
    case "PENDING":
      // Still genuinely queued however old it is: Android is handed every
      // PENDING request the next time it polls, so this one has not expired,
      // it is waiting for a phone that has not asked yet.
      return "QUEUED";
    case "ACCEPTED":
      // Android took this request and then never came back with a call. Past
      // the window that is not "dialing right now", it is a dial whose result
      // was never reported -- which is what the CRM's 35 long-accepted
      // requests actually are, and why the customers list used to show most of
      // the directory as permanently "Dialing".
      return isStale(at.requestAt, now) ? "UNKNOWN" : "DIALING";
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
