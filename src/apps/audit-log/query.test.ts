import { beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/platform/db/client";
import { recordAudit } from "@/platform/audit/log";
import { buildConditions, PAGE_SIZE, parseFilters, queryAudit, toQuery } from "./query";

const base = {
  actorId: "u-sam", actorName: "Sam Chen", actorEmail: "sam@example.com", appSlug: "example-notes", appVersion: "1.0.0",
  action: "postNote", status: "success" as const, gitSha: "abc1234", environment: "local", durationMs: 3,
};

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
  recordAudit({ ...base, ts: "2026-01-01T10:00:00.000Z", requestId: "r-1", entityId: "note-1" });
  recordAudit({ ...base, ts: "2026-01-02T10:00:00.000Z", requestId: "r-2", entityId: "note-2", status: "denied", actorId: "u-lena", actorName: "Lena Fischer" });
  recordAudit({ ...base, ts: "2026-01-03T10:00:00.000Z", requestId: "r-3", entityId: null, status: "invalid" });
  recordAudit({ ...base, ts: "2026-01-04T23:59:59.000Z", requestId: "r-4", entityId: "case-9", appSlug: "kyc", action: "approve", status: "failed" });
  for (let i = 0; i < PAGE_SIZE + 5; i++) recordAudit({ ...base, ts: "2026-02-01T00:00:00.000Z", requestId: `bulk-${i}`, entityId: `b-${i}` });
});

describe("parseFilters", () => {
  it("accepts known values and drops garbage", () => {
    const f = parseFilters({ app: "kyc", status: "denied", from: "2026-01-01", to: "not-a-date", page: "3", q: ["x", "y"] });
    expect(f).toMatchObject({ app: "kyc", status: "denied", from: "2026-01-01", to: undefined, page: 3, q: "x" });
    expect(parseFilters({ status: "bogus", page: "-1" })).toMatchObject({ status: undefined, page: 1 });
    expect(parseFilters({ app: "  " }).app).toBeUndefined();
    expect(parseFilters({ to: "2026-99-99", from: "2026-02-30" })).toMatchObject({ to: undefined, from: undefined });
  });

  it("round-trips through toQuery (page 1 omitted)", () => {
    expect(toQuery({ app: "kyc", status: "denied", page: 1 })).toBe("?app=kyc&status=denied");
    expect(toQuery({ page: 2 })).toBe("?page=2");
    expect(toQuery({})).toBe("");
  });
});

describe("buildConditions / queryAudit", () => {
  const q = (p: Record<string, string>) => queryAudit(getDb(), parseFilters(p));

  it("adds one condition per active filter", () => {
    expect(buildConditions(parseFilters({}))).toHaveLength(0);
    expect(buildConditions(parseFilters({ app: "a", actor: "b", action: "c", status: "denied", from: "2026-01-01", to: "2026-01-02", q: "x" }))).toHaveLength(7);
    expect(buildConditions(parseFilters({ status: "denied" }), { includeStatus: false })).toHaveLength(0);
  });

  it("filters by app, actor, action and status", () => {
    expect(q({ app: "kyc" }).rows.map((r) => r.requestId)).toEqual(["r-4"]);
    expect(q({ actor: "u-lena" }).rows.map((r) => r.requestId)).toEqual(["r-2"]);
    expect(q({ action: "approve" }).total).toBe(1);
    expect(q({ status: "invalid" }).rows.map((r) => r.requestId)).toEqual(["r-3"]);
  });

  it("date range is inclusive on both ends (whole days, UTC)", () => {
    expect(q({ from: "2026-01-02", to: "2026-01-04" }).rows.map((r) => r.requestId)).toEqual(["r-4", "r-3", "r-2"]);
    expect(q({ to: "2026-01-01" }).total).toBe(1);
    expect(q({ from: "2026-02-01" }).total).toBe(PAGE_SIZE + 5);
  });

  it("free text matches entity_id or request_id", () => {
    expect(q({ q: "note-" }).total).toBe(2);
    expect(q({ q: "r-4" }).rows[0].entityId).toBe("case-9");
    expect(q({ q: "%" }).total).toBe(0);
  });

  it("paginates newest-first at PAGE_SIZE and clamps out-of-range pages", () => {
    const p1 = q({});
    expect(p1.total).toBe(PAGE_SIZE + 9);
    expect(p1.rows).toHaveLength(PAGE_SIZE);
    expect(p1.pageCount).toBe(2);
    expect(p1.rows[0].requestId).toBe(`bulk-${PAGE_SIZE + 4}`);
    const p2 = q({ page: "2" });
    expect(p2.rows).toHaveLength(9);
    expect(p2.rows.at(-1)!.requestId).toBe("r-1");
    expect(q({ page: "99" }).page).toBe(2);
  });

  it("summary counts respect every filter except status", () => {
    const { counts } = q({ app: "example-notes", status: "denied" });
    expect(counts).toEqual({ success: PAGE_SIZE + 6, denied: 1, invalid: 1, failed: 0, disabled: 0 });
  });
});
