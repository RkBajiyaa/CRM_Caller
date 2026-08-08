"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, AgentRole } from "@/lib/agents/types";
import { createAgentRequest, updateAgentRequest } from "@/lib/api-client/agents";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/crm/Avatar";
import { formatDate } from "@/lib/format";
import styles from "./AgentsTable.module.css";

export function AgentsTable({ agents }: { agents: Agent[] }) {
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
            <th className={styles.colEmail}>Email</th>
            <th className={styles.colRole}>Role</th>
            <th className={styles.colStatus}>Status</th>
            <th className={styles.colSince}>Added</th>
            <th className={styles.colActions}>
              <span className={styles.srOnly}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <td>
                <div className={styles.nameCell}>
                  <Avatar name={agent.name} size="sm" />
                  {agent.name}
                </div>
              </td>
              <td className={styles.muted}>{agent.email}</td>
              <td>
                <Badge tone={agent.role === "ADMIN" ? "accent" : "neutral"}>{agent.role === "ADMIN" ? "Admin" : "Agent"}</Badge>
              </td>
              <td>
                <Badge tone={agent.isActive ? "success" : "neutral"}>{agent.isActive ? "Active" : "Inactive"}</Badge>
              </td>
              <td className={styles.muted}>{formatDate(agent.createdAt)}</td>
              <td className={styles.actionsCell}>
                <Button variant="ghost" onClick={() => toggleActive(agent)} disabled={togglingId === agent.id}>
                  {togglingId === agent.id ? "..." : agent.isActive ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
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
