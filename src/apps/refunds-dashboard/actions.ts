import { z } from "zod";
import { eq } from "drizzle-orm";
import { action, ActionError, defineActions, type ActionContext } from "@/platform/actions/define";
import { manifest } from "./manifest";
import { isLarge, LARGE_REFUND_THRESHOLD_CENTS, refunds, type Refund } from "./schema";

const idInput = z.object({ id: z.coerce.number().int().positive() });
const noteInput = idInput.extend({ note: z.string().trim().max(500).optional() });
const reasonInput = idInput.extend({ reason: z.string().trim().min(1, "A reason is required to reject a refund").max(500) });

const threshold = (currency: string) => `${(LARGE_REFUND_THRESHOLD_CENTS / 100).toFixed(0)} ${currency}`;

function load(ctx: ActionContext, id: number): Refund {
  const row = ctx.db.select().from(refunds).where(eq(refunds.id, id)).get();
  if (!row) throw new ActionError(`Refund #${id} not found`, "not_found");
  return row;
}

function expectStatus(r: Refund, allowed: Refund["status"]) {
  if (r.status !== allowed) throw new ActionError(`Refund #${r.id} is ${r.status}; this step needs it to be ${allowed}.`, "conflict");
}

function transition(ctx: ActionContext, before: Refund, patch: Partial<Refund>, message: string) {
  const after = ctx.db
    .update(refunds)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(refunds.id, before.id))
    .returning()
    .get();
  return { entityId: String(before.id), before, after, message };
}

const decidedBy = (ctx: ActionContext, note?: string) => ({ decidedById: ctx.user.id, decidedByName: ctx.user.name, decisionNote: note || null });

/**
 * The state machine. Every rule lives here, never in the UI:
 *
 *   requested ──approve (agent, amount < 500)──────▶ approved ──markPaid (lead)──▶ paid
 *       │    ──approveLarge (lead, amount ≥ 500)──▶ approved
 *       └────reject (agent, reason required)──────▶ rejected
 */
export const actions = defineActions(manifest, {
  approve: action(noteInput, (ctx, { id, note }) => {
    const r = load(ctx, id);
    expectStatus(r, "requested");
    if (isLarge(r)) {
      throw new ActionError(`Refund #${id} is ${threshold(r.currency)} or more; only a refunds lead can approve it (approveLarge).`, "conflict");
    }
    return transition(ctx, r, { status: "approved", ...decidedBy(ctx, note) }, `Refund #${id} approved.`);
  }),

  reject: action(reasonInput, (ctx, { id, reason }) => {
    const r = load(ctx, id);
    expectStatus(r, "requested");
    return transition(ctx, r, { status: "rejected", ...decidedBy(ctx, reason) }, `Refund #${id} rejected.`);
  }),

  approveLarge: action(noteInput, (ctx, { id, note }) => {
    const r = load(ctx, id);
    expectStatus(r, "requested");
    if (!isLarge(r)) {
      throw new ActionError(`Refund #${id} is under ${threshold(r.currency)}; an agent approves it with the ordinary approve step.`, "conflict");
    }
    return transition(ctx, r, { status: "approved", ...decidedBy(ctx, note) }, `Refund #${id} approved by lead.`);
  }),

  markPaid: action(idInput, (ctx, { id }) => {
    const r = load(ctx, id);
    expectStatus(r, "approved");
    return transition(ctx, r, { status: "paid", paidAt: new Date().toISOString() }, `Refund #${id} marked as paid.`);
  }),
});
