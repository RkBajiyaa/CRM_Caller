import { TableSkeleton } from "@/components/crm/TableSkeleton";

export default function Loading() {
  return (
    <div>
      <div style={{ height: 22, width: 160, background: "var(--color-neutral-soft)", borderRadius: 6, marginBottom: 24 }} />
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-6)",
        }}
      >
        <TableSkeleton />
      </div>
    </div>
  );
}
