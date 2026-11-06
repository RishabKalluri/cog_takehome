import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const REFUND_STATUSES = ["requested", "approved", "rejected", "paid"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

/** Refunds of this amount or more (in the refund's own currency) need a lead (`approveLarge`). */
export const LARGE_REFUND_THRESHOLD_CENTS = 500_00;

export const refunds = sqliteTable("refunds_dashboard_refunds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  /** Minor units (cents, pence) to avoid floating-point money. */
  amountCents: integer("amount_cents").notNull(),
  /** ISO 4217 code, e.g. USD, EUR, GBP. */
  currency: text("currency").notNull(),
  /** Why the customer wants the refund. */
  reason: text("reason").notNull(),
  status: text("status", { enum: REFUND_STATUSES }).notNull().default("requested"),
  decidedById: text("decided_by_id"),
  decidedByName: text("decided_by_name"),
  /** Required when rejecting; optional note when approving. */
  decisionNote: text("decision_note"),
  paidAt: text("paid_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Refund = typeof refunds.$inferSelect;

export const isLarge = (r: Pick<Refund, "amountCents">) => r.amountCents >= LARGE_REFUND_THRESHOLD_CENTS;
