import type { Metadata } from "next";
import "./globals.css";

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
