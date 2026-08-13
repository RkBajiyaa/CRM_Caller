import { TableSkeleton } from "@/components/crm/TableSkeleton";

/**
 * Shown while the customer detail page's data is in flight -- and, because
 * this is the route's `loading.js` boundary, it is also what Next.js
 * prefetches for a plain `<Link>` to a dynamic route.
 *
 * It mirrors the page's real shape: a compact identity band, a stats strip,
 * then the call history that takes up most of the page. It used to draw a
 * 320px sidebar beside a single panel -- the layout this page had *before*
 * the profile moved into a band across the top -- so every navigation
 * flashed a two-column skeleton and then reflowed into a one-column page.
 * Matching the real layout removes that jump, which is perceived speed for
 * free: no extra query, no extra request, just not lying about what is
 * coming.
 */
export default function Loading() {
  const panel = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
  } as const;

  return (
    <div aria-busy="true" aria-label="Loading customer">
      {/* Page header: back link + customer name */}
      <div style={{ height: 20, width: 200, background: "var(--color-neutral-soft)", borderRadius: 6, marginBottom: "var(--space-5)" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* Identity band */}
        <div style={{ ...panel, height: 128 }} />
        {/* Call activity stats */}
        <div style={{ ...panel, height: 104 }} />
        {/* Call history -- the majority of the page, same as the real one */}
        <div style={{ ...panel, padding: "var(--space-6)" }}>
          <TableSkeleton rows={5} />
        </div>
      </div>
    </div>
  );
}
