import type { Metadata } from "next";
import { PageHeader } from "@/components/crm/PageHeader";
import { CustomerForm } from "@/components/crm/CustomerForm";
import { Card } from "@/components/ui/Card";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Add New User -- Conbun CRM" };

export default function NewCustomerPage() {
  return (
    <div className={styles.formWrap}>
      <PageHeader
        title="Add New User"
        subtitle="Customer ID and CRM entry date are generated automatically."
        backHref="/customers"
        backLabel="Customers"
      />
      <Card>
        <CustomerForm />
      </Card>
    </div>
  );
}
