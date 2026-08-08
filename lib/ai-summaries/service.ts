import type { AiSummaryModel } from "@/lib/generated/prisma/models";
import { prisma } from "@/lib/db/prisma";
import type { AiSummary, SubmitAiSummaryInput } from "@/lib/ai-summaries/types";

function toDomain(row: AiSummaryModel): AiSummary {
  return {
    id: row.id,
    callId: row.callId,
    summaryText: row.summaryText,
    keyPoints: row.keyPoints,
    customerIntent: row.customerIntent,
    sentiment: row.sentiment,
    recommendedAction: row.recommendedAction,
    followUpRequired: row.followUpRequired,
    processingStatus: row.processingStatus,
    modelProvider: row.modelProvider,
    modelName: row.modelName,
    generatedAt: row.generatedAt ? row.generatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * No row yet means "not processed" -- returns null rather than a
 * synthesized placeholder, so the API layer decides how to represent
 * "pending" (see app/api/calls/[id]/summary/route.ts) instead of this
 * service inventing data that was never actually written.
 */
export async function getAiSummaryByCallId(callId: string): Promise<AiSummary | null> {
  const row = await prisma.aiSummary.findUnique({ where: { callId } });
  return row ? toDomain(row) : null;
}

/** find-then-create-or-update, not upsert() -- see lib/customers/prisma-store.ts. */
export async function submitAiSummary(callId: string, input: SubmitAiSummaryInput): Promise<AiSummary> {
  const existing = await prisma.aiSummary.findUnique({ where: { callId } });
  const generatedAt = input.summaryText ? new Date() : undefined;

  if (existing) {
    const row = await prisma.aiSummary.update({
      where: { callId },
      data: {
        ...(input.summaryText !== undefined && { summaryText: input.summaryText }),
        ...(input.keyPoints !== undefined && { keyPoints: input.keyPoints }),
        ...(input.customerIntent !== undefined && { customerIntent: input.customerIntent }),
        ...(input.sentiment !== undefined && { sentiment: input.sentiment }),
        ...(input.recommendedAction !== undefined && { recommendedAction: input.recommendedAction }),
        ...(input.followUpRequired !== undefined && { followUpRequired: input.followUpRequired }),
        ...(input.modelProvider !== undefined && { modelProvider: input.modelProvider }),
        ...(input.modelName !== undefined && { modelName: input.modelName }),
        ...(input.processingStatus !== undefined && { processingStatus: input.processingStatus }),
        ...(generatedAt && { generatedAt }),
      },
    });
    return toDomain(row);
  }

  const row = await prisma.aiSummary.create({
    data: {
      callId,
      summaryText: input.summaryText ?? null,
      keyPoints: input.keyPoints ?? [],
      customerIntent: input.customerIntent ?? null,
      sentiment: input.sentiment ?? null,
      recommendedAction: input.recommendedAction ?? null,
      followUpRequired: input.followUpRequired ?? false,
      modelProvider: input.modelProvider ?? null,
      modelName: input.modelName ?? null,
      processingStatus: input.processingStatus ?? (input.summaryText ? "DONE" : "PENDING"),
      generatedAt: generatedAt ?? null,
    },
  });
  return toDomain(row);
}
