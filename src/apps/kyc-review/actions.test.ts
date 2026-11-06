import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { invokeAs } from "@/platform/actions/gateway";
import { users } from "@/platform/auth/users";
import { listAudit } from "@/platform/audit/log";
import { getDb, resetDbForTests } from "@/platform/db/client";
import { kycCases, type KycCase } from "./schema";
import { seed } from "./seed";

const byId = (id: string) => users.find((u) => u.id === id)!;
const marcus = byId("u-marcus"); // reviewer
const dana = byId("u-dana"); // reviewer + supervisor
const lena = byId("u-lena"); // viewer only
const sam = byId("u-sam"); // no access at all
const APP = "kyc-review";

const REASON = "Documents verified and screening clear.";

let lowRiskPending: KycCase;
let highRiskPending: KycCase;
let escalated: KycCase;

const reload = (id: number) => getDb().select().from(kycCases).where(eq(kycCases.id, id)).get()!;
const insert = (patch: Partial<typeof kycCases.$inferInsert>) =>
  getDb()
    .insert(kycCases)
    .values({
      customerName: "Test Person",
      customerEmail: "t@example.net",
      country: "GB",
      riskScore: 10,
      documents: [{ type: "Passport", status: "verified" }],
      status: "pending",
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
  const all = getDb().select().from(kycCases).all();
  lowRiskPending = all.find((c) => c.status === "pending" && c.riskScore < 80)!;
  highRiskPending = all.find((c) => c.status === "pending" && c.riskScore >= 80)!;
  escalated = all.find((c) => c.status === "escalated")!;
});

describe("kyc-review workflow", () => {
  it("claim moves pending → in_review and assigns the actor; a second claim conflicts", async () => {
    const res = await invokeAs(marcus, APP, "claim", { id: lowRiskPending.id });
    expect(res.ok).toBe(true);
    expect(reload(lowRiskPending.id)).toMatchObject({ status: "in_review", assigneeId: marcus.id, assigneeName: marcus.name });

    const again = await invokeAs(dana, APP, "claim", { id: lowRiskPending.id });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.status).toBe("failed");
      expect(again.error).toContain("already claimed by Marcus Reyes");
    }
    const row = listAudit({ appSlug: APP, status: "failed" })[0];
    expect(row.actorId).toBe(dana.id);
    expect(row.action).toBe("claim");
  });

  it("approve by someone other than the assignee fails, by the assignee succeeds with before/after", async () => {
    const other = await invokeAs(dana, APP, "approve", { id: lowRiskPending.id, reason: REASON });
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.status).toBe("failed");
    expect(reload(lowRiskPending.id).status).toBe("in_review");

    const res = await invokeAs(marcus, APP, "approve", { id: lowRiskPending.id, reason: REASON });
    expect(res.ok).toBe(true);
    const row = listAudit({ appSlug: APP, status: "success" })[0];
    expect(row.entityId).toBe(String(lowRiskPending.id));
    expect(JSON.parse(row.before!)).toMatchObject({ status: "in_review" });
    expect(JSON.parse(row.after!)).toMatchObject({ status: "approved", decisionReason: REASON });
  });

  it("rejects a reason shorter than 10 characters as invalid", async () => {
    const c = insert({ status: "in_review", assigneeId: marcus.id, assigneeName: marcus.name });
    const res = await invokeAs(marcus, APP, "reject", { id: c.id, reason: "nope" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("invalid");
    expect(reload(c.id).status).toBe("in_review");
  });

  it("a reviewer cannot approve a high-risk case; escalate → supervisorDecide works", async () => {
    expect((await invokeAs(marcus, APP, "claim", { id: highRiskPending.id })).ok).toBe(true);
    const blocked = await invokeAs(marcus, APP, "approve", { id: highRiskPending.id, reason: REASON });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe("failed");
      expect(blocked.error).toContain("Escalate");
    }
    expect(reload(highRiskPending.id).status).toBe("in_review");

    expect((await invokeAs(marcus, APP, "escalate", { id: highRiskPending.id, reason: "High risk; needs supervisor sign-off." })).ok).toBe(true);
    expect(reload(highRiskPending.id).status).toBe("escalated");

    const decided = await invokeAs(dana, APP, "supervisorDecide", { id: highRiskPending.id, decision: "approve", reason: "Supervisor reviewed enhanced due diligence." });
    expect(decided.ok).toBe(true);
    expect(reload(highRiskPending.id)).toMatchObject({ status: "approved", assigneeId: dana.id });
  });

  it("supervisorDecide is denied for a plain reviewer and logged as denied", async () => {
    const res = await invokeAs(marcus, APP, "supervisorDecide", { id: escalated.id, decision: "reject", reason: "Trying without the role." });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
    expect(reload(escalated.id).status).toBe("escalated");
    const row = listAudit({ appSlug: APP, status: "denied" })[0];
    expect(row).toMatchObject({ actorId: marcus.id, action: "supervisorDecide" });
  });

  it("supervisorDecide only applies to escalated cases", async () => {
    const c = insert({ status: "pending" });
    const res = await invokeAs(dana, APP, "supervisorDecide", { id: c.id, decision: "approve", reason: "Skipping the queue entirely." });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("failed");
    expect(reload(c.id).status).toBe("pending");
  });

  it("release: assignee or supervisor only; reopen: supervisor only", async () => {
    const c = insert({ status: "in_review", assigneeId: marcus.id, assigneeName: marcus.name });
    expect((await invokeAs(dana, APP, "release", { id: c.id })).ok).toBe(true); // supervisor
    expect(reload(c.id)).toMatchObject({ status: "pending", assigneeId: null });

    const closed = insert({ status: "rejected", assigneeId: marcus.id, assigneeName: marcus.name, decisionReason: "x" });
    const denied = await invokeAs(marcus, APP, "reopen", { id: closed.id, reason: "Customer appealed the decision." });
    if (!denied.ok) expect(denied.status).toBe("denied");
    expect((await invokeAs(dana, APP, "reopen", { id: closed.id, reason: "Customer appealed the decision." })).ok).toBe(true);
    expect(reload(closed.id)).toMatchObject({ status: "pending", assigneeId: null });
  });

  it("Lena (viewer) is denied on claim and the denial is audited with her identity", async () => {
    const c = insert({ status: "pending" });
    const res = await invokeAs(lena, APP, "claim", { id: c.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
    expect(reload(c.id).status).toBe("pending");
    const row = listAudit({ appSlug: APP, status: "denied", actorId: lena.id })[0];
    expect(row).toMatchObject({ actorName: lena.name, action: "claim", status: "denied" });
    expect(JSON.parse(row.input!)).toEqual({ id: c.id });
  });

  it("users without the view role (Sam) are denied too", async () => {
    const res = await invokeAs(sam, APP, "claim", { id: lowRiskPending.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
  });
});
