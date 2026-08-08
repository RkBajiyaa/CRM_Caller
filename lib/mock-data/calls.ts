/**
 * ============================================================================
 * MOCK / SEED DATA -- CALL HISTORY HAS NO DATABASE TABLE YET
 * ============================================================================
 *
 * Unlike lib/customers/*, there is deliberately no Prisma model for calls
 * yet (CRM_ARCHITECTURE.md #15 Phase 5 -- "do not create unnecessary future
 * tables yet"). This module is purely illustrative: it generates plausible
 * call history for each seeded mock customer so the Customer Detail page's
 * call-activity and call-history sections can be built and reviewed now.
 *
 * When calls/recordings/transcripts/AI summaries get a real table and a
 * real link to Conbun Call's existing call-log/recording/transcription
 * pipeline (CRM_ARCHITECTURE.md #7), this whole file is deleted and
 * replaced by a service backed by that table -- the UI components that
 * consume `CallRecord`/`CustomerCallStats` below are written against
 * those same shapes so they don't need to change, only their data source
 * does (same swap pattern as lib/customers/service.ts).
 *
 * AI summaries are explicitly out of scope this phase: every mock call's
 * `aiSummary` is `null`, and the UI renders a "not available yet"
 * placeholder for it rather than fabricating summary text.
 */
import { mockListCustomers } from "@/lib/customers/mock-store";

export type CallDirection = "INCOMING" | "OUTGOING";
export type CallOutcome = "ANSWERED" | "MISSED";

export interface CallRecord {
  id: string;
  customerId: string;
  timestamp: string;
  agent: string;
  direction: CallDirection;
  outcome: CallOutcome;
  durationSeconds: number;
  hasRecording: boolean;
  transcript: string | null;
  /** Always null -- AI summaries are not implemented yet, see file header. */
  aiSummary: null;
  followUp: string | null;
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

const AGENTS = ["Rahul Bajiya", "Neha Verma", "Amit Rathore"];
const SAMPLE_TRANSCRIPT_LINES = [
  "Customer asked about renewal pricing for next quarter.",
  "Confirmed delivery address and callback window.",
  "Customer requested a follow-up call next week.",
  "Discussed outstanding balance; customer will pay by Friday.",
  "General check-in, no action needed.",
];

// Simple deterministic PRNG (mulberry32) seeded per customer so the same
// customer always gets the same mock call history across renders/requests
// within a process, without needing to persist anything.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash;
}

function generateCallsForCustomer(customerId: string, count: number): CallRecord[] {
  const rand = mulberry32(hashString(customerId));
  const calls: CallRecord[] = [];
  for (let i = 0; i < count; i++) {
    const direction: CallDirection = rand() > 0.5 ? "OUTGOING" : "INCOMING";
    const outcome: CallOutcome = rand() > 0.2 ? "ANSWERED" : "MISSED";
    const durationSeconds = outcome === "ANSWERED" ? Math.floor(30 + rand() * 600) : 0;
    const daysAgo = Math.floor(rand() * 120) + i * 3;
    calls.push({
      id: `${customerId}-call-${i}`,
      customerId,
      timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      agent: AGENTS[Math.floor(rand() * AGENTS.length)],
      direction,
      outcome,
      durationSeconds,
      hasRecording: outcome === "ANSWERED" && rand() > 0.3,
      transcript:
        outcome === "ANSWERED"
          ? SAMPLE_TRANSCRIPT_LINES[Math.floor(rand() * SAMPLE_TRANSCRIPT_LINES.length)]
          : null,
      aiSummary: null,
      followUp: outcome === "MISSED" ? "Retry call" : null,
    });
  }
  return calls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Built once per process from the current mock customer list, so call
// counts referenced on the Users table and the Detail page always agree.
const callsByCustomer = new Map<string, CallRecord[]>(
  mockListCustomers().map((customer) => {
    const rand = mulberry32(hashString(customer.id));
    const count = customer.status === "CLOSED" ? Math.floor(rand() * 3) : Math.floor(rand() * 9) + 1;
    return [customer.id, generateCallsForCustomer(customer.id, count)];
  })
);

export function getMockCallHistory(customerId: string): CallRecord[] {
  return callsByCustomer.get(customerId) ?? [];
}

export function getMockCallStats(customerId: string): CustomerCallStats {
  const calls = getMockCallHistory(customerId);
  const answered = calls.filter((c) => c.outcome === "ANSWERED");
  const missed = calls.filter((c) => c.outcome === "MISSED");
  const incoming = calls.filter((c) => c.direction === "INCOMING");
  const outgoing = calls.filter((c) => c.direction === "OUTGOING");
  const last = calls[0] ?? null;
  return {
    totalCalls: calls.length,
    answeredCalls: answered.length,
    missedCalls: missed.length,
    incomingCalls: incoming.length,
    outgoingCalls: outgoing.length,
    totalConversationSeconds: answered.reduce((sum, c) => sum + c.durationSeconds, 0),
    lastContactedAt: last?.timestamp ?? null,
    lastContactedByAgent: last?.agent ?? null,
  };
}
