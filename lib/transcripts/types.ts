export type ProcessingStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface Transcript {
  id: string;
  callId: string;
  text: string | null;
  language: string | null;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/calls/{id}/transcript -- Android's existing Whisper pipeline is the source of `text`; this backend does not transcribe anything itself. */
export interface SubmitTranscriptInput {
  text?: string | null;
  language?: string | null;
  processingStatus?: ProcessingStatus;
}
