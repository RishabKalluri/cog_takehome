import { beforeAll, describe, expect, it } from "vitest";
import { invokeAs } from "@/platform/actions/gateway";
import { listAudit } from "@/platform/audit/log";
import { users } from "@/platform/auth/users";
import { buildInfo } from "@/platform/build-info";
import { getDb, resetDbForTests } from "@/platform/db/client";
import { deployments } from "@/platform/db/schema";
import { manifest as notesManifest } from "@/apps/example-notes/manifest";

const byId = (id: string) => users.find((u) => u.id === id)!;
const engineer = byId("u-sam"); // releaser
const auditor = byId("u-lena"); // viewer only
const support = byId("u-omar"); // no access at all

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
});

describe("deployments/promote", () => {
  it("lets a releaser record a promotion using the manifest version and build SHA", async () => {
    const res = await invokeAs(engineer, "deployments", "promote", { appSlug: "example-notes", environment: "prod", notes: "release train" });
    expect(res.ok).toBe(true);
    const rows = getDb().select().from(deployments).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ appSlug: "example-notes", environment: "prod", version: notesManifest.version, gitSha: buildInfo.gitSha, deployedBy: engineer.name, notes: "release train" });
    const audit = listAudit({ appSlug: "deployments", status: "success" })[0];
    expect(audit.action).toBe("promote");
    expect(audit.entityId).toBe("example-notes:prod");
    expect(audit.before).toBeNull();
    expect(JSON.parse(audit.after!)).toMatchObject({ version: notesManifest.version });
  });

  it("refuses to record the same version+sha twice in one environment, keeping the first row", async () => {
    const res = await invokeAs(engineer, "deployments", "promote", { appSlug: "example-notes", environment: "prod" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("failed");
      expect(res.error).toContain("already recorded in prod");
    }
    expect(getDb().select().from(deployments).all()).toHaveLength(1);
  });

  it("denies viewers and users without access, and audits the denial", async () => {
    for (const user of [auditor, support]) {
      const res = await invokeAs(user, "deployments", "promote", { appSlug: "example-notes", environment: "staging" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe("denied");
    }
    const denied = listAudit({ appSlug: "deployments", status: "denied" });
    expect(denied.map((r) => r.actorId).sort()).toEqual([auditor.id, support.id].sort());
    expect(denied[0].error).toContain('requires role "releaser"');
    expect(getDb().select().from(deployments).all()).toHaveLength(1);
  });

  it("rejects unknown environments as invalid and unknown apps as failed", async () => {
    const bad = await invokeAs(engineer, "deployments", "promote", { appSlug: "example-notes", environment: "qa" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe("invalid");
    const missing = await invokeAs(engineer, "deployments", "promote", { appSlug: "nope", environment: "dev" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.status).toBe("failed");
      expect(missing.error).toContain('"nope"');
    }
  });
});
