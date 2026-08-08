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
  callId: string | null;
  requestedAt: string;
  updatedAt: string;
}

/** POST /api/call-requests -- the CRM "Call" button. Only customerId comes from the client; phoneNumber/customerName are snapshotted server-side from the customer record, status is always backend-set to PENDING. */
export interface CreateCallRequestInput {
  customerId: string;
}

/** PATCH /api/call-requests/{id} -- Android accepting/finishing a request. */
export interface UpdateCallRequestInput {
  status?: CallRequestStatus;
  callId?: string | null;
}
