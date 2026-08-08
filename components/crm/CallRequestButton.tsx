"use client";

import { useState } from "react";
import { createCallRequest } from "@/lib/api-client/call-requests";
import styles from "./CallRequestButton.module.css";

/**
 * The CRM "Call" button (per-customer-row). Creates a PENDING CallRequest
 * for Android to pick up -- does not place a call itself, does not touch
 * Call/Recording/Transcript data. Once a request is made successfully,
 * the button locks to "Requested" (a fresh page load resets it) so an
 * accidental second click doesn't queue duplicate PENDING requests for
 * the same customer.
 */
export function CallRequestButton({ customerId }: { customerId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "requested" | "error">("idle");

  async function handleClick() {
    setState("loading");
    const result = await createCallRequest(customerId);
    if ("error" in result) {
      setState("error");
      return;
    }
    setState("requested");
  }

  if (state === "requested") {
    return (
      <span className={styles.requested} title="Call request sent -- Android will pick it up">
        Requested
      </span>
    );
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      disabled={state === "loading"}
      title="Create a call request for the Android app to pick up"
    >
      {state === "loading" ? "..." : state === "error" ? "Retry call" : "Call"}
    </button>
  );
}
