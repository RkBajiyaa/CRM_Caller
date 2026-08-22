import { NextRequest, NextResponse } from "next/server";
import { getAgentById } from "@/lib/agents/service";
import { getAgentActivity } from "@/lib/agents/activity";
import { resolveActivityRange, type ActivityPreset } from "@/lib/agents/activity-range";
import { listCallsForAgent } from "@/lib/calls/service";
import { listDevicesForAgent } from "@/lib/devices/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const PRESETS = new Set<ActivityPreset>(["today", "week", "month", "all", "custom"]);

/**
 * GET /api/agents/{id}/activity?range=today|week|month|all&from=&to=&tz=&limit=
 *
 * One agent's call activity: headline numbers, a day-by-day breakdown, the
 * calls themselves, and the devices assigned to them.
 *
 * **CRM-only and additive.** Nothing in the Android contract changes; Conbun
 * Call neither calls this nor needs to know it exists. It reads the `calls`
 * rows Android already writes and invents nothing -- in particular there is no
 * "idle time" here, because the CRM has no attendance data to derive it from
 * (see lib/agents/activity.ts).
 *
 * `range` defaults to `month`. `from`/`to` accept `YYYY-MM-DD` or a full ISO
 * instant and imply `range=custom`. `tz` is the caller's offset from UTC in
 * minutes exactly as `Date.getTimezoneOffset()` reports it (IST = -330), so
 * "today" means the caller's today rather than the server's; omitting it means
 * UTC.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const agent = await getAgentById(id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const search = request.nextUrl.searchParams;
  const rangeParam = search.get("range");
  const preset = rangeParam && PRESETS.has(rangeParam as ActivityPreset) ? (rangeParam as ActivityPreset) : undefined;

  const tzRaw = Number(search.get("tz"));
  // Bounded to the real range of UTC offsets (-14h..+12h expressed as minutes
  // behind UTC), so a junk value can't shift a window by years.
  const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 840 ? tzRaw : 0;

  const range = resolveActivityRange(preset, search.get("from"), search.get("to"), tz);

  const limitRaw = Number(search.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const activity = await getAgentActivity(id, range, tz);
  const calls = await listCallsForAgent(id, range.from, range.to, limit);
  const devices = await listDevicesForAgent(id);

  return NextResponse.json({
    data: {
      agent,
      devices,
      range: {
        preset: range.preset,
        from: range.from ? range.from.toISOString() : null,
        to: range.to ? range.to.toISOString() : null,
      },
      stats: activity.stats,
      days: activity.days,
      calls,
    },
  });
}
