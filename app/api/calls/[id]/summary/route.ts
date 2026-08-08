import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCallById } from "@/lib/calls/service";
import { getAiSummaryByCallId, submitAiSummary } from "@/lib/ai-summaries/service";
import { requireAuth } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const submitAiSummarySchema = z.object({
  summaryText: z.string().optional().nullable(),
  keyPoints: z.array(z.string()).optional(),
  customerIntent: z.string().optional().nullable(),
  sentiment: z.string().optional().nullable(),
  recommendedAction: z.string().optional().nullable(),
  followUpRequired: z.boolean().optional(),
  modelProvider: z.string().trim().max(100).optional().nullable(),
  modelName: z.string().trim().max(100).optional().nullable(),
  processingStatus: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]).optional(),
});

/**
 * GET /api/calls/{id}/summary
 * No AI provider is configured in this backend (CRM_ARCHITECTURE.md Phase
 * 7) -- if no summary has ever been submitted for this call, this
 * correctly returns a PENDING placeholder rather than a fabricated one.
 * `data: null` distinguishes "nothing submitted yet" from an actual
 * summary row.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const call = await getCallById(id);
  if (!call) return NextResponse.json({ error: "Call not found." }, { status: 404 });

  const summary = await getAiSummaryByCallId(id);
  if (!summary) {
    return NextResponse.json({ data: null, processingStatus: "PENDING" });
  }
  return NextResponse.json({ data: summary, processingStatus: summary.processingStatus });
}

/**
 * POST /api/calls/{id}/summary -- submitted by whatever AI pipeline
 * eventually produces a real summary (e.g. Android's existing
 * OpenAiSummaryProvider). This endpoint never generates a summary itself
 * -- it only stores what it's given.
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

  const parsed = submitAiSummarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const summary = await submitAiSummary(id, parsed.data);
  return NextResponse.json({ data: summary }, { status: 201 });
}
