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

export const updateCallSchema = z.object({
  status: z.enum(CALL_STATUSES).optional(),
  endedAt: z.string().datetime({ offset: true }).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  agentId: z.string().trim().min(1).optional().nullable(),
});
