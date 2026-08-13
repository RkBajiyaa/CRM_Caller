"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCallRequest } from "@/lib/api-client/call-requests";
import type { CallLifecycleState } from "@/lib/call-requests/lifecycle";
import { CALL_LIFECYCLE_LABELS, isCallLifecycleActive } from "@/lib/call-requests/lifecycle";
import styles from "./CallRequestButton.module.css";

/**
 * The CRM "Call" button. Creates a PENDING CallRequest for Android to pick
 * up -- it does not place a call itself and does not touch Call/Recording/
 * Transcript data. Unchanged mechanism: POST /api/call-requests with just a
 * customerId, exactly as before.
 *
 * `lifecycle` is the server's view of what this customer's call is already
 * doing (see lib/call-requests/lifecycle.ts). When something is genuinely in
 * flight the button shows that state instead of a bare "Call", so a page
 * refresh no longer forgets that a request was queued a second ago -- which
 * is what made agents click "Call" again and queue duplicates. It stays
 * clickable in every state on purpose: if a request is wedged (the Android
 * app was killed mid-dial, say), re-requesting must remain possible. Queuing
 * twice while a request is still PENDING is now a no-op server-side anyway.
 */
export function CallRequestButton({
  customerId,
  lifecycle = "NONE",
  size = "sm",
}: {
  customerId: string;
  lifecycle?: CallLifecycleState;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "requested" | "error">("idle");

  async function handleClick() {
    // Optimistic, and deliberately so: say "Queued" on the click itself
    // rather than after the round trip. Creating the request is a single
    // INSERT that either works or 404s, and the agent is waiting on the
    // *request* being queued -- never on the phone call, which happens
    // afterwards on the device and is reported separately. Showing "..."
    // until the server answered made an instant action look slow.
    //
    // It is an honest optimism: on failure the button says so below, and it
    // is not claiming the call connected, only that the request was made.
    setState("requested");

    const result = await createCallRequest(customerId);
    if ("error" in result) {
      setState("error");
      return;
    }
    // Pull the server's own view back in, so the row's call state and the
    // rest of the page reflect the new request rather than this local flag.
    // This also clears the client navigation cache (see next.config.ts), so
    // going back to the list cannot show a pre-request view of this customer.
    router.refresh();
  }

  const activeLabel = isCallLifecycleActive(lifecycle) ? CALL_LIFECYCLE_LABELS[lifecycle] : null;
  const label =
    state === "error"
      ? "Retry call"
      : state === "requested"
        ? "Queued"
        : (activeLabel ?? "Call");

  return (
    <button
      type="button"
      className={[
        styles.button,
        size === "md" && styles.md,
        (activeLabel || state === "requested") && styles.active,
        state === "error" && styles.error,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      title={
        activeLabel
          ? `${activeLabel} -- a call request for this customer is already in progress. Click to request again.`
          : "Create a call request for the Android app to pick up"
      }
    >
      {label}
    </button>
  );
}
