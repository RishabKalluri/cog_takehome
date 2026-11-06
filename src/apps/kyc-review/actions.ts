import { z } from "zod";
import { eq } from "drizzle-orm";
import { action, ActionError, defineActions, type ActionContext } from "@/platform/actions/define";
import { hasRole } from "@/platform/authz/rbac";
import { manifest } from "./manifest";
import { HIGH_RISK_THRESHOLD, kycCases, type KycCase } from "./schema";

const idInput = z.object({ id: z.coerce.number().int().positive() });
const reasonInput = idInput.extend({ reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(1000) });

const label = (s: KycCase["status"]) => s.replace("_", " ");

function load(ctx: ActionContext, id: number): KycCase {
  const row = ctx.db.select().from(kycCases).where(eq(kycCases.id, id)).get();
  if (!row) throw new ActionError(`Case #${id} not found`, "not_found");
  return row;
}

function expectStatus(c: KycCase, ...allowed: KycCase["status"][]) {
  if (!allowed.includes(c.status)) {
    throw new ActionError(`Case #${c.id} is ${label(c.status)}; this step needs it to be ${allowed.map(label).join(" or ")}.`, "conflict");
  }
}

function expectAssignee(ctx: ActionContext, c: KycCase, allowSupervisor = false) {
  if (c.assigneeId === ctx.user.id) return;
  if (allowSupervisor && hasRole(ctx.user, manifest, "supervisor")) return;
  throw new ActionError(`Case #${c.id} is assigned to ${c.assigneeName ?? "nobody"}; only the assignee can do this.`, "conflict");
}

function transition(ctx: ActionContext, before: KycCase, patch: Partial<KycCase>, message: string) {
  const after = ctx.db
    .update(kycCases)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(kycCases.id, before.id))
    .returning()
    .get();
  return { entityId: String(before.id), before, after, message };
}

/**
 * The workflow state machine. Every rule is enforced here, never in the UI:
 *
 *   pending ──claim──▶ in_review ──approve──▶ approved ──┐
 *      ▲                 │  │  └─reject───▶ rejected ──┤ reopen (supervisor)
 *      └───release───────┘  └─escalate──▶ escalated     │
 *                                 └─supervisorDecide──▶ approved | rejected
 */
export const actions = defineActions(manifest, {
  claim: action(idInput, (ctx, { id }) => {
    const c = load(ctx, id);
    if (c.status === "in_review" && c.assigneeId !== ctx.user.id) {
      throw new ActionError(`Case #${id} is already claimed by ${c.assigneeName}.`, "conflict");
    }
    if (c.status === "in_review") throw new ActionError(`You already hold case #${id}.`, "conflict");
    expectStatus(c, "pending");
    return transition(ctx, c, { status: "in_review", assigneeId: ctx.user.id, assigneeName: ctx.user.name }, `Case #${id} is now yours.`);
  }),

  release: action(idInput, (ctx, { id }) => {
    const c = load(ctx, id);
    expectStatus(c, "in_review");
    expectAssignee(ctx, c, true);
    return transition(ctx, c, { status: "pending", assigneeId: null, assigneeName: null }, `Case #${id} returned to the queue.`);
  }),

  approve: action(reasonInput, (ctx, { id, reason }) => {
    const c = load(ctx, id);
    expectStatus(c, "in_review");
    expectAssignee(ctx, c);
    if (c.riskScore >= HIGH_RISK_THRESHOLD) {
      throw new ActionError(`Risk score ${c.riskScore} is ${HIGH_RISK_THRESHOLD}+; a reviewer cannot approve it. Escalate to a supervisor.`, "conflict");
    }
    return transition(ctx, c, { status: "approved", decisionReason: reason }, `Case #${id} approved.`);
  }),

  reject: action(reasonInput, (ctx, { id, reason }) => {
    const c = load(ctx, id);
    expectStatus(c, "in_review");
    expectAssignee(ctx, c);
    return transition(ctx, c, { status: "rejected", decisionReason: reason }, `Case #${id} rejected.`);
  }),

  escalate: action(reasonInput, (ctx, { id, reason }) => {
    const c = load(ctx, id);
    expectStatus(c, "in_review");
    expectAssignee(ctx, c, true);
    return transition(ctx, c, { status: "escalated", decisionReason: reason }, `Case #${id} escalated to supervisors.`);
  }),

  supervisorDecide: action(reasonInput.extend({ decision: z.enum(["approve", "reject"]) }), (ctx, { id, reason, decision }) => {
    const c = load(ctx, id);
    expectStatus(c, "escalated");
    const status = decision === "approve" ? "approved" : "rejected";
    return transition(
      ctx,
      c,
      { status, decisionReason: reason, assigneeId: ctx.user.id, assigneeName: ctx.user.name },
      `Case #${id} ${status} by supervisor.`,
    );
  }),

  reopen: action(reasonInput, (ctx, { id, reason }) => {
    const c = load(ctx, id);
    expectStatus(c, "approved", "rejected");
    return transition(ctx, c, { status: "pending", assigneeId: null, assigneeName: null, decisionReason: reason }, `Case #${id} reopened.`);
  }),
});
