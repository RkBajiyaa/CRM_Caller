import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/crm/LoginForm";
import { Card } from "@/components/ui/Card";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Sign in -- Conbun CRM" };

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>CC</span>
          <span className={styles.brandName}>Conbun CRM</span>
        </div>
        <Card>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>Use your agent account to access customer records.</p>
          {/* useSearchParams (reading ?from=) requires a Suspense boundary */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
