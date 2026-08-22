import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDeviceById, updateDevice } from "@/lib/devices/service";
import { updateDeviceSchema } from "@/lib/devices/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/devices/{id} */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const device = await getDeviceById(id);
  if (!device) {
    return NextResponse.json({ error: "Device not found." }, { status: 404 });
  }
  return NextResponse.json({ data: device });
}

/**
 * PATCH /api/devices/{id} -- CRM-side administration: name a device, assign it
 * to an agent, or retire it.
 *
 * This is the endpoint that establishes Agent A -> Device A. `"agentId": null`
 * explicitly unassigns; omitting the field leaves the assignment untouched.
 * Retiring a device (`"isActive": false`) stops it being chosen to receive new
 * call requests but changes nothing about the calls it already reported.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const device = await updateDevice(id, parsed.data);
  if (!device) {
    return NextResponse.json(
      { error: "Device not found, or agentId does not match an existing agent." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: device });
}
