"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CallActivityPulse } from "@/lib/calls/pulse";

/** Fastest we ever ask. A phone call's states change on human timescales; sub-second polling would only add load. */
const MIN_POLL_MS = 3_000;
/** Slowest we back off to while still watching -- covers the long tail where a transcript or summary is still being produced. */
const MAX_POLL_MS = 20_000;
/**
 * Absolute ceiling on one watch session, regardless of what the server says.
 *
 * The server stops asking for polls on its own once a call is finished and
 * its pipeline has settled or timed out (lib/calls/pulse.ts). This backstop
 * covers the one case that has no natural end: a request Android never picks
 * up -- phone offline, app killed -- which stays legitimately "Queued"
 * forever. Without this, that tab would poll for the rest of the day.
 */
const MAX_WATCH_MS = 20 * 60 * 1_000;

/**
 * Keeps the customer detail page current while a call is actually happening,
 * so the normal active-call workflow needs no manual browser refresh:
 * click Call -> queued -> dialing -> in progress -> outcome -> recording
 * badge -> transcript -> summary, each appearing on its own.
 *
 * Renders nothing. Mounted only by the customer detail page.
 *
 * How it avoids being a polling loop in the bad sense:
 *
 *   - **It usually does not run at all.** The page mounts it with
 *     `active={false}` whenever there is nothing in flight and no recent call
 *     still waiting on a stage, which is the normal state of most customers.
 *     A quiet CRM makes zero requests.
 *   - **It asks a fingerprint, not the page.** Each poll is one small JSON
 *     response (see /api/customers/{id}/call-status). The expensive part --
 *     `router.refresh()`, which re-renders the page's four queries -- happens
 *     only when the fingerprint actually changed.
 *   - **It backs off.** 3s while things are changing, stretching towards 20s
 *     while nothing is, and snapping back to 3s the moment something moves.
 *   - **It stops.** When the server reports `active: false` -- terminal call,
 *     pipeline settled -- the loop ends. `MAX_WATCH_MS` ends it regardless.
 *   - **It pauses in a background tab** and checks immediately on return, so
 *     a tab left open in another window costs nothing and is still correct
 *     when looked at.
 */
export function CallActivityRefresher({
  customerId,
  version,
  active,
}: {
  customerId: string;
  /**
   * The fingerprint the server rendered this page with -- the baseline the
   * first poll is compared against.
   *
   * This is the page's own `callActivityPulse(...).version`, computed from the
   * same 25 calls and 5 requests the endpoint reads (lib/calls/pulse.ts), so
   * the two are directly comparable and a match really does mean "the page you
   * are looking at is current".
   *
   * Deliberately the version and not the lifecycle: a recording, transcript or
   * summary landing in the gap between this page being rendered and the first
   * poll does not change the lifecycle (CONNECTED stays CONNECTED), so a
   * lifecycle comparison would see no change -- and since the version then
   * stays constant from that point on, nothing would ever trigger the refresh
   * and that stage would stay invisible until the agent navigated away and
   * back. Comparing versions catches it on the first poll.
   */
  version: string;
  /** Whether the server thinks anything is still expected to change. False = don't poll at all. */
  active: boolean;
}) {
  const router = useRouter();
  // Survives re-renders (including the ones our own refresh causes), so a
  // refresh never re-triggers itself: the version we acted on is the version
  // the freshly rendered page corresponds to.
  const lastVersion = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = MIN_POLL_MS;
    const startedAt = Date.now();

    function schedule(ms: number) {
      if (cancelled) return;
      timer = setTimeout(tick, ms);
    }

    async function tick() {
      if (cancelled) return;
      if (Date.now() - startedAt > MAX_WATCH_MS) return;

      // Nobody is looking -- don't spend a request, but keep the loop alive so
      // it resumes on its own if the tab is never focused again explicitly.
      if (document.visibilityState === "hidden") {
        schedule(MAX_POLL_MS);
        return;
      }

      try {
        const res = await fetch(`/api/customers/${customerId}/call-status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as { data: CallActivityPulse };
        if (cancelled) return;

        const pulse = body.data;
        // First poll has no stored fingerprint, so it compares against the one
        // the page was rendered with instead -- that catches anything that
        // landed in the moments between render and mount.
        const changed = pulse.version !== (lastVersion.current ?? version);
        lastVersion.current = pulse.version;

        if (changed) {
          delay = MIN_POLL_MS;
          router.refresh();
        } else {
          delay = Math.min(MAX_POLL_MS, Math.round(delay * 1.5));
        }

        // The server decides when watching ends, not this component.
        if (!pulse.active) return;
      } catch {
        // Offline, a redeploy, a slow database -- back off and try again
        // rather than giving up or hammering. Nothing is shown to the agent:
        // the page's data is still whatever the server last rendered, which
        // is not wrong, only possibly behind.
        delay = Math.min(MAX_POLL_MS, Math.round(delay * 1.6));
      }

      schedule(delay);
    }

    function onVisible() {
      if (document.visibilityState !== "visible" || cancelled) return;
      // Coming back to the tab is exactly when being out of date is most
      // visible -- check now instead of waiting out the backed-off timer.
      if (timer) clearTimeout(timer);
      delay = MIN_POLL_MS;
      schedule(0);
    }

    document.addEventListener("visibilitychange", onVisible);
    schedule(delay);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [customerId, version, active, router]);

  return null;
}
