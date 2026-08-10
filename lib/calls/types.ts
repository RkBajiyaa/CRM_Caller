/** Shared Call types. Mirrors prisma/schema.prisma's Call model field-for-field. */

import type { CallRequestStatus } from "@/lib/call-requests/types";

export type CallDirection = "INCOMING" | "OUTGOING";
export type CallStatus = "ANSWERED" | "MISSED" | "REJECTED" | "FAILED";

export const CALL_DIRECTIONS: CallDirection[] = ["INCOMING", "OUTGOING"];
export const CALL_STATUSES: CallStatus[] = ["ANSWERED", "MISSED", "REJECTED", "FAILED"];

export interface Call {
  id: string;
  customerId: string;
  agentId: string | null;
  agentName: string | null;
  phoneNumber: string;
  direction: CallDirection;
  /** null = started, not yet finished (see prisma/schema.prisma). */
  status: CallStatus | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
  hasRecording: boolean;
  /** What Android reported for the recording it matched, when it reported one. Null = no recording registered, or registered without a duration. */
  recordingDurationSeconds: number | null;
  recordingStatus: string | null;
  transcriptStatus: string | null;
  /** The transcript Android's Whisper pipeline uploaded. Null until it arrives -- never a placeholder. */
  transcriptText: string | null;
  transcriptLanguage: string | null;
  aiSummaryStatus: string | null;
  /**
   * The CRM call request this call fulfilled, if it came from the CRM's
   * "Call" button. Read-only here -- set by POST /api/calls's optional
   * `callRequestId` (see startCall), never by this shape.
   */
  callRequestId: string | null;
  callRequestStatus: CallRequestStatus | null;
}

/**
 * One row of the customers list's call column -- the total plus just enough
 * about the most recent call to describe it, fetched for a whole page of
 * customers at once (see getCallSummariesForCustomers).
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
}

/** PATCH /api/calls/{id} -- "finish" a call, or amend any of these fields. */
export interface UpdateCallInput {
  status?: CallStatus;
  endedAt?: string;
  durationSeconds?: number;
  agentId?: string | null;
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
