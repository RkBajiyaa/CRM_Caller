import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCallById } from "@/lib/calls/service";
import { getTranscriptByCallId, submitTranscript } from "@/lib/transcripts/service";
import { requireAuth } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const submitTranscriptSchema = z.object({
  text: z.string().optional().nullable(),
  language: z.string().trim().max(20).optional().nullable(),
  processingStatus: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]).optional(),
});

/** GET /api/calls/{id}/transcript */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const call = await getCallById(id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const transcript = await getTranscriptByCallId(id);
  return NextResponse.json({ data: transcript });
}

/**
 * POST /api/calls/{id}/transcript -- submits the transcript Android's
 * existing Whisper pipeline already produced (CRM_ARCHITECTURE.md Phase
 * 6). This backend does not run its own transcription and does not
 * replace Conbun Call's transcription system.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const call = await getCallById(id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = submitTranscriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const transcript = await submitTranscript(id, parsed.data);
  return NextResponse.json({ data: transcript }, { status: 201 });
}
