import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/customers/service";
import { getCustomerCallOverview, CALL_HISTORY_PAGE_SIZE } from "@/lib/calls/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customers/{id}/calls?limit=
 * Call history + aggregate stats for one customer -- what the Customer
 * Detail page's Call activity and Call history sections read. Returned
 * together since the UI always needs both at once, and now *fetched* together
 * too: one joined query instead of a call query plus one statement per
 * relation (see the note at the top of lib/calls/service.ts).
 *
 * `limit` is optional and new (default 25, max 200). `stats` is deliberately
 * unaffected by it -- the aggregates are computed in Postgres across every
 * call this customer has, not across the returned page -- and the new
 * `truncated` flag says whether there are more. Both response additions are
 * additive; no field that was here before was removed or renamed.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : CALL_HISTORY_PAGE_SIZE;

  const { calls, stats, truncated } = await getCustomerCallOverview(id, limit);
  return NextResponse.json({ data: calls, stats, truncated });
}
