import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/crm/Sidebar";
import styles from "./shell.module.css";

export const metadata: Metadata = {
  title: "Conbun CRM",
  description: "Conbun CRM -- customer records, calls, and follow-ups.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className={styles.shell}>
          <Sidebar />
          <main className={styles.content}>
            <div className={styles.inner}>{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
