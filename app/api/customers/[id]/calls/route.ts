import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/customers/service";
import { listCallsForCustomer, getCallStatsForCustomer } from "@/lib/calls/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customers/{id}/calls
 * Call history + aggregate stats for one customer -- what the Customer
 * Detail page's Call activity and Call history sections read. Returned
 * together since the UI always needs both at once.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const [calls, stats] = [await listCallsForCustomer(id), await getCallStatsForCustomer(id)];
  return NextResponse.json({ data: calls, stats });
}
