import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/platform/auth/provider";
import { Shell } from "@/platform/ui/shell";

export const metadata: Metadata = { title: "Internal Apps Platform", description: "Power Apps replacement POC" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="antialiased">
        <Shell user={user}>{children}</Shell>
      </body>
    </html>
  );
}
