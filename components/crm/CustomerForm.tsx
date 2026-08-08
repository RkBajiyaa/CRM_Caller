"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { TextField, SelectField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createCustomerRequest } from "@/lib/api-client/customers";
import { CUSTOMER_STATUSES, type CustomerStatus } from "@/lib/customers/types";
import type { Agent } from "@/lib/agents/types";
import styles from "./CustomerForm.module.css";

interface FormState {
  name: string;
  phoneNumber: string;
  location: string;
  assignedAgentId: string;
  status: CustomerStatus;
}

const INITIAL: FormState = {
  name: "",
  phoneNumber: "",
  location: "",
  assignedAgentId: "",
  status: "ACTIVE",
};

const STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "Active",
  FOLLOW_UP: "Follow-up",
  INACTIVE: "Inactive",
  CLOSED: "Closed",
};

/**
 * Add New User form -- deliberately just five fields (name, phone,
 * location, assigned agent, status) for a fast, focused "add a customer"
 * flow. Account creation date and notes exist in the data model/API for
 * later (e.g. an edit screen) but aren't part of this form.
 *
 * "Assigned agent" is a real picker over actual Agent accounts
 * (CRM_ARCHITECTURE.md Phase 3) instead of free text, submitting
 * `assignedAgentId` -- the backend denormalizes the agent's current name
 * into `Customer.assignedAgent` for display, so existing read paths don't
 * need to change.
 *
 * Client-side checks below are for immediate feedback only -- the API
 * route re-validates everything server-side with the same zod schema
 * (lib/customers/validation.ts) and is the authoritative check. `id`/
 * `crmEntryCreatedAt` are never fields here -- the backend generates both
 * (CLAUDE.md rule #5).
 */
export function CustomerForm({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateClientSide(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    const digitCount = (form.phoneNumber.match(/\d/g) ?? []).length;
    if (!form.phoneNumber.trim()) errors.phoneNumber = "Phone number is required";
    else if (digitCount < 7) errors.phoneNumber = "Enter a valid phone number (at least 7 digits)";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateClientSide()) return;

    setSubmitting(true);
    const result = await createCustomerRequest({
      name: form.name.trim(),
      phoneNumber: form.phoneNumber.trim(),
      location: form.location.trim() || null,
      assignedAgentId: form.assignedAgentId || null,
      status: form.status,
    });
    setSubmitting(false);

    if ("error" in result) {
      if (result.status === 409) {
        setFieldErrors((prev) => ({ ...prev, phoneNumber: result.error.error }));
      } else {
        setFormError(result.error.error || "Something went wrong. Please try again.");
      }
      return;
    }

    router.push(`/customers/${result.data.id}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        id="name"
        label="Name"
        required
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        error={fieldErrors.name}
        placeholder="e.g. Priya Sharma"
        autoFocus
      />
      <TextField
        id="phoneNumber"
        label="Phone number"
        required
        value={form.phoneNumber}
        onChange={(e) => set("phoneNumber", e.target.value)}
        error={fieldErrors.phoneNumber}
        placeholder="e.g. +91 98765 43210"
      />
      <div className={styles.row}>
        <TextField
          id="location"
          label="Location"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="e.g. Jaipur, Rajasthan"
        />
        <SelectField
          id="assignedAgentId"
          label="Assigned agent"
          value={form.assignedAgentId}
          onChange={(e) => set("assignedAgentId", e.target.value)}
          hint={agents.length === 0 ? "No agents exist yet -- create one first (Agents page)" : undefined}
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField
        id="status"
        label="Status"
        value={form.status}
        onChange={(e) => set("status", e.target.value as CustomerStatus)}
      >
        {CUSTOMER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </SelectField>

      {formError && <p className={styles.formError}>{formError}</p>}

      <div className={styles.actionsRow}>
        <Button type="button" variant="ghost" onClick={() => router.push("/customers")} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save customer"}
        </Button>
      </div>
    </form>
  );
}
