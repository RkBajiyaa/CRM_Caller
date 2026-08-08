import { z } from "zod";
import { CALL_REQUEST_STATUSES } from "@/lib/call-requests/types";

export const createCallRequestSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
});

export const updateCallRequestSchema = z.object({
  status: z.enum(CALL_REQUEST_STATUSES).optional(),
  callId: z.string().trim().min(1).optional().nullable(),
});
