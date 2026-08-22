import { z } from "zod";

/**
 * A device id is the phone's own identifier, so the CRM validates its shape
 * rather than its contents: non-empty, bounded, and free of the characters
 * that would make it awkward to put in a URL or a log line. Deliberately NOT
 * pinned to Conbun Call's current `CONBUN-<8 hex>` format -- that is the app's
 * business, and hard-coding it here would mean a CRM migration the next time
 * the app changes how it names itself.
 */
export const deviceIdSchema = z
  .string()
  .trim()
  .min(1, "deviceId is required")
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "deviceId may only contain letters, digits, '.', '_', ':' and '-'");

export const registerDeviceSchema = z.object({
  /** Accepts `deviceId` as well as `id`, since that is what every other endpoint in this API calls the same value. */
  id: deviceIdSchema,
  label: z.string().trim().max(120).optional().nullable(),
  agentId: z.string().trim().min(1).optional().nullable(),
});

export const updateDeviceSchema = z.object({
  label: z.string().trim().max(120).optional().nullable(),
  agentId: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * The same rule, applied where **rejecting** the request would cost more than
 * dropping the field.
 *
 * `deviceIdSchema` answers a malformed id with 400, which is right on
 * `GET /api/call-requests?deviceId=` -- silently dropping the filter there
 * would hand one phone another phone's queue, the single outcome that
 * parameter exists to prevent -- and right on the CRM's own `POST
 * /api/call-requests`, where a bad id is an operator typo that should be
 * reported rather than swallowed.
 *
 * It is the wrong answer on the endpoints a phone uses to *report what
 * happened*: `POST /api/calls` and the two PATCHes. Conbun Call's device id is
 * a user-editable field in its Settings screen, and it sends the raw value on
 * those requests (`CallSessionTracker.kt` -- only its call-request poll goes
 * through its own `crmSafeDeviceId` guard). A stray space typed into that
 * settings field would therefore 400 every call report from that handset, and
 * the call, its outcome, its transcript and its summary would all be lost --
 * to protect an attribution column. Dropping the unusable id costs one piece
 * of display metadata; rejecting the request costs the call.
 *
 * So: same rule, different failure mode. An id that doesn't parse is treated
 * as an id that wasn't sent, which the whole devices design already handles
 * honestly ("we don't know which handset", never a guess).
 */
export const reportedDeviceIdSchema = deviceIdSchema.optional().nullable().catch(null);
