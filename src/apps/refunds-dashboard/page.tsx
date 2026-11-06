import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { can } from "@/platform/authz/rbac";
import type { AppPageProps } from "@/platform/registry";
import { ActionButton, ActionForm } from "@/platform/ui/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, SubmitButton, Table, Td, TextInput } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { isLarge, LARGE_REFUND_THRESHOLD_CENTS, REFUND_STATUSES, refunds, type Refund, type RefundStatus } from "./schema";

const statusLabel: Record<RefundStatus, string> = { requested: "Requested", approved: "Approved", rejected: "Rejected", paid: "Paid" };
const statusTone: Record<RefundStatus, "neutral" | "blue" | "green" | "red" | "purple"> = { requested: "blue", approved: "purple", rejected: "red", paid: "green" };
const statusOrder: Record<RefundStatus, number> = { requested: 0, approved: 1, rejected: 2, paid: 3 };

const money = (cents: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);

/** Read-only server component. All writes go through <ActionForm>/<ActionButton> → gateway. */
export default async function Page({ user, searchParams }: AppPageProps) {
  const raw = typeof searchParams.status === "string" ? searchParams.status : "open";
  const filter: RefundStatus | "open" | "all" = (REFUND_STATUSES as readonly string[]).includes(raw) ? (raw as RefundStatus) : raw === "all" ? "all" : "open";

  const all = getDb().select().from(refunds).orderBy(desc(refunds.amountCents), asc(refunds.createdAt)).all();
  const rows = all
    .filter((r) => (filter === "all" ? true : filter === "open" ? r.status === "requested" || r.status === "approved" : r.status === filter))
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.amountCents - a.amountCents);
  const counts = Object.fromEntries(REFUND_STATUSES.map((s) => [s, all.filter((r) => r.status === s).length])) as Record<RefundStatus, number>;

  const isAgent = can(user, manifest, "approve");
  const isLead = can(user, manifest, "approveLarge");
  const hasActions = isAgent || isLead;

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "open", label: "Open", count: counts.requested + counts.approved },
    ...REFUND_STATUSES.map((s) => ({ key: s, label: statusLabel[s], count: counts[s] })),
    { key: "all", label: "All", count: all.length },
  ];

  return (
    <>
      <PageHeader title={manifest.name} description={manifest.description} />
      {!hasActions && (
        <div className="mb-6">
          <Callout tone="neutral">You have read-only access: you can see every refund and its decision, but cannot approve, reject or pay out.</Callout>
        </div>
      )}
      {hasActions && !isLead && (
        <div className="mb-6">
          <Callout tone="amber">
            Refunds of {money(LARGE_REFUND_THRESHOLD_CENTS, "USD").replace("$", "")} or more (in their own currency) need a refunds lead to approve them, and only leads mark refunds as paid.
          </Callout>
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
      <Card title={`${rows.length} refund${rows.length === 1 ? "" : "s"}`}>
        {rows.length === 0 ? (
          <EmptyState>No refunds match this filter.</EmptyState>
        ) : (
          <Table headers={["Order", "Customer", "Amount", "Reason", "Status", "Decision", ...(hasActions ? ["Actions"] : [])]}>
            {rows.map((r) => (
              <tr key={r.id} className={r.status === "requested" && isLarge(r) ? "bg-amber-50/40" : ""}>
                <Td className="whitespace-nowrap">
                  <span className="font-mono text-xs text-zinc-900">{r.orderId}</span>
                  <p className="text-xs text-zinc-500">#{r.id}</p>
                </Td>
                <Td>
                  <span className="font-medium text-zinc-900">{r.customerName}</span>
                  <p className="text-xs text-zinc-500">{r.customerEmail}</p>
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="font-medium tabular-nums">{money(r.amountCents, r.currency)}</span>
                  {isLarge(r) && (
                    <p className="mt-0.5">
                      <Badge tone="amber">large · lead</Badge>
                    </p>
                  )}
                </Td>
                <Td className="max-w-xs min-w-[10rem] break-words text-zinc-600">{r.reason}</Td>
                <Td>
                  <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                </Td>
                <Td className="max-w-xs min-w-[8rem] break-words text-xs text-zinc-600">
                  {r.decidedByName ? (
                    <>
                      <span className="text-zinc-900">{r.decidedByName}</span>
                      {r.decisionNote && <p className="mt-0.5">{r.decisionNote}</p>}
                      {r.paidAt && <p className="mt-0.5 text-zinc-500">Paid {new Date(r.paidAt).toLocaleString()}</p>}
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </Td>
                {hasActions && (
                  <Td className="min-w-[13rem]">
                    <RowActions refund={r} isAgent={isAgent} isLead={isLead} />
                  </Td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

function RowActions({ refund: r, isAgent, isLead }: { refund: Refund; isAgent: boolean; isLead: boolean }) {
  const app = manifest.slug;
  if (r.status === "requested") {
    const large = isLarge(r);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {!large && isAgent && <ActionButton app={app} action="approve" input={{ id: r.id }} label="Approve" variant="primary" />}
          {large && isLead && <ActionButton app={app} action="approveLarge" input={{ id: r.id }} label="Approve as lead" variant="primary" confirm={`Approve ${money(r.amountCents, r.currency)} for ${r.customerName}?`} />}
          {large && !isLead && <span className="text-xs text-zinc-500">Needs a lead to approve</span>}
        </div>
        {isAgent && (
          <ActionForm app={app} action="reject" input={{ id: r.id }} className="flex flex-wrap items-center gap-2">
            <TextInput name="reason" placeholder="Reason for rejecting" required maxLength={500} className="min-w-[9rem] flex-1" />
            <SubmitButton variant="danger">Reject</SubmitButton>
          </ActionForm>
        )}
      </div>
    );
  }
  if (r.status === "approved") {
    return isLead ? (
      <ActionButton app={app} action="markPaid" input={{ id: r.id }} label="Mark paid" variant="secondary" confirm={`Record ${money(r.amountCents, r.currency)} as paid to ${r.customerName}?`} />
    ) : (
      <span className="text-xs text-zinc-500">Awaiting payout by a lead</span>
    );
  }
  return <span className="text-zinc-400">—</span>;
}
