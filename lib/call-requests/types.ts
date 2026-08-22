/** Shared CallRequest types. Mirrors prisma/schema.prisma's CallRequest model. */

export type CallRequestStatus = "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED" | "FAILED";

export const CALL_REQUEST_STATUSES: CallRequestStatus[] = [
  "PENDING",
  "ACCEPTED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
];

export interface CallRequest {
  id: string;
  customerId: string;
  phoneNumber: string;
  customerName: string;
  status: CallRequestStatus;
  /**
   * Who this request was raised for, and which handset should place it.
   *
   * Both null means *unrouted*: no particular device was targeted, so every
   * polling device is offered it. That is exactly how every request behaved
   * before routing existed, which is why the fields are nullable rather than
   * required -- nothing already queued, and no client that doesn't send them,
   * changes behaviour.
   */
  agentId: string | null;
  deviceId: string | null;
  callId: string | null;
  requestedAt: string;
  updatedAt: string;
}

/** A call request plus the display names behind its routing ids -- resolved by a join for the CRM's own pages, never stored. */
export interface CallRequestWithTarget extends CallRequest {
  agentName: string | null;
  deviceLabel: string | null;
}

/**
 * POST /api/call-requests -- the CRM "Call" button.
 *
 * `customerId` is the only required field; `phoneNumber`/`customerName` are
 * still snapshotted server-side from the customer record and `status` is still
 * always backend-set to PENDING.
 *
 * `agentId`/`deviceId` are optional routing overrides. When neither is given
 * the CRM resolves them from the customer's assigned agent and that agent's
 * active device -- so the routing works with no change at the call site, and
 * an explicit target is available when one is known (see
 * lib/call-requests/service.ts).
 */
export interface CreateCallRequestInput {
  customerId: string;
  agentId?: string | null;
  deviceId?: string | null;
}

/** PATCH /api/call-requests/{id} -- Android accepting/finishing a request. */
export interface UpdateCallRequestInput {
  status?: CallRequestStatus;
  callId?: string | null;
  /**
   * Which device is acting on the request. Optional and additive: sending it
   * on `{"status":"ACCEPTED"}` is how a device claims an unrouted request, so
   * the CRM can afterwards say which phone actually took it. It never
   * *re*-routes a request that was already aimed at a different device -- see
   * lib/call-requests/service.ts.
   */
  deviceId?: string | null;
}
