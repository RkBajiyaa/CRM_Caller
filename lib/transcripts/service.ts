import type { TranscriptModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type { Transcript, SubmitTranscriptInput } from "@/lib/transcripts/types";

function toDomain(row: TranscriptModel): Transcript {
  return {
    id: row.id,
    callId: row.callId,
    text: row.text,
    language: row.language,
    processingStatus: row.processingStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getTranscriptByCallId(callId: string): Promise<Transcript | null> {
  const row = await prisma.transcript.findUnique({ where: { callId } });
  return row ? toDomain(row) : null;
}

/** find-then-create-or-update, not upsert() -- see lib/customers/prisma-store.ts. */
export async function submitTranscript(callId: string, input: SubmitTranscriptInput): Promise<Transcript> {
  const existing = await prisma.transcript.findUnique({ where: { callId } });

  if (existing) {
    const row = await prisma.transcript.update({
      where: { callId },
      data: {
        ...(input.text !== undefined && { text: input.text }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.processingStatus !== undefined && { processingStatus: input.processingStatus }),
      },
    });
    return toDomain(row);
  }

  const row = await prisma.transcript.create({
    data: {
      callId,
      text: input.text ?? null,
      language: input.language ?? null,
      // Submitting text with no explicit status implies it's finished, not pending.
      processingStatus: input.processingStatus ?? (input.text ? "DONE" : "PENDING"),
    },
  });
  return toDomain(row);
}
