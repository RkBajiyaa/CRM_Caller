import { redirect } from "next/navigation";

// The CRM's real landing page is /customers -- see CRM_ARCHITECTURE.md's
// routing plan. Nothing else lives at the root.
export default function RootPage() {
  redirect("/customers");
}
