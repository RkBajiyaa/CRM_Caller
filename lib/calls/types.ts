/** Shared Call types. Mirrors prisma/schema.prisma's Call model field-for-field. */

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
  transcriptStatus: string | null;
  aiSummaryStatus: string | null;
}

/** POST /api/calls -- "start" a call. customerId is required (CLAUDE.md rule #1: never phone number as the relationship). */
export interface StartCallInput {
  customerId: string;
  phoneNumber: string;
  direction: CallDirection;
  agentId?: string | null;
  startedAt?: string;
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
