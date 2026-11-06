import { and, desc, eq, gte, like, lt, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/platform/db/client";
import { auditLog } from "@/platform/db/schema";

export const STATUSES = ["success", "denied", "invalid", "failed", "disabled"] as const;
export type Status = (typeof STATUSES)[number];
export const PAGE_SIZE = 50;

export type AuditFilters = {
  app?: string;
  actor?: string;
  action?: string;
  status?: Status;
  /** Inclusive, YYYY-MM-DD. */
  from?: string;
  /** Inclusive, YYYY-MM-DD. */
  to?: string;
  /** Substring match on entity_id or request_id. */
  q?: string;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Turns URL query params into a validated filter object. Unknown/garbage values are dropped, never thrown. */
export function parseFilters(params: Params): AuditFilters {
  const status = first(params.status);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  const from = first(params.from);
  const to = first(params.to);
  return {
    app: first(params.app),
    actor: first(params.actor),
    action: first(params.action),
    status: (STATUSES as readonly string[]).includes(status ?? "") ? (status as Status) : undefined,
    from: isDate(from) ? from : undefined,
    to: isDate(to) ? to : undefined,
    q: first(params.q),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** The SQL conditions for a filter. `status` can be excluded so the summary strip can count all statuses. */
export function buildConditions(f: AuditFilters, opts: { includeStatus?: boolean } = {}): SQL[] {
  const c: SQL[] = [];
  if (f.app) c.push(eq(auditLog.appSlug, f.app));
  if (f.actor) c.push(eq(auditLog.actorId, f.actor));
  if (f.action) c.push(eq(auditLog.action, f.action));
  if (f.status && opts.includeStatus !== false) c.push(eq(auditLog.status, f.status));
  if (f.from) c.push(gte(auditLog.ts, `${f.from}T00:00:00.000Z`));
  if (f.to) c.push(lt(auditLog.ts, `${nextDay(f.to)}T00:00:00.000Z`));
  if (f.q) {
    const pattern = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    c.push(or(like(auditLog.entityId, pattern), like(auditLog.requestId, pattern))!);
  }
  return c;
}

function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Query string for a filter, so links (pagination, status chips) keep the other filters. */
export function toQuery(f: Partial<AuditFilters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "" || (k === "page" && v === 1)) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type AuditPage = {
  rows: (typeof auditLog.$inferSelect)[];
  total: number;
  page: number;
  pageCount: number;
  /** Counts per status for the same filter, ignoring the status filter itself. */
  counts: Record<Status, number>;
};

export function queryAudit(db: Db, f: AuditFilters): AuditPage {
  const where = and(...buildConditions(f));
  const total = db.select({ n: sql<number>`count(*)` }).from(auditLog).where(where).get()?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const rows = db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all();

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const grouped = db
    .select({ status: auditLog.status, n: sql<number>`count(*)` })
    .from(auditLog)
    .where(and(...buildConditions(f, { includeStatus: false })))
    .groupBy(auditLog.status)
    .all();
  for (const g of grouped) counts[g.status] = g.n;

  return { rows, total, page, pageCount, counts };
}

/** Distinct values used to populate the filter dropdowns. */
export function filterOptions(db: Db) {
  const apps = db.selectDistinct({ v: auditLog.appSlug }).from(auditLog).orderBy(auditLog.appSlug).all().map((r) => r.v);
  const actions = db.selectDistinct({ v: auditLog.action }).from(auditLog).orderBy(auditLog.action).all().map((r) => r.v);
  const actors = db
    .selectDistinct({ id: auditLog.actorId, name: auditLog.actorName })
    .from(auditLog)
    .orderBy(auditLog.actorName)
    .all();
  return { apps, actions, actors };
}

export function getAuditRow(db: Db, id: number) {
  return db.select().from(auditLog).where(eq(auditLog.id, id)).get();
}
