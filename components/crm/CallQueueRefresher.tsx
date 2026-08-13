"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Slower than the detail page's watcher: this re-renders a whole list, and a queue moving from "Queued" to "Dialing" is not a sub-second concern. */
const MIN_POLL_MS = 6_000;
const MAX_POLL_MS = 24_000;
/**
 * The customers list only ever waits on the short window between clicking
 * Call and Android picking the request up (its poller runs every 4s). Five
 * minutes is far past the point where a request that hasn't been accepted is
 * going to be -- the phone is offline, and refreshing a list forever will not
 * change that. The row still shows "Queued" and still updates on navigation.
 */
const MAX_WATCH_MS = 5 * 60 * 1_000;

/**
 * Keeps the customers list's call-state column moving while a call request is
 * genuinely in flight, so an agent who clicks Call from the list sees it
 * progress without reaching for the browser refresh.
 *
 * Renders nothing, and does nothing at all unless `active` -- which the page
 * sets only when some row is actually QUEUED/DIALING/IN_PROGRESS. With a
 * quiet queue (the normal case) this component makes zero requests.
 *
 * Unlike the detail page's watcher this refreshes directly rather than
 * checking a fingerprint first: a list-wide fingerprint would need its own
 * batch endpoint, and the window this runs in is a handful of polls between
 * clicking Call and Android accepting. Refreshing outright is the simpler
 * reliable thing here -- but it is why the cadence is slower, why it backs
 * off, and why `MAX_WATCH_MS` is minutes rather than the detail page's.
 *
 * `router.refresh()` preserves client state, so the search box keeps its text
 * and the table keeps its scroll position across a refresh.
 */
export function CallQueueRefresher({ active }: { active: boolean }) {
  const router = useRouter();

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

    function tick() {
      if (cancelled) return;
      if (Date.now() - startedAt > MAX_WATCH_MS) return;

      // Don't refresh a list nobody is looking at.
      if (document.visibilityState === "hidden") {
        schedule(MAX_POLL_MS);
        return;
      }

      router.refresh();
      delay = Math.min(MAX_POLL_MS, Math.round(delay * 1.4));
      schedule(delay);
    }

    function onVisible() {
      if (document.visibilityState !== "visible" || cancelled) return;
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
  }, [active, router]);

  return null;
}
