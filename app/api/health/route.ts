import { NextResponse } from "next/server";

/**
 * Minimal liveness check for the backend/API layer -- establishes the
 * app/api/* boundary (see CRM_ARCHITECTURE.md #3-4) and gives deployment
 * verification something to hit. Deliberately has no database dependency:
 * it must stay green even before Postgres/Prisma are wired up (Phase 2+).
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "conbun-crm-backend",
    timestamp: new Date().toISOString(),
  });
}
