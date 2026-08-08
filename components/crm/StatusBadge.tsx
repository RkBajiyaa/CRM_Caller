import type { CustomerStatus } from "@/lib/customers/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const STATUS_CONFIG: Record<CustomerStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  FOLLOW_UP: { label: "Follow-up", tone: "warning" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "danger" },
};

export function StatusBadge({ status }: { status: CustomerStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
