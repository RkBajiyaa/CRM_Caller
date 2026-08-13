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

/**
 * find-then-create-or-update, not upsert() -- see lib/customers/prisma-store.ts.
 *
 * A retry that finally succeeds clears an earlier FAILED: submitting real text
 * without naming a status means DONE on the update path, exactly as it already
 * did on the create path. Before this, a transcript that failed once and was
 * then uploaded successfully kept `processingStatus: "FAILED"` forever while
 * holding the finished text -- the status column said the stage had failed and
 * the text column said it hadn't.
 *
 * Nothing is lost in the other direction: text and status are separate
 * columns, and a submission carrying no text never touches the text already
 * stored. That is what lets `{"processingStatus":"FAILED"}` record a failed
 * attempt without destroying an earlier successful transcript.
 */
export async function submitTranscript(callId: string, input: SubmitTranscriptInput): Promise<Transcript> {
  const existing = await prisma.transcript.findUnique({ where: { callId } });

  if (existing) {
    const arrivedWithText = Boolean(input.text && input.text.trim());
    const row = await prisma.transcript.update({
      where: { callId },
      data: {
        ...(input.text !== undefined && { text: input.text }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.processingStatus !== undefined
          ? { processingStatus: input.processingStatus }
          : arrivedWithText && { processingStatus: "DONE" as const }),
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
      processingStatus: input.processingStatus ?? (input.text && input.text.trim() ? "DONE" : "PENDING"),
    },
  });
  return toDomain(row);
}
