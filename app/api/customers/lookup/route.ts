import { NextRequest, NextResponse } from "next/server";
import { findCustomerByPhoneNumber } from "@/lib/customers/service";

/**
 * GET /api/customers/lookup?phoneNumber=...
 * Phone-number lookup, for Android's "identify the customer" step
 * (CRM_ARCHITECTURE.md #11) before starting a call. Returns 404 if no
 * customer has that number yet -- the caller (Android or CRM) then
 * decides whether to create one via POST /api/customers. Phone number is
 * a lookup key here, never treated as identity (CLAUDE.md rule #1) --
 * this route exists specifically so nothing else needs to search by phone
 * directly.
 *
 * Matching is exact first, then normalized on the last 10 digits, so
 * "+919335274362" (what Android sends after its own normalization) finds a
 * customer the CRM stored as "+91 93352 74362" -- see
 * lib/customers/prisma-store.ts. The backend does this matching precisely so
 * Android never needs a copy of the customer list. A number that matches no
 * customer still 404s and is still not auto-created: an unknown caller is
 * simply not a CRM customer, and nothing about it is imported.
 */
export async function GET(request: NextRequest) {
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
