import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Client-side navigation cache (Next.js's in-memory Client Cache, keyed by
     * route segment). This is the CRM's browser cache -- deliberately the
     * framework's own rather than a new data-fetching library, which would be
     * a large dependency for something already built in (CLAUDE.md rule #6,
     * sprint rule "do not add a large framework just for caching").
     *
     * Why it has to be set explicitly: both CRM pages are `dynamic =
     * "force-dynamic"` (they read live Postgres data and must never be
     * prerendered), and since Next.js 15 the client cache TTL for dynamic
     * pages defaults to **0 seconds -- i.e. off**. Every "back to the customer
     * list", every "open the customer I was just looking at", was therefore a
     * full server render and a fresh set of database round trips, however
     * cheap those queries had been made. That is exactly the navigation loop
     * this sprint is about.
     *
     * `dynamic: 30` -- used when a Link's `prefetch` prop is unspecified.
     * Re-visiting a page within 30s reuses the payload already in memory, so
     * list -> detail -> back -> another customer -> back is instant. Kept
     * short on purpose: this is call data, and the ceiling on how stale
     * anything can look while nothing is actively happening is 30 seconds.
     * While a call *is* in flight, staleness is handled properly rather than
     * by a timer -- components/crm/CallActivityRefresher.tsx watches the
     * server's own view and refreshes on real change, and every CRM mutation
     * calls `router.refresh()`, which clears this cache immediately.
     *
     * `static: 180` -- used when a Link sets `prefetch={true}`, which is what
     * components/crm/HoverPrefetchLink.tsx does on hover. Three minutes of
     * reuse for a customer the agent has actually pointed at. (Next.js
     * requires this value to be >= 30.)
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
