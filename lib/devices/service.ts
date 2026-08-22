import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Device, RegisterDeviceInput, UpdateDeviceInput } from "@/lib/devices/types";

/**
 * Devices: the Agent <-> Device half of the Agent + Device + Customer + Call
 * relationship.
 *
 * Two rules shape everything in this file.
 *
 * 1. **An unknown device is registered, never rejected.** A phone that reports
 *    a call the CRM has never heard of is still reporting a real call, and
 *    losing it because an admin had not pre-registered the handset would be
 *    exactly the silent data loss this sprint exists to remove. An
 *    auto-registered device arrives with `agentId: null` -- honestly
 *    unassigned, and visible as such in the CRM so someone can link it.
 *
 * 2. **`ON CONFLICT` rather than `upsert()`.** Prisma's `upsert()` needs the
 *    interactive-transaction session this environment's Neon adapter cannot
 *    open (CLAUDE.md rule §3.11). Postgres's own `INSERT ... ON CONFLICT` is
 *    not just a workaround here, it is the better tool: it is one statement
 *    and one round trip, and this project's adapter serializes statements, so
 *    a find-then-create pair would be twice the latency on a path a phone hits
 *    constantly.
 */

/** `status`-free row shape; every column is a plain scalar because this project's Neon adapter can't deserialize Postgres enums through `$queryRaw`. */
interface DeviceRow {
  device_id: string;
  label: string | null;
  agent_id: string | null;
  agent_name: string | null;
  is_active: boolean;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: DeviceRow): Device {
  return {
    id: row.device_id,
    label: row.label,
    agentId: row.agent_id,
    agentName: row.agent_name,
    isActive: row.is_active,
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const DEVICE_COLUMNS = Prisma.sql`
  d."device_id", d."label", d."agent_id", ag."name" AS agent_name,
  d."is_active", d."last_seen_at", d."created_at", d."updated_at"
`;

/** Every registered handset, assigned first, then newest. One statement including the agent name. */
export async function listDevices(): Promise<Device[]> {
  const rows = await prisma.$queryRaw<DeviceRow[]>`
    SELECT ${DEVICE_COLUMNS}
    FROM "devices" d
    LEFT JOIN "agents" ag ON ag."agent_id" = d."agent_id"
    ORDER BY (d."agent_id" IS NULL) ASC, d."created_at" ASC
  `;
  return rows.map(toDomain);
}

export async function getDeviceById(id: string): Promise<Device | null> {
  const rows = await prisma.$queryRaw<DeviceRow[]>`
    SELECT ${DEVICE_COLUMNS}
    FROM "devices" d
    LEFT JOIN "agents" ag ON ag."agent_id" = d."agent_id"
    WHERE d."device_id" = ${id}
  `;
  return rows.length > 0 ? toDomain(rows[0]) : null;
}

/** The devices belonging to one agent, newest-seen first -- what the agent detail page shows. */
export async function listDevicesForAgent(agentId: string): Promise<Device[]> {
  const rows = await prisma.$queryRaw<DeviceRow[]>`
    SELECT ${DEVICE_COLUMNS}
    FROM "devices" d
    LEFT JOIN "agents" ag ON ag."agent_id" = d."agent_id"
    WHERE d."agent_id" = ${agentId}
    ORDER BY d."last_seen_at" DESC NULLS LAST, d."created_at" ASC
  `;
  return rows.map(toDomain);
}

/**
 * Register a device, or update the parts of an existing one this call was
 * given. Idempotent by construction: the same `id` always lands on the same
 * row, so a phone re-registering on every app start creates nothing new.
 *
 * `label`/`agentId` are only written when actually supplied -- a device
 * re-registering itself with just its id never clears the name or the agent an
 * admin assigned it in the CRM. `COALESCE` on the excluded value expresses
 * exactly that, and does it in the one statement.
 */
export async function registerDevice(input: RegisterDeviceInput): Promise<Device | null> {
  const now = new Date();
  const label = input.label ?? null;
  const agentId = input.agentId ?? null;

  try {
    await prisma.$executeRaw`
      INSERT INTO "devices" ("device_id", "label", "agent_id", "created_at", "updated_at")
      VALUES (${input.id}, ${label}, ${agentId}, ${now}, ${now})
      ON CONFLICT ("device_id") DO UPDATE SET
        "label"      = COALESCE(EXCLUDED."label", "devices"."label"),
        "agent_id"   = COALESCE(EXCLUDED."agent_id", "devices"."agent_id"),
        "updated_at" = ${now}
    `;
  } catch (error) {
    // P2003 = foreign key violation, i.e. `agentId` doesn't name a real agent.
    // A bad reference from the caller, which is a 404 rather than a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return null;
    }
    throw error;
  }
  return getDeviceById(input.id);
}

/**
 * CRM-side administration: naming a device, assigning it to an agent (or
 * explicitly unassigning it with `agentId: null`), retiring it.
 *
 * Unlike `registerDevice`, an explicit `null` here *is* a value -- this is the
 * path a human uses, and "unassign this device" has to be expressible.
 */
export async function updateDevice(id: string, patch: UpdateDeviceInput): Promise<Device | null> {
  try {
    await prisma.device.update({
      where: { id },
      data: {
        ...(patch.label !== undefined && { label: patch.label }),
        ...(patch.agentId !== undefined && { agentId: patch.agentId }),
        ...(patch.isActive !== undefined && { isActive: patch.isActive }),
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025 = no such device; P2003 = agentId doesn't name a real agent.
      if (error.code === "P2025" || error.code === "P2003") return null;
    }
    throw error;
  }
  return getDeviceById(id);
}

/**
 * Which device should place a call for this agent.
 *
 * Prefers the handset that has actually been heard from most recently, so an
 * agent who has been issued a replacement phone gets requests on the one they
 * are carrying rather than the one in a drawer. Retired (`is_active = false`)
 * devices are never chosen. Returns null when the agent has no usable device
 * at all, which is a real state -- the request is then left unrouted rather
 * than aimed at a phone that does not exist.
 */
export async function resolveDeviceIdForAgent(agentId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ device_id: string }[]>`
    SELECT "device_id"
    FROM "devices"
    WHERE "agent_id" = ${agentId} AND "is_active" = TRUE
    ORDER BY "last_seen_at" DESC NULLS LAST, "created_at" ASC
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0].device_id : null;
}
