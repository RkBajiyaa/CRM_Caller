"use client";

import { useEffect } from "react";
import { StateMessage } from "@/components/crm/StateMessage";
import { Button } from "@/components/ui/Button";

export default function CustomerDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Customer detail page error:", error);
  }, [error]);

  return (
    <StateMessage
      tone="danger"
      title="Couldn't load this customer"
      description="Something went wrong loading this customer's record. Try again or go back to the list."
      action={<Button onClick={() => reset()}>Try again</Button>}
    />
  );
}
