import { desc, eq, and, type SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { auditLog } from "../db/schema";

export type AuditEntry = typeof auditLog.$inferInsert;
export type AuditRow = typeof auditLog.$inferSelect;

export function recordAudit(entry: AuditEntry) {
  getDb().insert(auditLog).values(entry).run();
}

export function listAudit(opts: { appSlug?: string; status?: AuditRow["status"]; actorId?: string; limit?: number } = {}): AuditRow[] {
  const filters: SQL[] = [];
  if (opts.appSlug) filters.push(eq(auditLog.appSlug, opts.appSlug));
  if (opts.status) filters.push(eq(auditLog.status, opts.status));
  if (opts.actorId) filters.push(eq(auditLog.actorId, opts.actorId));
  const q = getDb().select().from(auditLog);
  const filtered = filters.length ? q.where(and(...filters)) : q;
  return filtered.orderBy(desc(auditLog.id)).limit(opts.limit ?? 200).all();
}
