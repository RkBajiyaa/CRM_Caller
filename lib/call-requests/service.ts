import { Prisma } from "@/lib/generated/prisma/client";
import type { CallRequestModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import { getCustomerById } from "@/lib/customers/service";
import type {
  CallRequest,
  CreateCallRequestInput,
  UpdateCallRequestInput,
  CallRequestStatus,
} from "@/lib/call-requests/types";

function toDomain(row: CallRequestModel): CallRequest {
  return {
    id: row.id,
    customerId: row.customerId,
    phoneNumber: row.phoneNumber,
    customerName: row.customerName,
    status: row.status,
    callId: row.callId,
    requestedAt: row.requestedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CRM "Call" button -> POST here. `phoneNumber`/`customerName` are
 * snapshotted from the customer record at request time (so Android has
 * what it needs to dial without a second lookup); `status` is always
 * backend-set to PENDING (CLAUDE.md rule #5's spirit -- never
 * client-chosen). Returns null if `customerId` doesn't match a real
 * customer, so the route can 404 instead of creating an orphaned request.
 */
export async function createCallRequest(input: CreateCallRequestInput): Promise<CallRequest | null> {
  const customer = await getCustomerById(input.customerId);
  if (!customer) return null;

  const row = await prisma.callRequest.create({
    data: {
      customerId: customer.id,
      phoneNumber: customer.phoneNumber,
      customerName: customer.name,
      status: "PENDING",
    },
  });
  return toDomain(row);
}

/** GET /api/call-requests?status=PENDING -- Android's polling endpoint. Omit `status` to list all. Oldest-first so Android processes requests in the order they were made. */
export async function listCallRequests(status?: CallRequestStatus): Promise<CallRequest[]> {
  const rows = await prisma.callRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: "asc" },
  });
  return rows.map(toDomain);
}

export async function getCallRequestById(id: string): Promise<CallRequest | null> {
  const row = await prisma.callRequest.findUnique({ where: { id } });
  return row ? toDomain(row) : null;
}

/** PATCH /api/call-requests/{id} -- Android accepting ("status": "ACCEPTED") or finishing ("status": "COMPLETED"/"FAILED"/"CANCELLED", optionally with "callId" once the real Call exists). Returns null if the request doesn't exist. */
export async function updateCallRequest(id: string, patch: UpdateCallRequestInput): Promise<CallRequest | null> {
  try {
    const row = await prisma.callRequest.update({
      where: { id },
      data: {
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.callId !== undefined && { callId: patch.callId }),
      },
    });
    return toDomain(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
