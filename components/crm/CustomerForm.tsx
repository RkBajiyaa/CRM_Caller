"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { TextField, SelectField, TextAreaField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createCustomerRequest } from "@/lib/api-client/customers";
import { CUSTOMER_STATUSES, type CustomerStatus } from "@/lib/customers/types";
import styles from "./CustomerForm.module.css";

interface FormState {
  name: string;
  phoneNumber: string;
  location: string;
  assignedAgent: string;
  accountCreatedAt: string; // yyyy-mm-dd from <input type="date">
  status: CustomerStatus;
  notes: string;
}

const INITIAL: FormState = {
  name: "",
  phoneNumber: "",
  location: "",
  assignedAgent: "",
  accountCreatedAt: "",
  status: "ACTIVE",
  notes: "",
};

const STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "Active",
  FOLLOW_UP: "Follow-up",
  INACTIVE: "Inactive",
  CLOSED: "Closed",
};

/**
 * Add New User form. Client-side checks below are for immediate feedback
 * only -- the API route re-validates everything server-side with the same
 * zod schema (lib/customers/validation.ts) and is the authoritative check.
 * `id`/`crmEntryCreatedAt` are never fields here -- the backend generates
 * both (CLAUDE.md rule #5).
 */
export function CustomerForm() {
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
      assignedAgent: form.assignedAgent.trim() || null,
      accountCreatedAt: form.accountCreatedAt ? new Date(form.accountCreatedAt).toISOString() : null,
      status: form.status,
      notes: form.notes.trim() || null,
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
      <div className={styles.grid}>
        <TextField
          id="name"
          label="Name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={fieldErrors.name}
          placeholder="e.g. Priya Sharma"
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
        <TextField
          id="location"
          label="Location"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="e.g. Jaipur, Rajasthan"
        />
        <TextField
          id="assignedAgent"
          label="Assigned agent"
          value={form.assignedAgent}
          onChange={(e) => set("assignedAgent", e.target.value)}
          hint="Free text for now -- no agent directory yet."
          placeholder="e.g. Rahul Bajiya"
        />
        <TextField
          id="accountCreatedAt"
          label="Account / application creation date"
          type="date"
          value={form.accountCreatedAt}
          onChange={(e) => set("accountCreatedAt", e.target.value)}
          hint="Optional. Separate from the CRM entry date, which is set automatically."
        />
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
      </div>

      <TextAreaField
        id="notes"
        label="Notes"
        value={form.notes}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Optional context for whoever picks up this customer next."
      />

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
