"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }

    const redirectTo = searchParams.get("from") || "/customers";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        id="email"
        label="Email"
        type="email"
        required
        autoFocus
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="********"
      />
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" variant="primary" disabled={submitting} className={styles.submit}>
        {submitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
