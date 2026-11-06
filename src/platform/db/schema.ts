import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Append-only. One row per action invocation, including denied/failed ones. */
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: text("ts").notNull(),
  requestId: text("request_id").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorEmail: text("actor_email").notNull(),
  appSlug: text("app_slug").notNull(),
  appVersion: text("app_version").notNull(),
  action: text("action").notNull(),
  status: text("status", { enum: ["success", "denied", "invalid", "failed", "disabled"] }).notNull(),
  entityId: text("entity_id"),
  input: text("input"),
  before: text("before"),
  after: text("after"),
  error: text("error"),
  gitSha: text("git_sha").notNull(),
  environment: text("environment").notNull(),
  durationMs: integer("duration_ms").notNull(),
});

/** Which version of which app is live in which environment. */
export const deployments = sqliteTable("deployments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appSlug: text("app_slug").notNull(),
  environment: text("environment", { enum: ["dev", "staging", "prod"] }).notNull(),
  version: text("version").notNull(),
  gitSha: text("git_sha").notNull(),
  deployedAt: text("deployed_at").notNull(),
  deployedBy: text("deployed_by").notNull(),
  notes: text("notes"),
});
