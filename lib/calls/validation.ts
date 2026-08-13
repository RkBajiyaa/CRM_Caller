import { z } from "zod";
import { CALL_DIRECTIONS, CALL_STATUSES } from "@/lib/calls/types";

export const startCallSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  phoneNumber: z.string().trim().min(1, "phoneNumber is required"),
  direction: z.enum(CALL_DIRECTIONS),
  agentId: z.string().trim().min(1).optional().nullable(),
  startedAt: z.string().datetime({ offset: true }).optional(),
  /** Optional -- links this call back to the CallRequest it fulfills, see lib/calls/service.ts. */
  callRequestId: z.string().trim().min(1).optional().nullable(),
});

/**
 * The call-result report. Every field is optional, and the two new ones
 * (`answeredAt`, `failureReason`) are additive: ConbunCall_V4 sends exactly
 * `{status, endedAt, durationSeconds}` today and is unaffected.
 *
 * `failureReason` is capped rather than unbounded -- it is a human-readable
 * reason ("Call rejected by the other side", a carrier cause code), never a
 * place to park a stack trace or a transcript.
 */
export const updateCallSchema = z.object({
  status: z.enum(CALL_STATUSES).optional(),
  answeredAt: z.string().datetime({ offset: true }).optional().nullable(),
  endedAt: z.string().datetime({ offset: true }).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  failureReason: z.string().trim().max(500).optional().nullable(),
  agentId: z.string().trim().min(1).optional().nullable(),
});
