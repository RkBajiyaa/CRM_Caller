import { z } from "zod";
import { ACTION_TYPES, ACTION_STATUSES } from "@/lib/actions/types";

export const createActionSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  callId: z.string().trim().min(1).optional().nullable(),
  assignedAgentId: z.string().trim().min(1).optional().nullable(),
  type: z.enum(ACTION_TYPES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
});

export const updateActionSchema = z.object({
  assignedAgentId: z.string().trim().min(1).optional().nullable(),
  type: z.enum(ACTION_TYPES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.enum(ACTION_STATUSES).optional(),
});
