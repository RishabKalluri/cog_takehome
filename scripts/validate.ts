/**
 * Convention checks run in CI and by `pnpm check`:
 *  - every folder under src/apps is registered
 *  - manifests parse (roles referenced by actions/viewRole exist, semver, kebab slug)
 *  - every manifest action has an implementation and vice versa
 *  - slugs are unique
 */
import fs from "node:fs";
import path from "node:path";
import { apps } from "@/platform/registry";
import { ManifestSchema } from "@/platform/manifest";

const errors: string[] = [];
const appsDir = path.join(process.cwd(), "src", "apps");
const folders = fs.readdirSync(appsDir).filter((f) => fs.statSync(path.join(appsDir, f)).isDirectory());
const registered = new Set(apps.map((a) => a.manifest.slug));

for (const f of folders) if (!registered.has(f)) errors.push(`src/apps/${f} exists but is not registered in src/platform/registry.ts`);
if (registered.size !== apps.length) errors.push("duplicate app slugs in registry");

for (const app of apps) {
  const parsed = ManifestSchema.safeParse(app.manifest);
  if (!parsed.success) errors.push(`${app.manifest.slug}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  if (!folders.includes(app.manifest.slug)) errors.push(`${app.manifest.slug}: slug must match its folder name under src/apps`);
  const declared = Object.keys(app.manifest.actions);
  const implemented = Object.keys(app.actions);
  for (const a of declared) if (!implemented.includes(a)) errors.push(`${app.manifest.slug}: action "${a}" declared in manifest but not implemented`);
  for (const a of implemented) if (!declared.includes(a)) errors.push(`${app.manifest.slug}: action "${a}" implemented but not declared in manifest (no role → would be unreachable)`);
}

if (errors.length) {
  console.error("Validation failed:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log(`OK: ${apps.length} app(s) valid: ${apps.map((a) => `${a.manifest.slug}@${a.manifest.version}`).join(", ")}`);
