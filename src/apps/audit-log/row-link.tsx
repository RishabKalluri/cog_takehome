"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** A table row that navigates on click (cells keep a real <Link> for keyboard/middle-click). */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr onClick={() => router.push(href)} className="cursor-pointer hover:bg-zinc-50">
      {children}
    </tr>
  );
}
