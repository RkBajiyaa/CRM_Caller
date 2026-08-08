import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAgentToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listAgents } from "@/lib/agents/service";
import { PageHeader } from "@/components/crm/PageHeader";
import { AgentsTable } from "@/components/crm/AgentsTable";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Agents -- Conbun CRM" };
export const dynamic = "force-dynamic";

/**
 * Admin-only page (CRM_ARCHITECTURE.md Phase 3). middleware.ts only checks
 * "is authenticated," not role, so this page checks role itself and
 * redirects non-admins -- the API routes underneath (lib/auth/session.ts's
 * requireRole) are the authoritative enforcement either way; this is just
 * so a non-admin doesn't land on a page that would just show empty/error
 * states from 403s.
 */
export default async function AgentsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const claims = token ? await verifyAgentToken(token) : null;
  if (!claims || claims.role !== "ADMIN") {
    redirect("/customers");
  }

  const agents = await listAgents();

  return (
    <div>
      <PageHeader title="Agents" subtitle="Manage who can sign into the CRM and Android app." />
      <Card padded={false}>
        <AgentsTable agents={agents} />
      </Card>
    </div>
  );
}
