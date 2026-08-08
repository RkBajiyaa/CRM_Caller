"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./LogoutButton.module.css";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className={styles.button} onClick={handleLogout} disabled={loading} title="Log out">
      {loading ? "..." : "Log out"}
    </button>
  );
}
