import { Badge } from "@/components/ui/Badge";

/**
 * Visible, explicit "this is not real backend data" marker -- used
 * wherever mock/seed data is on screen, per instruction not to let mock
 * data pass as real. Two labels: customer records are seeded in-memory
 * data (no live database connection yet); call history additionally has
 * no database table at all yet (see lib/mock-data/calls.ts).
 */
export function DemoDataBadge({ kind = "customers" }: { kind?: "customers" | "calls" }) {
  return (
    <Badge tone="accent">
      {kind === "customers" ? "Seed data -- no live database connected" : "Sample call data -- no calls table yet"}
    </Badge>
  );
}
