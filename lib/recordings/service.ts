import type { RecordingModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import { getStorageProviderInfo } from "@/lib/storage";
import type { Recording, RegisterRecordingInput } from "@/lib/recordings/types";

function toDomain(row: RecordingModel): Recording {
  return {
    id: row.id,
    callId: row.callId,
    storageProvider: row.storageProvider,
    storageKey: row.storageKey,
    durationSeconds: row.durationSeconds,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    processingStatus: row.processingStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getRecordingByCallId(callId: string): Promise<Recording | null> {
  const row = await prisma.recording.findUnique({ where: { callId } });
  return row ? toDomain(row) : null;
}

/**
 * Registers (or updates) a call's recording metadata. Deliberately
 * find-then-create-or-update instead of `upsert()` -- see
 * lib/customers/prisma-store.ts's comment on why this environment avoids
 * Prisma's interactive-transaction-based operations.
 */
export async function registerRecording(callId: string, input: RegisterRecordingInput): Promise<Recording> {
  const existing = await prisma.recording.findUnique({ where: { callId } });
  const storageProvider = getStorageProviderInfo().name;

  if (existing) {
    const row = await prisma.recording.update({
      where: { callId },
      data: {
        storageProvider,
        ...(input.storageKey !== undefined && { storageKey: input.storageKey }),
        ...(input.durationSeconds !== undefined && { durationSeconds: input.durationSeconds }),
        ...(input.mimeType !== undefined && { mimeType: input.mimeType }),
        ...(input.sizeBytes !== undefined && { sizeBytes: input.sizeBytes }),
        ...(input.processingStatus !== undefined && { processingStatus: input.processingStatus }),
      },
    });
    return toDomain(row);
  }

  const row = await prisma.recording.create({
    data: {
      callId,
      storageProvider,
      storageKey: input.storageKey ?? null,
      durationSeconds: input.durationSeconds ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      processingStatus: input.processingStatus ?? "PENDING",
    },
  });
  return toDomain(row);
}
