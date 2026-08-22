import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listDevices, registerDevice } from "@/lib/devices/service";
import { registerDeviceSchema } from "@/lib/devices/validation";

/**
 * GET /api/devices -- every registered handset, with the agent it belongs to.
 * Backs the CRM's Devices section; also lets an operator confirm which phone
 * has been heard from recently (`lastSeenAt`).
 */
export async function GET() {
  const devices = await listDevices();
  return NextResponse.json({ data: devices });
}

/**
 * POST /api/devices -- register (or re-register) a device.
 *
 * Body: `{ "id": "CONBUN-1A2B3C4D", "label"?: string, "agentId"?: string }`.
 * `deviceId` is accepted as an alias for `id`, because that is what the field
 * is called on every other endpoint in this API.
 *
 * Idempotent: registering the same id twice updates the existing row rather
 * than creating a second one, and a re-registration that omits `label`/
 * `agentId` never clears what an admin set in the CRM. Devices also register
 * themselves implicitly the first time they poll for call requests, so calling
 * this at all is optional -- it exists so a phone can announce itself (and
 * claim a label) before it has any work to do.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  // `deviceId` is the name this value carries everywhere else in the API;
  // accepting both here costs one line and removes a foot-gun.
  const raw = body as Record<string, unknown> | null;
  const normalized =
    raw && typeof raw === "object" && raw.id === undefined && raw.deviceId !== undefined
      ? { ...raw, id: raw.deviceId }
      : body;

  const parsed = registerDeviceSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const device = await registerDevice(parsed.data);
  if (!device) {
    return NextResponse.json({ error: "agentId does not match an existing agent." }, { status: 404 });
  }
  return NextResponse.json({ data: device }, { status: 201 });
}
