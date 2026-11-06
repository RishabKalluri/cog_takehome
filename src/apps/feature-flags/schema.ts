import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const featureFlags = sqliteTable("feature_flags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  rolloutPercent: integer("rollout_percent").notNull().default(100),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
