import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCallById } from "@/lib/calls/service";
import { getRecordingByCallId, registerRecording } from "@/lib/recordings/service";
import { getStorageProviderInfo } from "@/lib/storage";
import { requireAuth } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const registerRecordingSchema = z.object({
  storageKey: z.string().trim().min(1).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  mimeType: z.string().trim().min(1).optional().nullable(),
  sizeBytes: z.number().int().min(0).optional().nullable(),
  processingStatus: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]).optional(),
});

/** GET /api/calls/{id}/recording -- metadata only, never audio bytes (lib/storage/index.ts). Returns storage-provider status even if no recording is registered yet. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const call = await getCallById(id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const recording = await getRecordingByCallId(id);
  return NextResponse.json({ data: recording, storageProvider: getStorageProviderInfo() });
}

/**
 * POST /api/calls/{id}/recording -- registers recording metadata for a
 * call (Android uploads what it already knows about a recording file it
 * has locally). Does not receive or store audio bytes -- no object
 * storage provider is configured yet (lib/storage/index.ts); `storageKey`
 * is recorded as-is for whenever a real provider exists to resolve it.
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

  const parsed = registerRecordingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const recording = await registerRecording(id, parsed.data);
  return NextResponse.json({ data: recording, storageProvider: getStorageProviderInfo() }, { status: 201 });
}
