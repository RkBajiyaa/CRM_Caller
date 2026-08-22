/** Shared Call types. Mirrors prisma/schema.prisma's Call model field-for-field. */

import type { CallRequestStatus } from "@/lib/call-requests/types";

export type CallDirection = "INCOMING" | "OUTGOING";
export type CallStatus = "ANSWERED" | "MISSED" | "REJECTED" | "FAILED";

export const CALL_DIRECTIONS: CallDirection[] = ["INCOMING", "OUTGOING"];
export const CALL_STATUSES: CallStatus[] = ["ANSWERED", "MISSED", "REJECTED", "FAILED"];

export interface Call {
  id: string;
  customerId: string;
  /**
   * The customer's current name, resolved by a join for display -- never a
   * stored snapshot, so a renamed customer reads correctly in every call that
   * was ever made to them. `customerId` remains the relationship (CLAUDE.md
   * rule #1); this is only what to print.
   */
  customerName: string | null;
  agentId: string | null;
  agentName: string | null;
  /**
   * The handset that reported this call, and its CRM label.
   *
   * Null means the reporting client did not say which phone it was -- which
   * is the honest answer for every call recorded before devices existed, and
   * for any client that doesn't send `deviceId`. Never guessed from the agent:
   * an agent can carry more than one phone, and inventing the link would make
   * an unverified guess look like a measurement.
   */
  deviceId: string | null;
  deviceLabel: string | null;
  phoneNumber: string;
  direction: CallDirection;
  /** null = started, not yet finished (see prisma/schema.prisma). */
  status: CallStatus | null;
  startedAt: string;
  /**
   * When the call was actually picked up, when the reporting client knows it.
   * Null means "not reported" -- which is the normal case today, since
   * ConbunCall_V4 derives its outcome from the OS CallLog and that has no
   * answer timestamp. Never inferred from `durationSeconds`.
   */
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  /** Free-text detail behind a MISSED/REJECTED/FAILED outcome; null when none was reported. `status` stays the field to branch on. */
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  hasRecording: boolean;
  /** What Android reported for the recording it matched, when it reported one. Null = no recording registered, or registered without a duration. */
  recordingDurationSeconds: number | null;
  recordingStatus: string | null;
  /** Recording metadata, as registered by POST /api/calls/{id}/recording. Never audio bytes -- see lib/storage/index.ts. */
  recordingStorageKey: string | null;
  recordingMimeType: string | null;
  recordingSizeBytes: number | null;
  transcriptStatus: string | null;
  /** The transcript Android's Whisper pipeline uploaded. Null until it arrives -- never a placeholder. */
  transcriptText: string | null;
  transcriptLanguage: string | null;
  aiSummaryStatus: string | null;
  /**
   * The submitted summary, as stored. Every field is null/empty until an AI
   * pipeline actually submits one (POST /api/calls/{id}/summary) -- this
   * backend generates nothing and fabricates nothing (CRM_ARCHITECTURE.md
   * Phase 7). Carried on the call itself because it comes from the same
   * single joined query the call does; fetching it costs nothing extra.
   */
  aiSummaryText: string | null;
  aiSummaryKeyPoints: string[];
  aiSummaryCustomerIntent: string | null;
  aiSummarySentiment: string | null;
  aiSummaryRecommendedAction: string | null;
  aiSummaryFollowUpRequired: boolean;
  aiSummaryGeneratedAt: string | null;
  /**
   * The CRM call request this call fulfilled, if it came from the CRM's
   * "Call" button. Read-only here -- set by POST /api/calls's optional
   * `callRequestId` (see startCall), never by this shape.
   */
  callRequestId: string | null;
  callRequestStatus: CallRequestStatus | null;
  callRequestRequestedAt: string | null;
  /**
   * The reporting client's own idempotency key for this call, if it sent one.
   * Read-only here -- it exists so a retry finds this row instead of creating
   * a second one (see StartCallInput.clientCallId).
   */
  clientCallId: string | null;
}

/**
 * One row of the customers list's call column -- the total plus just enough
 * about the most recent call to describe it, fetched for a whole page of
 * customers at once (see getCustomerCallOverviews).
 */
export interface CustomerCallSummary {
  customerId: string;
  totalCalls: number;
  lastCallAt: string;
  /** null = that call was started but never finished (see `Call.status`). */
  lastCallStatus: CallStatus | null;
  lastCallDurationSeconds: number;
}

/**
 * POST /api/calls -- "start" a call. customerId is required (CLAUDE.md
 * rule #1: never phone number as the relationship). `callRequestId` is
 * optional -- when present (Android fulfilling a CRM-created
 * CallRequest), the matching request's `callId` is linked to the new call
 * as a side effect; omitting it is unaffected/unchanged, existing callers
 * that don't know about CallRequest keep working exactly as before.
 */
export interface StartCallInput {
  customerId: string;
  phoneNumber: string;
  direction: CallDirection;
  agentId?: string | null;
  startedAt?: string;
  callRequestId?: string | null;
  /**
   * Which handset is reporting. Optional and additive; an unknown id is
   * registered on the spot rather than rejected, because a call must never be
   * lost for want of a device row (see lib/devices/service.ts).
   */
  deviceId?: string | null;
  /**
   * The client's own stable identity for this call -- an idempotency key.
   *
   * Send the same value on every retry of the same call and this endpoint
   * returns the call it already created instead of creating another. That is
   * what makes an Android retry, a network retry, an app restart, an offline
   * queue flush and a manual "Send to CRM" all safe to repeat. Must be unique
   * across every device, so namespace it: `<deviceId>:<callLogRowId>`.
   *
   * Optional. A client that doesn't send one keeps exactly the behaviour it
   * has today, and is still protected on the CRM-initiated path by
   * `callRequestId` (see lib/calls/service.ts).
   */
  clientCallId?: string | null;
}

/**
 * PATCH /api/calls/{id} -- "finish" a call, or amend any of these fields.
 *
 * This is the call-result report, and it is deliberately the whole of it: it
 * never waits on recording discovery, transcription or summarization, which
 * arrive later through their own endpoints and can fail without touching
 * anything recorded here.
 *
 * `answeredAt` and `failureReason` are new and optional. A client that sends
 * neither -- which is every client today -- behaves exactly as it always has.
 */
export interface UpdateCallInput {
  status?: CallStatus;
  answeredAt?: string | null;
  endedAt?: string;
  durationSeconds?: number;
  failureReason?: string | null;
  agentId?: string | null;
  /**
   * Which handset reported the outcome. Additive, and for the client that only
   * learns (or only bothers to send) its device id at finish time. It fills in
   * a call's device when the call doesn't have one yet and otherwise leaves it
   * alone -- a call's device is a fact about what already happened, not
   * something a later request should be able to rewrite.
   */
  deviceId?: string | null;
}

export interface CustomerCallStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  totalConversationSeconds: number;
  lastContactedAt: string | null;
  lastContactedByAgent: string | null;
}

/**
 * Everything the Customer Detail page's call area needs, from one query:
 * a bounded page of call history plus stats computed over *all* of this
 * customer's calls, not just the page.
 */
export interface CustomerCallOverview {
  calls: Call[];
  stats: CustomerCallStats;
  /** True when this customer has more calls than `calls` contains. */
  truncated: boolean;
}
