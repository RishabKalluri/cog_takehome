import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const CASE_STATUSES = ["pending", "in_review", "approved", "rejected", "escalated"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type KycDocument = { type: string; status: "verified" | "pending" | "failed" };

export const kycCases = sqliteTable("kyc_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  country: text("country").notNull(),
  /** 0–100; cases at or above HIGH_RISK_THRESHOLD need a supervisor to approve. */
  riskScore: integer("risk_score").notNull(),
  documents: text("documents", { mode: "json" }).$type<KycDocument[]>().notNull(),
  status: text("status", { enum: CASE_STATUSES }).notNull().default("pending"),
  assigneeId: text("assignee_id"),
  assigneeName: text("assignee_name"),
  decisionReason: text("decision_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type KycCase = typeof kycCases.$inferSelect;

export const HIGH_RISK_THRESHOLD = 80;
