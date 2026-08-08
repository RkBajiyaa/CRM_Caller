import { cookies } from "next/headers";
import { verifyAgentToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { Sidebar } from "@/components/crm/Sidebar";
import styles from "../shell.module.css";

// Shell (sidebar + content) for every authenticated CRM page. middleware.ts
// already guarantees a valid session cookie exists before this ever
// renders, so the claims here are for display only (current agent name/
// role in the sidebar), not a second auth gate.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const claims = token ? await verifyAgentToken(token) : null;

  return (
    <div className={styles.shell}>
      <Sidebar agentName={claims?.name ?? null} agentRole={claims?.role ?? null} />
      <main className={styles.content}>
        <div className={styles.inner}>{children}</div>
      </main>
    </div>
  );
}
