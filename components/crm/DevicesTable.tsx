"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/agents/types";
import type { Device } from "@/lib/devices/types";
import { isDeviceOnline } from "@/lib/devices/types";
import { registerDeviceRequest, updateDeviceRequest } from "@/lib/api-client/devices";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/crm/StateMessage";
import { formatDateTime } from "@/lib/format";
import styles from "./DevicesTable.module.css";

/**
 * The Agent <-> Device association, as an operator manages it.
 *
 * This is where "Agent A -> Device A" is actually established. Devices mostly
 * arrive here on their own: a phone that contacts the backend is registered
 * automatically (see lib/devices/service.ts), so the usual job here is naming
 * an unassigned device and pointing it at an agent, not typing an id in.
 *
 * "Online" is a reading of `lastSeenAt`, nothing more -- it says the phone was
 * polling recently, and an offline phone is expected to sync later rather than
 * having failed at anything (sprint item 12).
 */
export function DevicesTable({ devices, agents }: { devices: Device[]; agents: Agent[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(device: Device, agentId: string) {
    setBusyId(device.id);
    await updateDeviceRequest(device.id, { agentId: agentId === "" ? null : agentId });
    setBusyId(null);
    router.refresh();
  }

  async function rename(device: Device, label: string) {
    const next = label.trim();
    if (next === (device.label ?? "")) return;
    setBusyId(device.id);
    await updateDeviceRequest(device.id, { label: next === "" ? null : next });
    setBusyId(null);
    router.refresh();
  }

  async function toggleActive(device: Device) {
    setBusyId(device.id);
    await updateDeviceRequest(device.id, { isActive: !device.isActive });
    setBusyId(null);
    router.refresh();
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await registerDeviceRequest({
      id: newId.trim(),
      label: newLabel.trim() || null,
      agentId: newAgentId || null,
    });
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error.error || "Could not register device.");
      return;
    }
    setNewId("");
    setNewLabel("");
    setNewAgentId("");
    setAdding(false);
    router.refresh();
  }

  return (
    <div>
      {devices.length === 0 ? (
        <StateMessage
          title="No devices yet"
          description="A phone registers itself the first time the Conbun Call app contacts this backend. You can also add one here if you already know its device ID."
        />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colId}>Device ID</th>
              <th className={styles.colLabel}>Name</th>
              <th className={styles.colAgent}>Agent</th>
              <th className={styles.colSeen}>Last seen</th>
              <th className={styles.colStatus}>State</th>
              <th className={styles.colActions}>
                <span className={styles.srOnly}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const online = isDeviceOnline(device.lastSeenAt);
              return (
                <tr key={device.id}>
                  <td className={styles.mono} title={device.id}>
                    {device.id}
                  </td>
                  <td>
                    <input
                      className={styles.inlineInput}
                      defaultValue={device.label ?? ""}
                      placeholder="Unnamed"
                      aria-label={`Name for device ${device.id}`}
                      disabled={busyId === device.id}
                      onBlur={(e) => rename(device, e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={device.agentId ?? ""}
                      aria-label={`Agent for device ${device.id}`}
                      disabled={busyId === device.id}
                      onChange={(e) => assign(device, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.muted}>
                    {device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "Never"}
                  </td>
                  <td>
                    {!device.isActive ? (
                      <Badge tone="neutral">Retired</Badge>
                    ) : online ? (
                      <Badge tone="success">Online</Badge>
                    ) : (
                      <Badge tone="neutral">Offline</Badge>
                    )}
                  </td>
                  <td className={styles.actionsCell}>
                    <Button variant="ghost" onClick={() => toggleActive(device)} disabled={busyId === device.id}>
                      {busyId === device.id ? "..." : device.isActive ? "Retire" : "Restore"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className={styles.footer}>
        {adding ? (
          <form className={styles.addForm} onSubmit={handleAdd}>
            <input
              className={styles.input}
              placeholder="Device ID (e.g. CONBUN-1A2B3C4D)"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              required
            />
            <input
              className={styles.input}
              placeholder="Name (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <select className={styles.select} value={newAgentId} onChange={(e) => setNewAgentId(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
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
            + Add device
          </Button>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
