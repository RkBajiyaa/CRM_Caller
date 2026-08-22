/**
 * Shared Device types. Mirrors prisma/schema.prisma's Device model.
 *
 * A Device is one physical phone running Conbun Call. Its `id` is the stable
 * `deviceId` the Android app already generates for itself (`CONBUN-<8 hex>`,
 * see `SettingsRepository.ensureDeviceIdGenerated`) -- the CRM does not mint a
 * second one; see the schema comment for why.
 */

export interface Device {
  id: string;
  label: string | null;
  agentId: string | null;
  /** Denormalized for display only -- resolved by a join, never stored. */
  agentName: string | null;
  isActive: boolean;
  /** Last time this device contacted the backend. Null = never heard from. */
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * How long a device may go without contacting the backend before the CRM
 * stops calling it online.
 *
 * Conbun Call polls for call requests every 4 seconds while foregrounded, so a
 * device that has said nothing for three minutes is genuinely not listening --
 * backgrounded, offline, or the app is closed. Deliberately generous relative
 * to the poll interval: this decides whether an agent is told "that phone
 * isn't picking up requests right now", and a false alarm on a brief network
 * blip would be worse than a slightly stale "online".
 *
 * This is presentation only. Nothing about a device being offline marks any
 * call, request, transcript or summary as failed -- an offline phone is
 * expected to sync later (sprint item 12), and "not yet received" is not a
 * failure.
 */
export const DEVICE_ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function isDeviceOnline(lastSeenAt: string | null, now: number = Date.now()): boolean {
  if (!lastSeenAt) return false;
  return now - Date.parse(lastSeenAt) < DEVICE_ONLINE_WINDOW_MS;
}

/**
 * `POST /api/devices` -- register or claim a device.
 *
 * `id` is the one field the client owns, because it is the device's own name
 * for itself. Everything else is CRM-side administration.
 */
export interface RegisterDeviceInput {
  id: string;
  label?: string | null;
  agentId?: string | null;
}

/** `PATCH /api/devices/{id}` -- CRM-side administration: naming a device, assigning it to an agent, retiring it. */
export interface UpdateDeviceInput {
  label?: string | null;
  /** `null` explicitly unassigns; omitting the field leaves the assignment alone. */
  agentId?: string | null;
  isActive?: boolean;
}
