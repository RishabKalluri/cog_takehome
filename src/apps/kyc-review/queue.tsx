import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { can } from "@/platform/authz/rbac";
import type { User } from "@/platform/auth/users";
import { ActionButton } from "@/platform/ui/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, Table, Td } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { CASE_STATUSES, kycCases, type CaseStatus } from "./schema";
import { RiskBadge, StatusBadge, statusLabel } from "./ui";

const statusOrder: Record<CaseStatus, number> = { escalated: 0, pending: 1, in_review: 2, approved: 3, rejected: 4 };

export function Queue({ user, searchParams }: { user: User; searchParams: Record<string, string | string[] | undefined> }) {
  const raw = typeof searchParams.status === "string" ? searchParams.status : "open";
  const filter: CaseStatus | "open" | "all" = (CASE_STATUSES as readonly string[]).includes(raw) ? (raw as CaseStatus) : raw === "all" ? "all" : "open";

  const db = getDb();
  const all = db.select().from(kycCases).orderBy(desc(kycCases.riskScore), asc(kycCases.createdAt)).all();
  const rows = all
    .filter((c) => (filter === "all" ? true : filter === "open" ? c.status !== "approved" && c.status !== "rejected" : c.status === filter))
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.riskScore - a.riskScore);
  const counts = Object.fromEntries(CASE_STATUSES.map((s) => [s, all.filter((c) => c.status === s).length])) as Record<CaseStatus, number>;
  const mine = all.filter((c) => c.assigneeId === user.id && c.status === "in_review").length;
  const canClaim = can(user, manifest, "claim");

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "open", label: "Open", count: all.length - counts.approved - counts.rejected },
    ...CASE_STATUSES.map((s) => ({ key: s, label: statusLabel[s], count: counts[s] })),
    { key: "all", label: "All", count: all.length },
  ];

  return (
    <>
      <PageHeader title={manifest.name} description={manifest.description} />
      {!canClaim && (
        <div className="mb-6">
          <Callout tone="neutral">You have read-only access: you can open any case and its history, but cannot claim or decide.</Callout>
        </div>
      )}
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Status filter">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "open" ? `/apps/${manifest.slug}` : `/apps/${manifest.slug}?status=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${t.key === filter ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"}`}
          >
            {t.label} <span className={t.key === filter ? "text-zinc-300" : "text-zinc-400"}>{t.count}</span>
          </Link>
        ))}
      </nav>
      <Card title={`${rows.length} case${rows.length === 1 ? "" : "s"}${mine ? ` · ${mine} assigned to you` : ""}`}>
        {rows.length === 0 ? (
          <EmptyState>No cases match this filter.</EmptyState>
        ) : (
          <Table headers={["Case", "Customer", "Country", "Risk", "Status", "Assignee", ""]}>
            {rows.map((c) => {
              const isMine = c.assigneeId === user.id;
              return (
                <tr key={c.id} className={isMine ? "bg-blue-50/40" : ""}>
                  <Td className="font-mono text-xs text-zinc-500">#{c.id}</Td>
                  <Td>
                    <Link href={`/apps/${manifest.slug}/${c.id}`} className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                      {c.customerName}
                    </Link>
                    <p className="text-xs text-zinc-500">{c.customerEmail}</p>
                  </Td>
                  <Td>{c.country}</Td>
                  <Td>
                    <RiskBadge score={c.riskScore} />
                  </Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td>
                    {c.assigneeName ? (
                      <span className="flex flex-wrap items-center gap-1 whitespace-nowrap">
                        {c.assigneeName}
                        {isMine && <Badge tone="blue">mine</Badge>}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canClaim && c.status === "pending" ? (
                      <ActionButton app={manifest.slug} action="claim" input={{ id: c.id }} label="Claim" variant="primary" />
                    ) : (
                      <Link href={`/apps/${manifest.slug}/${c.id}`} className="text-sm text-zinc-600 underline-offset-2 hover:underline">
                        Open →
                      </Link>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
