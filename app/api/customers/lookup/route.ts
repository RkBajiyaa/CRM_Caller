import { NextRequest, NextResponse } from "next/server";
import { findCustomerByPhoneNumber } from "@/lib/customers/service";
import { requireAuth } from "@/lib/auth/session";

/**
 * GET /api/customers/lookup?phoneNumber=...
 * Phone-number lookup, for Android's "identify the customer" step
 * (CRM_ARCHITECTURE.md #11) before starting a call. Returns 404 if no
 * customer has that number yet -- the caller (Android or CRM) then
 * decides whether to create one via POST /api/customers. Phone number is
 * a lookup key here, never treated as identity (CLAUDE.md rule #1) --
 * this route exists specifically so nothing else needs to search by phone
 * directly.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const phoneNumber = request.nextUrl.searchParams.get("phoneNumber")?.trim();
  if (!phoneNumber) {
    return NextResponse.json({ error: "phoneNumber query parameter is required." }, { status: 400 });
  }

  const customer = await findCustomerByPhoneNumber(phoneNumber);
  if (!customer) {
    return NextResponse.json({ error: "No customer found for this phone number." }, { status: 404 });
  }
  return NextResponse.json({ data: customer });
}
