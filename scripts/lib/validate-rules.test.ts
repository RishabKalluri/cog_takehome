import { describe, expect, it } from "vitest";
import { checkActionParity, checkAppSources, otherAppImport } from "./validate-rules";

const client = 'import { getDb } from "@/platform/db/client";\n';

describe("validate: DB access rules", () => {
  it("allows the reference layout (actions/seed write, page reads)", () => {
    const errors = checkAppSources("notes", [
      { rel: "actions.ts", content: client + "db.insert(notes).values({}).run(); db.delete(notes).run();" },
      { rel: "seed.ts", content: 'import type { Db } from "@/platform/db/client";\ndb.insert(notes).values([]).run();' },
      { rel: "page.tsx", content: client + "const rows = getDb().select().from(notes).all();" },
      { rel: "actions.test.ts", content: client + "db.insert(x)" },
    ]);
    expect(errors).toEqual([]);
  });

  it("rejects pages that write to the DB", () => {
    const errors = checkAppSources("notes", [{ rel: "page.tsx", content: client + "getDb().insert(notes).values({}).run();" }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/page\.tsx: calls \.insert\(/);
  });

  it("rejects writes from helper components and ignores commented-out code", () => {
    expect(checkAppSources("notes", [{ rel: "components/row.tsx", content: "// db.insert(x)\n/* db.update(y) */\nexport const a = 1;" }])).toEqual([]);
    expect(checkAppSources("notes", [{ rel: "components/row.tsx", content: "db.update(notes).set({}).run();" }])[0]).toMatch(/components\/row\.tsx: calls \.update\(/);
  });

  it("allows write helpers in .ts files that receive a Db (type-only import)", () => {
    const errors = checkAppSources("deployments", [
      { rel: "promote.ts", content: 'import type { Db } from "@/platform/db/client";\nexport function record(db: Db) { return db.insert(deployments).values({}).run(); }' },
    ]);
    expect(errors).toEqual([]);
  });

  it("rejects live DB client imports outside the allowed files", () => {
    const errors = checkAppSources("notes", [{ rel: "helpers.ts", content: 'import { getDb } from "../../platform/db/client";' }]);
    expect(errors[0]).toMatch(/helpers\.ts: imports @\/platform\/db\/client/);
  });
});

describe("validate: no cross-app imports", () => {
  it("flags alias and relative imports into other apps", () => {
    const errors = checkAppSources("kyc-review", [
      { rel: "page.tsx", content: 'import { flags } from "@/apps/feature-flags/schema";\nimport { manifest } from "./manifest";' },
      { rel: "views/list.tsx", content: 'import { x } from "../../example-notes/actions";' },
    ]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/imports from src\/apps\/feature-flags/);
    expect(errors[1]).toMatch(/imports from src\/apps\/example-notes/);
  });

  it("exempts test files (they may reference other apps' fixtures)", () => {
    expect(checkAppSources("deployments", [{ rel: "actions.test.ts", content: 'import { manifest } from "@/apps/example-notes/manifest";' }])).toEqual([]);
  });

  it("allows imports within the same app and from the platform", () => {
    expect(otherAppImport("a", "page.tsx", "./manifest")).toBeNull();
    expect(otherAppImport("a", "views/x.tsx", "../schema")).toBeNull();
    expect(otherAppImport("a", "page.tsx", "@/apps/a/schema")).toBeNull();
    expect(otherAppImport("a", "page.tsx", "@/platform/ui/primitives")).toBeNull();
    expect(otherAppImport("a", "page.tsx", "../../platform/db/client")).toBeNull();
    expect(otherAppImport("a", "page.tsx", "@/apps/b")).toBe("b");
  });
});

describe("validate: manifest ⇔ actions parity", () => {
  it("reports both directions", () => {
    const errors = checkActionParity("x", ["create", "archive"], ["create", "update"]);
    expect(errors).toEqual([
      'x: action "archive" declared in manifest but not implemented',
      'x: action "update" implemented but not declared in manifest (no role → would be unreachable)',
    ]);
  });
});
