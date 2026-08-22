import { z } from "zod";
import { CALL_REQUEST_STATUSES } from "@/lib/call-requests/types";
import { deviceIdSchema, reportedDeviceIdSchema } from "@/lib/devices/validation";

export const createCallRequestSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  /** Optional routing overrides -- omitted means "work it out from the customer's assigned agent". */
  agentId: z.string().trim().min(1).optional().nullable(),
  deviceId: deviceIdSchema.optional().nullable(),
});

export const updateCallRequestSchema = z.object({
  status: z.enum(CALL_REQUEST_STATUSES).optional(),
  callId: z.string().trim().min(1).optional().nullable(),
  /** Reported by the phone that is claiming the request -- dropped rather than
   *  rejected if unusable, so a bad device id can never stop a request being
   *  accepted or completed. See lib/devices/validation.ts. */
  deviceId: reportedDeviceIdSchema,
});
