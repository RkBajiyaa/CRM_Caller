export type ProcessingStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface Recording {
  id: string;
  callId: string;
  storageProvider: string;
  storageKey: string | null;
  durationSeconds: number | null;
  mimeType: string | null;
  sizeBytes: number | null;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/calls/{id}/recording -- registers metadata only, never audio bytes (see lib/storage/index.ts). */
export interface RegisterRecordingInput {
  storageKey?: string | null;
  durationSeconds?: number | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  processingStatus?: ProcessingStatus;
}
