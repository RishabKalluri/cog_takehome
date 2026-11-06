import { beforeAll, describe, expect, it } from "vitest";
import { invokeAs } from "@/platform/actions/gateway";
import { users } from "@/platform/auth/users";
import { listAudit } from "@/platform/audit/log";
import { getDb, resetDbForTests } from "@/platform/db/client";
import { appFlagKey, isAppEnabled, isFlagOn } from "@/platform/flags";
import { seed } from "./seed";

const byId = (id: string) => users.find((u) => u.id === id)!;
const engineer = byId("u-sam"); // flag-admin
const support = byId("u-omar"); // viewer only
const auditor = byId("u-lena"); // no access

const APP = "feature-flags";

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
  seed(getDb());
});

describe("feature-flags actions", () => {
  it("seeds a kill switch for every app except itself", () => {
    expect(isAppEnabled("example-notes")).toBe(true);
    expect(isFlagOn(appFlagKey("example-notes"))).toBe(true);
    expect(isFlagOn(appFlagKey(APP))).toBe(false); // no row
    expect(isAppEnabled(APP)).toBe(true); // …but always enabled
  });

  it("viewers and outsiders cannot change flags", async () => {
    for (const u of [support, auditor]) {
      const res = await invokeAs(u, APP, "toggleFlag", { key: "platform.dark-mode", enabled: true });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe("denied");
    }
  });

  it("creates a flag (form-style string input) and records after state", async () => {
    const res = await invokeAs(engineer, APP, "createFlag", { key: "refunds.bulk-export", description: "CSV export", enabled: "true", rolloutPercent: "40" });
    expect(res.ok).toBe(true);
    const row = listAudit({ appSlug: APP, status: "success" })[0];
    expect(row.entityId).toBe("refunds.bulk-export");
    expect(JSON.parse(row.after!)).toMatchObject({ key: "refunds.bulk-export", enabled: true, rolloutPercent: 40, updatedBy: engineer.name });
    expect(isFlagOn("refunds.bulk-export")).toBe(true);
  });

  it("rejects duplicate, reserved and malformed keys", async () => {
    const dup = await invokeAs(engineer, APP, "createFlag", { key: "refunds.bulk-export" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.status).toBe("failed");

    const reserved = await invokeAs(engineer, APP, "createFlag", { key: "app:kyc-review:enabled" });
    expect(reserved.ok).toBe(false);
    if (!reserved.ok) expect(reserved.error).toMatch(/reserved/);

    const bad = await invokeAs(engineer, APP, "createFlag", { key: "Has Spaces" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe("invalid");
  });

  it("toggles with before/after", async () => {
    const res = await invokeAs(engineer, APP, "toggleFlag", { key: "platform.dark-mode", enabled: "true" });
    expect(res.ok).toBe(true);
    const row = listAudit({ appSlug: APP, status: "success" })[0];
    expect(JSON.parse(row.before!)).toMatchObject({ enabled: false });
    expect(JSON.parse(row.after!)).toMatchObject({ enabled: true });
  });

  it("sets rollout within 0–100 and applies it per subject", async () => {
    const bad = await invokeAs(engineer, APP, "setRollout", { key: "support.macros-v2", percent: 150 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe("invalid");

    expect((await invokeAs(engineer, APP, "setRollout", { key: "support.macros-v2", percent: "0" })).ok).toBe(true);
    expect(isFlagOn("support.macros-v2")).toBe(true); // no subject → enabled wins
    expect(isFlagOn("support.macros-v2", "u-omar")).toBe(false);

    expect((await invokeAs(engineer, APP, "setRollout", { key: "support.macros-v2", percent: 100 })).ok).toBe(true);
    expect(isFlagOn("support.macros-v2", "u-omar")).toBe(true);
    expect(isFlagOn("support.macros-v2", "u-omar")).toBe(isFlagOn("support.macros-v2", "u-omar")); // deterministic
  });

  it("deletes ordinary flags but never kill switches", async () => {
    const del = await invokeAs(engineer, APP, "deleteFlag", { key: "refunds.bulk-export" });
    expect(del.ok).toBe(true);
    expect(isFlagOn("refunds.bulk-export")).toBe(false);
    expect(JSON.parse(listAudit({ appSlug: APP, status: "success" })[0].before!)).toMatchObject({ key: "refunds.bulk-export" });

    const missing = await invokeAs(engineer, APP, "deleteFlag", { key: "refunds.bulk-export" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe("failed");

    const ks = await invokeAs(engineer, APP, "deleteFlag", { key: appFlagKey("example-notes") });
    expect(ks.ok).toBe(false);
    if (!ks.ok) expect(ks.error).toMatch(/cannot be deleted/);
  });

  it("the flags app can never be switched off", async () => {
    const res = await invokeAs(engineer, APP, "toggleFlag", { key: appFlagKey(APP), enabled: false });
    expect(res.ok).toBe(false);
    expect(isAppEnabled(APP)).toBe(true);
  });
});
