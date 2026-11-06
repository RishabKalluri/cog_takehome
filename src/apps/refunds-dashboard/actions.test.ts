import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { invokeAs } from "@/platform/actions/gateway";
import { users } from "@/platform/auth/users";
import { canView } from "@/platform/authz/rbac";
import { listAudit } from "@/platform/audit/log";
import { getDb, resetDbForTests } from "@/platform/db/client";
import { manifest } from "./manifest";
import { LARGE_REFUND_THRESHOLD_CENTS, refunds } from "./schema";
import { seed } from "./seed";

const byId = (id: string) => users.find((u) => u.id === id)!;
const omar = byId("u-omar"); // refunds-agents
const dana = byId("u-dana"); // refunds-leads
const lena = byId("u-lena"); // auditors: view only
const sam = byId("u-sam"); // no access
const APP = manifest.slug;

const reload = (id: number) => getDb().select().from(refunds).where(eq(refunds.id, id)).get()!;
const insert = (patch: Partial<typeof refunds.$inferInsert>) =>
  getDb()
    .insert(refunds)
    .values({
      orderId: "ORD-TEST",
      customerName: "Test Customer",
      customerEmail: "t@example.net",
      amountCents: 20_00,
      currency: "USD",
      reason: "Test refund",
      status: "requested",
      createdBy: "u-omar",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...patch,
    })
    .returning()
    .get();

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
  seed(getDb());
});

describe("refunds-dashboard", () => {
  it("seeds a realistic queue with both small and large requests", () => {
    const all = getDb().select().from(refunds).all();
    expect(all.length).toBeGreaterThanOrEqual(5);
    expect(all.some((r) => r.status === "requested" && r.amountCents < LARGE_REFUND_THRESHOLD_CENTS)).toBe(true);
    expect(all.some((r) => r.status === "requested" && r.amountCents >= LARGE_REFUND_THRESHOLD_CENTS)).toBe(true);
  });

  it("an agent approves a small refund; before/after are audited", async () => {
    const r = insert({ amountCents: 49_99 });
    const res = await invokeAs(omar, APP, "approve", { id: r.id, note: "Within policy." });
    expect(res.ok).toBe(true);
    expect(reload(r.id)).toMatchObject({ status: "approved", decidedById: omar.id, decidedByName: omar.name, decisionNote: "Within policy." });
    const row = listAudit({ appSlug: APP, status: "success" })[0];
    expect(row).toMatchObject({ actorId: omar.id, action: "approve", entityId: String(r.id) });
    expect(JSON.parse(row.before!)).toMatchObject({ status: "requested" });
    expect(JSON.parse(row.after!)).toMatchObject({ status: "approved" });
  });

  it("an agent cannot approve a refund at or above the threshold (500); the attempt is logged as failed", async () => {
    const r = insert({ amountCents: LARGE_REFUND_THRESHOLD_CENTS });
    const res = await invokeAs(omar, APP, "approve", { id: r.id });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("failed");
      expect(res.error).toContain("refunds lead");
    }
    expect(reload(r.id).status).toBe("requested");
    expect(listAudit({ appSlug: APP, status: "failed" })[0]).toMatchObject({ actorId: omar.id, action: "approve" });
  });

  it("approveLarge is denied for an agent and recorded as denied", async () => {
    const r = insert({ amountCents: 1_000_00 });
    const res = await invokeAs(omar, APP, "approveLarge", { id: r.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
    expect(reload(r.id).status).toBe("requested");
    expect(listAudit({ appSlug: APP, status: "denied" })[0]).toMatchObject({ actorId: omar.id, action: "approveLarge" });
  });

  it("a lead approves a large refund with approveLarge, but must not use it below the threshold", async () => {
    const large = insert({ amountCents: 1_000_00 });
    const ok = await invokeAs(dana, APP, "approveLarge", { id: large.id, note: "Double capture confirmed." });
    expect(ok.ok).toBe(true);
    expect(reload(large.id)).toMatchObject({ status: "approved", decidedById: dana.id });

    const small = insert({ amountCents: 499_99 });
    const res = await invokeAs(dana, APP, "approveLarge", { id: small.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("failed");
    expect(reload(small.id).status).toBe("requested");
  });

  it("reject requires a reason; with one it records who rejected and why", async () => {
    const r = insert({});
    const missing = await invokeAs(omar, APP, "reject", { id: r.id, reason: "   " });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe("invalid");
    expect(reload(r.id).status).toBe("requested");

    const res = await invokeAs(omar, APP, "reject", { id: r.id, reason: "Carrier shows signed delivery." });
    expect(res.ok).toBe(true);
    expect(reload(r.id)).toMatchObject({ status: "rejected", decidedById: omar.id, decisionNote: "Carrier shows signed delivery." });
  });

  it("markPaid: only approved refunds, only by a lead", async () => {
    const requested = insert({});
    const tooEarly = await invokeAs(dana, APP, "markPaid", { id: requested.id });
    expect(tooEarly.ok).toBe(false);
    if (!tooEarly.ok) expect(tooEarly.status).toBe("failed");

    const approved = insert({ status: "approved", decidedById: omar.id, decidedByName: omar.name });
    const denied = await invokeAs(omar, APP, "markPaid", { id: approved.id });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe("denied");
    expect(reload(approved.id).status).toBe("approved");

    const res = await invokeAs(dana, APP, "markPaid", { id: approved.id });
    expect(res.ok).toBe(true);
    const after = reload(approved.id);
    expect(after.status).toBe("paid");
    expect(after.paidAt).toBeTruthy();

    const again = await invokeAs(dana, APP, "markPaid", { id: approved.id });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe("failed");
  });

  it("decided refunds cannot be approved or rejected again", async () => {
    const r = insert({ status: "rejected", decidedById: omar.id, decidedByName: omar.name, decisionNote: "x" });
    const res = await invokeAs(omar, APP, "approve", { id: r.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("failed");
    expect(reload(r.id).status).toBe("rejected");
  });

  it("unknown refund ids are reported as not found", async () => {
    const res = await invokeAs(omar, APP, "approve", { id: 999_999 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("not found");
  });

  it("Lena (auditor) can view but every action is denied and audited with her identity", async () => {
    expect(canView(lena, manifest)).toBe(true);
    const r = insert({});
    const res = await invokeAs(lena, APP, "approve", { id: r.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
    expect(reload(r.id).status).toBe("requested");
    expect(listAudit({ appSlug: APP, status: "denied", actorId: lena.id })[0]).toMatchObject({ actorName: lena.name, action: "approve" });
  });

  it("Sam (engineering) cannot see the app and is denied on actions", async () => {
    expect(canView(sam, manifest)).toBe(false);
    const r = insert({});
    const res = await invokeAs(sam, APP, "reject", { id: r.id, reason: "No access." });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
  });
});
