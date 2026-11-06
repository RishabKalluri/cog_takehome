import { beforeAll, describe, expect, it } from "vitest";
import { invokeAs } from "./gateway";
import { users } from "../auth/users";
import { listAudit } from "../audit/log";
import { resetDbForTests } from "../db/client";

const byId = (id: string) => users.find((u) => u.id === id)!;
const engineer = byId("u-sam"); // editor on example-notes
const support = byId("u-omar"); // editor on example-notes
const auditor = byId("u-lena"); // viewer only
const admin = byId("u-priya");

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
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
});
