"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Action, ActionType } from "@/lib/actions/types";
import { ACTION_TYPES } from "@/lib/actions/types";
import { createActionRequest, updateActionRequest } from "@/lib/api-client/actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/crm/StateMessage";
import { formatDate } from "@/lib/format";
import styles from "./FollowUpList.module.css";

const TYPE_LABEL: Record<ActionType, string> = {
  FOLLOW_UP: "Follow up",
  REACH_OUT: "Reach out again",
  CALLBACK: "Callback",
  OTHER: "Other",
};

const STATUS_BADGE: Record<Action["status"], { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  IN_PROGRESS: { label: "Waiting for customer", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

/**
 * Deliberately small (CRM_ARCHITECTURE.md Phase 8 -- "do not overbuild
 * workflow automation"): a flat list of follow-ups with one action each
 * (mark complete) plus a one-field-at-a-time add form. No due-date
 * reminders, no assignment workflow, no notifications.
 */
export function FollowUpList({ actions, customerId }: { actions: Action[]; customerId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<ActionType>("FOLLOW_UP");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await createActionRequest(customerId, {
      type,
      notes: notes.trim() || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    });
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error.error || "Could not add follow-up.");
      return;
    }
    setNotes("");
    setDueDate("");
    setType("FOLLOW_UP");
    setAdding(false);
    router.refresh();
  }

  async function handleComplete(actionId: string) {
    setUpdatingId(actionId);
    await updateActionRequest(actionId, { status: "COMPLETED" });
    setUpdatingId(null);
    router.refresh();
  }

  const openActions = actions.filter((a) => a.status === "PENDING" || a.status === "IN_PROGRESS");
  const closedActions = actions.filter((a) => a.status === "COMPLETED" || a.status === "CANCELLED");

  return (
    <div>
      {actions.length === 0 && !adding ? (
        <StateMessage title="No follow-ups yet" description="Add a reach-out, callback, or other action to track for this customer." />
      ) : (
        <ul className={styles.list}>
          {[...openActions, ...closedActions].map((action) => (
            <li key={action.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.itemType}>{TYPE_LABEL[action.type]}</span>
                {action.notes && <span className={styles.itemNotes}>{action.notes}</span>}
                <span className={styles.itemMeta}>
                  {action.dueDate && `Due ${formatDate(action.dueDate)}`}
                  {action.dueDate && action.assignedAgentName && " -- "}
                  {action.assignedAgentName && `Assigned to ${action.assignedAgentName}`}
                </span>
              </div>
              <div className={styles.itemActions}>
                <Badge tone={STATUS_BADGE[action.status].tone}>{STATUS_BADGE[action.status].label}</Badge>
                {(action.status === "PENDING" || action.status === "IN_PROGRESS") && (
                  <Button
                    variant="ghost"
                    onClick={() => handleComplete(action.id)}
                    disabled={updatingId === action.id}
                  >
                    {updatingId === action.id ? "..." : "Mark complete"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className={styles.addForm} onSubmit={handleAdd}>
          <select className={styles.select} value={type} onChange={(e) => setType(e.target.value as ActionType)}>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input
            className={styles.input}
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <input className={styles.dateInput} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Adding..." : "Add"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={submitting}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)} className={styles.addTrigger}>
          + Add follow-up
        </Button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
