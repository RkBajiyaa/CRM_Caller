"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, AgentRole } from "@/lib/agents/types";
import type { AgentSummary } from "@/lib/agents/activity";
import { createAgentRequest, updateAgentRequest } from "@/lib/api-client/agents";
import { HoverPrefetchLink } from "@/components/crm/HoverPrefetchLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/crm/Avatar";
import { formatDuration } from "@/lib/format";
import styles from "./AgentsTable.module.css";

/**
 * The agent directory, with each agent's activity for the current window
 * beside them.
 *
 * The numbers are deliberately the same four the Agent Activity page leads
 * with, over the same window, so this list is a way *into* that page rather
 * than a second, differently-computed view of the same thing. A dash means the
 * agent made no calls in the window -- not that the data is missing.
 *
 * The name is a HoverPrefetchLink, the same component the customers list uses,
 * and it is the actual answer to "opening an agent takes too long". The agent
 * detail route is `force-dynamic`, and Next.js prefetches a dynamic route only
 * as far as its `loading` boundary -- so a plain `<Link>` fetched the skeleton
 * and left every one of the page's database round trips to happen after the
 * click, with the user watching. Arming the full prefetch on hover/focus moves
 * that work into the moment the cursor lands on the row, so the click renders
 * from memory. Gated on intent rather than `prefetch={true}` for the reason
 * that component documents: an unconditional prefetch would render every
 * agent's full activity page on the server just to serve one click.
 */
export function AgentsTable({
  agents,
  summaries,
  deviceCounts,
  rangeLabel,
  rangeQuery,
}: {
  agents: Agent[];
  summaries: Map<string, AgentSummary>;
  /** How many devices each agent has assigned -- the Agent + Device association, at a glance. */
  deviceCounts: Map<string, number>;
  rangeLabel: string;
  /** Carried onto each agent link so the detail page opens on the window the list is showing. */
  rangeQuery: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AgentRole>("AGENT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const result = await createAgentRequest({ name, email, password, role });
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error.error || "Could not create agent.");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setRole("AGENT");
    setAdding(false);
    router.refresh();
  }

  async function toggleActive(agent: Agent) {
    setTogglingId(agent.id);
    await updateAgentRequest(agent.id, { isActive: !agent.isActive });
    setTogglingId(null);
    router.refresh();
  }

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colName}>Agent</th>
            <th className={styles.colRole}>Role</th>
            <th className={styles.colDevices}>Devices</th>
            <th className={styles.colNum} title={`Calls ${rangeLabel.toLowerCase()}`}>
              Calls
            </th>
            <th className={styles.colNum}>Answered</th>
            <th className={styles.colNum}>Customers</th>
            <th className={styles.colTalk}>Talk time</th>
            <th className={styles.colStatus}>Status</th>
            <th className={styles.colActions}>
              <span className={styles.srOnly}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const summary = summaries.get(agent.id);
            const devices = deviceCounts.get(agent.id) ?? 0;
            return (
              <tr key={agent.id}>
                <td>
                  <HoverPrefetchLink href={`/agents/${agent.id}${rangeQuery}`} className={styles.nameCell}>
                    <Avatar name={agent.name} size="sm" />
                    <span className={styles.nameText}>
                      {agent.name}
                      <span className={styles.email}>{agent.email}</span>
                    </span>
                  </HoverPrefetchLink>
                </td>
                <td>
                  <Badge tone={agent.role === "ADMIN" ? "accent" : "neutral"}>
                    {agent.role === "ADMIN" ? "Admin" : "Agent"}
                  </Badge>
                </td>
                <td className={styles.muted}>{devices > 0 ? devices : "None"}</td>
                <td className={styles.num}>{summary ? summary.totalCalls : "--"}</td>
                <td className={styles.num}>{summary ? summary.answeredCalls : "--"}</td>
                <td className={styles.num}>{summary ? summary.uniqueCustomers : "--"}</td>
                <td className={styles.muted}>
                  {summary && summary.totalTalkTimeSeconds > 0 ? formatDuration(summary.totalTalkTimeSeconds) : "--"}
                </td>
                <td>
                  <Badge tone={agent.isActive ? "success" : "neutral"}>
                    {agent.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className={styles.actionsCell}>
                  <Button variant="ghost" onClick={() => toggleActive(agent)} disabled={togglingId === agent.id}>
                    {togglingId === agent.id ? "..." : agent.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.footer}>
        {adding ? (
          <form className={styles.addForm} onSubmit={handleAdd}>
            <input className={styles.input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input
              className={styles.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className={styles.input}
              type="password"
              placeholder="Temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as AgentRole)}>
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Adding..." : "Add"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={submitting}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            + Add agent
          </Button>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
