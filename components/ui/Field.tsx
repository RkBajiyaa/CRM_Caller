import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

interface FieldShellProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldShell({ label, htmlFor, required, error, hint, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {required && <span className={styles.required}> *</span>}
      </label>
      {children}
      {error ? (
        <p className={styles.error}>{error}</p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, required, id, className, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id!} required={required} error={error} hint={hint}>
      <input
        id={id}
        className={[styles.input, error && styles.inputError, className].filter(Boolean).join(" ")}
        aria-invalid={Boolean(error)}
        {...props}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, required, id, className, ...props }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id!} required={required} error={error} hint={hint}>
      <textarea
        id={id}
        className={[styles.textarea, error && styles.inputError, className].filter(Boolean).join(" ")}
        aria-invalid={Boolean(error)}
        rows={4}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, error, hint, required, id, className, children, ...props }: SelectFieldProps) {
  return (
    <FieldShell label={label} htmlFor={id!} required={required} error={error} hint={hint}>
      <select
        id={id}
        className={[styles.select, error && styles.inputError, className].filter(Boolean).join(" ")}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}
