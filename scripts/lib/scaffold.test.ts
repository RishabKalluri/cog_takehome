import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ManifestSchema } from "@/platform/manifest";
import { addToRegistry, pluralize, scaffoldApp } from "./scaffold";

let tmp: string;

function makeTempRepo() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "new-app-"));
  fs.mkdirSync(path.join(tmp, "src", "apps"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "src", "platform"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "src", "db"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "src/platform/registry.ts"),
    'import type { AppManifest } from "./manifest";\nimport exampleNotes from "@/apps/example-notes";\n\nexport type AppDefinition = { manifest: AppManifest };\n\nexport const apps: AppDefinition[] = [exampleNotes];\n',
  );
  fs.writeFileSync(path.join(tmp, "src/db/schema.ts"), 'export * from "@/platform/db/schema";\nexport * from "@/apps/example-notes/schema";\n');
  return tmp;
}

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("pnpm new-app scaffold", () => {
  it("generates every file, registers the app and produces a valid manifest", async () => {
    const root = makeTempRepo();
    const res = scaffoldApp(root, { slug: "refunds-dashboard", name: "Refunds Dashboard", owner: "payments", entity: "refund" });

    for (const f of ["manifest.ts", "schema.ts", "actions.ts", "page.tsx", "seed.ts", "index.ts", "actions.test.ts"]) {
      expect(fs.existsSync(path.join(res.appDir, f)), f).toBe(true);
    }

    const mod = await import(/* @vite-ignore */ path.join(res.appDir, "manifest.ts"));
    const parsed = ManifestSchema.safeParse(mod.manifest);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(mod.manifest.slug).toBe("refunds-dashboard");
    expect(mod.manifest.owner).toBe("payments");
    expect(Object.keys(mod.manifest.actions)).toEqual(["create", "update", "archive"]);

    const schema = fs.readFileSync(path.join(res.appDir, "schema.ts"), "utf8");
    expect(schema).toContain('sqliteTable("refunds_dashboard_refunds"');

    const registry = fs.readFileSync(res.registryPath, "utf8");
    expect(registry).toContain('import refundsDashboard from "@/apps/refunds-dashboard";');
    expect(registry).toMatch(/export const apps: AppDefinition\[\] = \[[\s\S]*refundsDashboard[\s\S]*\];/);

    expect(fs.readFileSync(res.dbSchemaPath, "utf8")).toContain('export * from "@/apps/refunds-dashboard/schema";');
  });

  it("refuses bad slugs and duplicate apps", () => {
    const root = makeTempRepo();
    expect(() => scaffoldApp(root, { slug: "Bad Slug", name: "x" })).toThrow(/kebab-case/);
    scaffoldApp(root, { slug: "a-b", name: "A B" });
    expect(() => scaffoldApp(root, { slug: "a-b", name: "A B" })).toThrow(/already exists/);
    fs.rmSync(path.join(root, "src/apps/a-b"), { recursive: true });
    expect(() => scaffoldApp(root, { slug: "a-b", name: "A B" })).toThrow(/already registered/);
  });

  it("appends to a multi-line apps array without disturbing existing entries", () => {
    const src = `import a from "@/apps/a";\nimport b from "@/apps/b";\n\nexport const apps: AppDefinition[] = [\n  a,\n  b,\n];\n`;
    const out = addToRegistry(src, "c-d", "cD");
    expect(out).toContain('import b from "@/apps/b";\nimport cD from "@/apps/c-d";');
    expect(out).toContain("export const apps: AppDefinition[] = [\n  a,\n  b,\n  cD,\n];");
  });

  it("pluralizes common nouns", () => {
    expect(pluralize("refund")).toBe("refunds");
    expect(pluralize("policy")).toBe("policies");
    expect(pluralize("batch")).toBe("batches");
  });
});
