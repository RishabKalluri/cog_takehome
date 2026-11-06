import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { auditLog } from "@/platform/db/schema";
import { can, hasRole } from "@/platform/authz/rbac";
import type { User } from "@/platform/auth/users";
import { ActionButton, ActionForm } from "@/platform/ui/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, Select, SubmitButton, TextArea } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { HIGH_RISK_THRESHOLD, kycCases, type CaseStatus, type KycCase } from "./schema";
import { DocBadge, RiskBadge, StatusBadge, statusLabel } from "./ui";

export function CaseDetail({ user, id }: { user: User; id: number }) {
  const db = getDb();
  const c = db.select().from(kycCases).where(eq(kycCases.id, id)).get();
  if (!c) notFound();

  const history = db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.appSlug, manifest.slug), eq(auditLog.entityId, String(id))))
    .orderBy(desc(auditLog.id))
    .all();

  return (
    <>
      <PageHeader
        title={`Case #${c.id} · ${c.customerName}`}
        description={`Opened ${new Date(c.createdAt).toLocaleString()} · last updated ${new Date(c.updatedAt).toLocaleString()}`}
        actions={
          <Link href={`/apps/${manifest.slug}`} className="text-sm text-zinc-600 underline-offset-2 hover:underline">
            ← Back to queue
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Customer">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Name">{c.customerName}</Field>
              <Field label="Email">
                <span className="break-all">{c.customerEmail}</span>
              </Field>
              <Field label="Country">{c.country}</Field>
              <Field label="Risk score">
                <RiskBadge score={c.riskScore} />
              </Field>
              <Field label="Status">
                <StatusBadge status={c.status} />
              </Field>
              <Field label="Assignee">{c.assigneeName ?? <span className="text-zinc-400">unassigned</span>}</Field>
              {c.decisionReason && (
                <div className="sm:col-span-2">
                  <Field label={c.status === "escalated" ? "Escalation reason" : c.status === "approved" || c.status === "rejected" ? "Decision reason" : "Last note"}>
                    <p className="whitespace-pre-wrap text-zinc-800">{c.decisionReason}</p>
                  </Field>
                </div>
              )}
            </dl>
          </Card>
          <Card title="Documents">
            <ul className="flex flex-wrap gap-2">
              {c.documents.map((d) => (
                <li key={d.type}>
                  <DocBadge doc={d} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div>
          <Actions user={user} c={c} />
        </div>
      </div>
      <Card title={`History (${history.length})`}>
        {history.length === 0 ? (
          <EmptyState>No actions recorded for this case yet. (Seeded state is not audited.)</EmptyState>
        ) : (
          <ol className="divide-y divide-zinc-100">
            {history.map((h) => {
              const before = parseStatus(h.before);
              const after = parseStatus(h.after);
              return (
                <li key={h.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3 text-sm">
                  <span className="w-40 shrink-0 font-mono text-xs text-zinc-500">{new Date(h.ts).toLocaleString()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{h.actorName}</span> · <span className="font-mono text-xs">{h.action}</span>
                    {before && after && before !== after && (
                      <span className="ml-2 text-zinc-600">
                        {statusLabel[before]} → {statusLabel[after]}
                      </span>
                    )}
                    {h.error && <p className="mt-0.5 text-xs text-red-700">{h.error}</p>}
                  </span>
                  <Badge tone={h.status === "success" ? "green" : h.status === "denied" ? "red" : "amber"}>{h.status}</Badge>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-900">{children}</dd>
    </div>
  );
}

function parseStatus(json: string | null): CaseStatus | null {
  if (!json) return null;
  try {
    return (JSON.parse(json) as { status?: CaseStatus }).status ?? null;
  } catch {
    return null;
  }
}

/** Shows only the transitions this user may attempt from the current state. The gateway re-checks everything. */
function Actions({ user, c }: { user: User; c: KycCase }) {
  const reviewer = can(user, manifest, "claim");
  const supervisor = hasRole(user, manifest, "supervisor");
  const isAssignee = c.assigneeId === user.id;
  const highRisk = c.riskScore >= HIGH_RISK_THRESHOLD;
  const app = manifest.slug;
  const input = { id: c.id };
  const blocks: React.ReactNode[] = [];

  if (c.status === "pending" && reviewer) {
    blocks.push(
      <div key="claim">
        <ActionButton app={app} action="claim" input={input} label="Claim this case" variant="primary" />
      </div>,
    );
  }

  if (c.status === "in_review" && isAssignee) {
    if (highRisk) {
      blocks.push(
        <Callout key="hr" tone="amber">
          Risk score {c.riskScore} is at or above {HIGH_RISK_THRESHOLD}. Reviewers cannot approve this case — escalate it so a supervisor decides.
        </Callout>,
      );
    } else {
      blocks.push(<ReasonForm key="approve" action="approve" input={input} label="Approve" placeholder="Why this customer passes KYC (min 10 chars)" />);
    }
    blocks.push(<ReasonForm key="reject" action="reject" input={input} label="Reject" variant="danger" placeholder="Why this customer fails KYC" />);
    blocks.push(<ReasonForm key="escalate" action="escalate" input={input} label="Escalate to supervisor" variant="secondary" placeholder="What the supervisor needs to know" />);
  }

  if (c.status === "in_review" && (isAssignee || supervisor)) {
    blocks.push(
      <div key="release">
        <ActionButton app={app} action="release" input={input} label={isAssignee ? "Release back to queue" : `Release from ${c.assigneeName}`} />
      </div>,
    );
  }

  if (c.status === "escalated" && supervisor) {
    blocks.push(
      <ActionForm key="decide" app={app} action="supervisorDecide" input={input} className="space-y-2">
        <Select name="decision" defaultValue="approve" aria-label="Decision">
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </Select>
        <TextArea name="reason" rows={3} required minLength={10} placeholder="Supervisor rationale (min 10 chars)" />
        <SubmitButton>Record decision</SubmitButton>
      </ActionForm>,
    );
  }

  if ((c.status === "approved" || c.status === "rejected") && supervisor) {
    blocks.push(<ReasonForm key="reopen" action="reopen" input={input} label="Reopen case" variant="secondary" placeholder="Why this decision should be revisited" />);
  }

  return (
    <Card title="Actions">
      {blocks.length ? (
        <div className="space-y-4">{blocks}</div>
      ) : (
        <p className="text-sm text-zinc-500">{explainNoActions({ c, reviewer, supervisor, isAssignee })}</p>
      )}
    </Card>
  );
}

function explainNoActions({ c, reviewer, supervisor, isAssignee }: { c: KycCase; reviewer: boolean; supervisor: boolean; isAssignee: boolean }) {
  if (!reviewer && !supervisor) return "You have read-only access to this case.";
  if (c.status === "in_review" && !isAssignee) return `${c.assigneeName} is working on this case. Only the assignee (or a supervisor) can move it.`;
  if (c.status === "escalated") return "Waiting for a supervisor to decide.";
  if (c.status === "approved" || c.status === "rejected") return "This case is closed. A supervisor can reopen it.";
  return "Nothing to do here.";
}

function ReasonForm({ action, input, label, placeholder, variant = "primary" }: { action: string; input: { id: number }; label: string; placeholder: string; variant?: "primary" | "secondary" | "danger" }) {
  return (
    <ActionForm app={manifest.slug} action={action} input={input} className="space-y-2">
      <TextArea name="reason" rows={2} required minLength={10} placeholder={placeholder} />
      <SubmitButton variant={variant}>{label}</SubmitButton>
    </ActionForm>
  );
}
