import { z } from "zod";
import { CALL_DIRECTIONS, CALL_STATUSES } from "@/lib/calls/types";
import { reportedDeviceIdSchema } from "@/lib/devices/validation";

/**
 * `POST /api/calls` -- the call as it starts.
 *
 * `deviceId` and `clientCallId` are new and both optional: a client that sends
 * neither behaves exactly as it always has. `clientCallId` is the idempotency
 * key that makes retrying safe (see lib/calls/types.ts) -- capped, because it
 * is a short identifier the client already has, never a payload.
 *
 * `deviceId` is validated *leniently* here (`reportedDeviceIdSchema`): an
 * unusable id is dropped, not rejected, because this is the request that
 * carries the call itself and no attribution column is worth losing a call
 * over. See lib/devices/validation.ts for the full reasoning and for where the
 * strict rule still applies.
 */
export const startCallSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  phoneNumber: z.string().trim().min(1, "phoneNumber is required"),
  direction: z.enum(CALL_DIRECTIONS),
  agentId: z.string().trim().min(1).optional().nullable(),
  startedAt: z.string().datetime({ offset: true }).optional(),
  /** Optional -- links this call back to the CallRequest it fulfills, see lib/calls/service.ts. */
  callRequestId: z.string().trim().min(1).optional().nullable(),
  deviceId: reportedDeviceIdSchema,
  /**
   * Lenient for the same reason `deviceId` is, and it is the same failure:
   * Conbun Call builds this as `<deviceId>:<callKey>` from the *unbounded*,
   * user-editable device id in its Settings, so an over-long id would push
   * this past the cap and 400 the whole call report. Dropping it costs the
   * idempotency guarantee for that one report -- the `callRequestId` path
   * still covers every CRM-initiated call -- where rejecting would cost the
   * call. `.catch(null)` rather than a truncation, because a *silently
   * shortened* idempotency key is worse than none: two different calls could
   * collide on it and the second would be answered with the first.
   */
  clientCallId: z.string().trim().min(1).max(200).optional().nullable().catch(null),
});

/**
 * The call-result report. Every field is optional, and the newer ones
 * (`answeredAt`, `failureReason`, `deviceId`) are additive: ConbunCall_V4 sends
 * exactly `{status, endedAt, durationSeconds}` today and is unaffected.
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
  deviceId: reportedDeviceIdSchema,
});
