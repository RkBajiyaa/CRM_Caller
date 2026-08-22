import { TableSkeleton } from "@/components/crm/TableSkeleton";

/**
 * The Calls route's Suspense boundary.
 *
 * Same purpose and same shape rules as the agent detail route's: a dynamic
 * route with no `loading` boundary gives Next.js nothing to stream, so the
 * browser sits on the previous page until the server has finished both
 * queries. Shaped like the real page (stat panel, then the call log) so it
 * resolves into the page rather than reflowing into it.
 */
export default function Loading() {
  const panel = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
  } as const;

  return (
    <div aria-busy="true" aria-label="Loading calls">
      <div
        style={{
          height: 20,
          width: 160,
          background: "var(--color-neutral-soft)",
          borderRadius: 6,
          marginBottom: "var(--space-5)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* Headline stat strip + the compact breakdown underneath it */}
        <div style={{ ...panel, height: 260 }} />
        {/* The call log, which is most of the page */}
        <div style={{ ...panel, padding: "var(--space-6)" }}>
          <TableSkeleton rows={8} />
        </div>
      </div>
    </div>
  );
}
