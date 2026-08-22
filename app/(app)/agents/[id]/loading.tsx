import { TableSkeleton } from "@/components/crm/TableSkeleton";

/**
 * The agent detail route's Suspense boundary.
 *
 * Not the fix for this page being slow -- that is the two changes that removed
 * real waiting: one fewer database round trip (getAgentWithDevices) and the
 * hover prefetch on the agents list, which does the page's work before the
 * click rather than after it. This is what the page shows in the cases those
 * cannot cover: a keyboard or direct-URL arrival, or a first visit with a cold
 * connection. Without a `loading` boundary at all, Next.js has nothing to
 * stream and the browser sits on the previous page until the server is
 * finished.
 *
 * Shaped like the real page (identity band, two stat panels, the call table)
 * so it resolves into the page instead of reflowing into it -- same reasoning,
 * and same visual language, as the customer detail route's boundary.
 */
export default function Loading() {
  const panel = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
  } as const;

  return (
    <div aria-busy="true" aria-label="Loading agent activity">
      {/* Page header: back link + agent name */}
      <div style={{ height: 20, width: 220, background: "var(--color-neutral-soft)", borderRadius: 6, marginBottom: "var(--space-5)" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* Identity band: avatar, name, devices */}
        <div style={{ ...panel, height: 120 }} />
        {/* Call activity: eight compact stat cards */}
        <div style={{ ...panel, height: 168 }} />
        {/* Customer reach: six compact stat cards */}
        <div style={{ ...panel, height: 140 }} />
        {/* Calls -- the majority of the page, same as the real one */}
        <div style={{ ...panel, padding: "var(--space-6)" }}>
          <TableSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}
