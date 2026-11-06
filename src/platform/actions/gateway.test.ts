import { beforeAll, describe, expect, it } from "vitest";
import { invokeAs } from "./gateway";
import { users } from "../auth/users";
import { listAudit } from "../audit/log";
import { getDb, resetDbForTests } from "../db/client";
import { appFlagKey } from "../flags";
import { seed as seedFlags } from "@/apps/feature-flags/seed";

const byId = (id: string) => users.find((u) => u.id === id)!;
const engineer = byId("u-sam"); // editor on example-notes
const support = byId("u-omar"); // editor on example-notes
const auditor = byId("u-lena"); // viewer only
const admin = byId("u-priya");

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
  seedFlags(getDb());
});

describe("action gateway", () => {
  it("rejects unknown actions without touching the audit log", async () => {
    const res = await invokeAs(engineer, "example-notes", "nope", {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("not_found");
    expect(listAudit({ appSlug: "example-notes" })).toHaveLength(0);
  });

  it("denies users without the required role and records the denial", async () => {
    const res = await invokeAs(auditor, "example-notes", "postNote", { body: "hi" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
    const [row] = listAudit({ appSlug: "example-notes", status: "denied" });
    expect(row.actorId).toBe(auditor.id);
    expect(row.action).toBe("postNote");
  });

  it("validates input and records invalid attempts", async () => {
    const res = await invokeAs(engineer, "example-notes", "postNote", { body: "   " });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("invalid");
      expect(res.error).toContain("body");
    }
    expect(listAudit({ status: "invalid" })).toHaveLength(1);
  });

  it("runs authorized actions and stores before/after state", async () => {
    const post = await invokeAs(engineer, "example-notes", "postNote", { body: "hello" });
    expect(post.ok).toBe(true);
    const created = listAudit({ status: "success" })[0];
    expect(created.action).toBe("postNote");
    expect(JSON.parse(created.after!)).toMatchObject({ body: "hello", authorId: engineer.id });
    expect(created.gitSha).toBeTruthy();

    const del = await invokeAs(support, "example-notes", "deleteNote", { id: created.entityId });
    expect(del.ok).toBe(true);
    const deleted = listAudit({ status: "success" })[0];
    expect(deleted.action).toBe("deleteNote");
    expect(JSON.parse(deleted.before!)).toMatchObject({ body: "hello" });
    expect(deleted.after).toBeNull();
  });

  it("surfaces ActionError messages and logs them as failed", async () => {
    const res = await invokeAs(admin, "example-notes", "deleteNote", { id: 999999 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("failed");
      expect(res.error).toBe("Note not found");
    }
    expect(listAudit({ status: "failed" })[0].error).toBe("Note not found");
  });

  it("platform admins hold every role", async () => {
    const res = await invokeAs(admin, "example-notes", "postNote", { body: "admin note" });
    expect(res.ok).toBe(true);
  });

  it("refuses every action of a killed app, logs it as disabled, and recovers when re-enabled", async () => {
    const off = await invokeAs(admin, "feature-flags", "toggleFlag", { key: appFlagKey("example-notes"), enabled: false });
    expect(off.ok).toBe(true);

    const res = await invokeAs(engineer, "example-notes", "postNote", { body: "while disabled" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("disabled");
      expect(res.error).toMatch(/disabled by an administrator/);
    }
    const [row] = listAudit({ appSlug: "example-notes", status: "disabled" });
    expect(row.actorId).toBe(engineer.id);
    expect(row.action).toBe("postNote");

    // Admins are blocked too: the switch is about the app, not the person.
    const adminRes = await invokeAs(admin, "example-notes", "postNote", { body: "admin while disabled" });
    expect(adminRes.ok).toBe(false);

    const on = await invokeAs(admin, "feature-flags", "toggleFlag", { key: appFlagKey("example-notes"), enabled: true });
    expect(on.ok).toBe(true);
    expect((await invokeAs(engineer, "example-notes", "postNote", { body: "back" })).ok).toBe(true);
  });

  it("the feature-flags app itself can never be disabled", async () => {
    const res = await invokeAs(admin, "feature-flags", "toggleFlag", { key: appFlagKey("feature-flags"), enabled: false });
    expect(res.ok).toBe(false);
    expect((await invokeAs(admin, "feature-flags", "setRollout", { key: "platform.dark-mode", percent: 10 })).ok).toBe(true);
  });
});
