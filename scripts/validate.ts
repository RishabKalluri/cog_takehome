/**
 * Convention checks run in CI and by `pnpm check`:
 *  - every folder under src/apps is registered, slugs are unique and match folders
 *  - manifests parse (roles referenced by actions/viewRole exist, semver version,
 *    non-empty owner, kebab slug — see src/platform/manifest.ts)
 *  - every manifest action has an implementation and vice versa
 *  - only actions.ts / seed.ts write to the DB; pages and components are read-only
 *  - only actions.ts, seed.ts, schema.ts, page.tsx (and tests) import the DB client
 *  - apps never import from other apps
 * Rule logic lives in scripts/lib/validate-rules.ts (unit-tested).
 */
import fs from "node:fs";
import path from "node:path";
import { apps } from "@/platform/registry";
import { ManifestSchema } from "@/platform/manifest";
import { checkActionParity, checkAppSources, readAppSources } from "./lib/validate-rules";

const errors: string[] = [];
const appsDir = path.join(process.cwd(), "src", "apps");
const folders = fs.readdirSync(appsDir).filter((f) => fs.statSync(path.join(appsDir, f)).isDirectory());
const registered = new Set(apps.map((a) => a.manifest.slug));

for (const f of folders) if (!registered.has(f)) errors.push(`src/apps/${f} exists but is not registered in src/platform/registry.ts`);
if (registered.size !== apps.length) errors.push("duplicate app slugs in registry");

for (const app of apps) {
  const slug = app.manifest.slug;
  const parsed = ManifestSchema.safeParse(app.manifest);
  if (!parsed.success) errors.push(`${slug}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  if (!folders.includes(slug)) {
    errors.push(`${slug}: slug must match its folder name under src/apps`);
    continue;
  }
  errors.push(...checkActionParity(slug, Object.keys(app.manifest.actions), Object.keys(app.actions)));
  errors.push(...checkAppSources(slug, readAppSources(path.join(appsDir, slug))));
}

if (errors.length) {
  console.error("Validation failed:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log(`OK: ${apps.length} app(s) valid: ${apps.map((a) => `${a.manifest.slug}@${a.manifest.version}`).join(", ")}`);
