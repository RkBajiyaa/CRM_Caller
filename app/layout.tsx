import type { Metadata } from "next";
import "./globals.css";

// Minimal root layout -- html/body/global styles only. The Sidebar/shell
// chrome lives in app/(app)/layout.tsx instead, so the public /login page
// (which sits outside that route group) never gets the authenticated app's
// navigation around it.
export const metadata: Metadata = {
  title: "Conbun CRM",
  description: "Conbun CRM -- customer records, calls, and follow-ups.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
