import { NextResponse } from "next/server";
import { getCustomerCallPulseInputs } from "@/lib/calls/service";
import { callActivityPulse } from "@/lib/calls/pulse";

/**
 * GET /api/customers/{id}/call-status
 *
 * The CRM's own "is anything happening?" probe -- the endpoint behind
 * components/crm/CallActivityRefresher.tsx, which is what removes the manual
 * browser refresh from the active-call workflow.
 *
 * **New, and CRM-only.** Nothing in the Android contract changes: no existing
 * endpoint's path, method, body or status vocabulary is touched, and
 * `ConbunCall_V4` neither knows nor needs to know this route exists. It is
 * additive by construction (CLAUDE.md §3.9, sprint rule 23).
 *
 * The response is deliberately three small fields rather than the call data
 * itself:
 *
 *   { "data": { "version": "1a2b3c", "lifecycle": "IN_PROGRESS", "active": true } }
 *
 *   `version`   changes when anything the detail page displays about calls
 *               changes. The client re-renders the page (one
 *               `router.refresh()`) only when this differs from what it last
 *               saw -- so a poll that finds nothing new transfers ~80 bytes
 *               and repaints nothing.
 *   `lifecycle` the existing derived vocabulary (lib/call-requests/
 *               lifecycle.ts) -- no new status is invented or stored.
 *   `active`    false means "stop polling"; the client obeys it. This is what
 *               makes the watching terminate instead of running forever.
 *
 * Returning the fingerprint rather than the data is the whole point: the
 * expensive page render happens on real change, not on a timer.
 *
 * One database statement, deliberately (see getCustomerCallPulseInputs for
 * why it is a UNION rather than the obvious two queries -- this project's
 * Neon adapter serializes statements, so a second one is a second full round
 * trip on a path that repeats).
 *
 * An unknown customer id is not a 404 here -- it simply has no calls and no
 * requests, so the honest answer is "nothing is happening, stop polling",
 * which is exactly what a client whose customer was deleted mid-watch should
 * be told.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { calls, requests } = await getCustomerCallPulseInputs(id);
  const pulse = callActivityPulse(calls, requests);

  return NextResponse.json(
    { data: pulse },
    // This is a liveness probe -- a cached one would defeat its own purpose.
    { headers: { "Cache-Control": "no-store" } }
  );
}
