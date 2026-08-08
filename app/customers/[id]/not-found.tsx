import { StateMessage } from "@/components/crm/StateMessage";
import { LinkButton } from "@/components/ui/Button";

export default function CustomerNotFound() {
  return (
    <StateMessage
      title="Customer not found"
      description="This customer doesn't exist or may have been removed."
      action={<LinkButton href="/customers">Back to customers</LinkButton>}
    />
  );
}
