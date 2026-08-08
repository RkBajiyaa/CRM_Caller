import type { Metadata } from "next";
import { listAgents } from "@/lib/agents/service";
import { PageHeader } from "@/components/crm/PageHeader";
import { AgentsTable } from "@/components/crm/AgentsTable";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Agents -- Conbun CRM" };
export const dynamic = "force-dynamic";

/** No authentication in this build (see CHANGELOG.md) -- open to anyone who can reach the CRM, same as every other page. */
export default async function AgentsPage() {
  const agents = await listAgents();

  return (
    <div>
      <PageHeader title="Agents" subtitle="Manage who can be assigned to customers and calls." />
      <Card padded={false}>
        <AgentsTable agents={agents} />
      </Card>
    </div>
  );
}
