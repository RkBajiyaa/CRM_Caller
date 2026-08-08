import type { Metadata } from "next";
import "./globals.css";

// Minimal root layout -- html/body/global styles only. The Sidebar/shell
// chrome lives in app/(app)/layout.tsx instead (a route group, so this
// doesn't affect any URL). No authentication in this build (see
// CHANGELOG.md) -- the route group split is no longer load-bearing for
// keeping a login page chrome-free, just left as-is; every real page
// lives under it.
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
