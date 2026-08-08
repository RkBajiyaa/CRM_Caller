export type ProcessingStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface AiSummary {
  id: string;
  callId: string;
  summaryText: string | null;
  keyPoints: string[];
  customerIntent: string | null;
  sentiment: string | null;
  recommendedAction: string | null;
  followUpRequired: boolean;
  processingStatus: ProcessingStatus;
  modelProvider: string | null;
  modelName: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * PATCH/POST /api/calls/{id}/summary -- submitted by whatever AI pipeline
 * eventually produces it (e.g. Android's existing OpenAiSummaryProvider,
 * CRM_ARCHITECTURE.md Phase 7). This backend does not generate summaries
 * itself -- there is no AI provider configured here, and nothing in this
 * codebase fabricates summary text.
 */
export interface SubmitAiSummaryInput {
  summaryText?: string | null;
  keyPoints?: string[];
  customerIntent?: string | null;
  sentiment?: string | null;
  recommendedAction?: string | null;
  followUpRequired?: boolean;
  modelProvider?: string | null;
  modelName?: string | null;
  processingStatus?: ProcessingStatus;
}
