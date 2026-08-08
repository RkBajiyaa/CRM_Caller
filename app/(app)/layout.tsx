import { Sidebar } from "@/components/crm/Sidebar";
import styles from "../shell.module.css";

// Shell (sidebar + content) for every CRM page. No authentication in this
// build (see CHANGELOG.md) -- every visitor goes straight to the CRM.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.content}>
        <div className={styles.inner}>{children}</div>
      </main>
    </div>
  );
}
