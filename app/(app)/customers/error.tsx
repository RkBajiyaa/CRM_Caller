"use client";

import { useEffect } from "react";
import { StateMessage } from "@/components/crm/StateMessage";
import { Button } from "@/components/ui/Button";

export default function CustomersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Customers page error:", error);
  }, [error]);

  return (
    <StateMessage
      tone="danger"
      title="Couldn't load customers"
      description="Something went wrong loading the customer list. This is a real error boundary, not mock data -- try again or check the server logs."
      action={<Button onClick={() => reset()}>Try again</Button>}
    />
  );
}
