/**
 * Source-level convention checks for app folders. Pure functions over file
 * contents so they can be unit-tested against fixture snippets.
 */
import fs from "node:fs";
import path from "node:path";

/** Files in an app folder that may import the DB client at all. */
export const DB_CLIENT_ALLOWED = ["actions.ts", "seed.ts", "schema.ts", "page.tsx"];
/** Files in an app folder that may write to the DB. Everything else is read-only. */
export const DB_WRITE_ALLOWED = ["actions.ts", "seed.ts"];

const DB_CLIENT_RE = /from\s+["'](?:@\/platform\/db\/client|(?:\.\.\/)+platform\/db\/client)["']/;
const WRITE_RE = /\.(insert|update|delete)\s*\(/g;
const IMPORT_RE = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

export type SourceFile = { rel: string; content: string };

export function readAppSources(appDir: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push({ rel: path.relative(appDir, full).split(path.sep).join("/"), content: fs.readFileSync(full, "utf8") });
    }
  };
  walk(appDir);
  return out;
}

/** Rules (a) and (b) from the piece-5 spec, applied to one app's source files. */
export function checkAppSources(slug: string, files: SourceFile[]): string[] {
  const errors: string[] = [];
  for (const f of files) {
    const base = path.posix.basename(f.rel);
    const isTest = /\.test\.tsx?$/.test(base);
    const where = `src/apps/${slug}/${f.rel}`;

    if (!isTest && DB_CLIENT_RE.test(f.content) && !DB_CLIENT_ALLOWED.includes(base)) {
      errors.push(`${where}: imports @/platform/db/client — only ${DB_CLIENT_ALLOWED.join(", ")} may (pages read-only)`);
    }
    if (!isTest && !DB_WRITE_ALLOWED.includes(base)) {
      const writes = [...stripComments(f.content).matchAll(WRITE_RE)].map((m) => `.${m[1]}(`);
      if (writes.length) errors.push(`${where}: calls ${[...new Set(writes)].join(" ")} — pages/components must not write to the DB; declare an action in actions.ts and use <ActionForm>/<ActionButton>`);
    }
    for (const spec of importSpecifiers(f.content)) {
      const other = otherAppImport(slug, f.rel, spec);
      if (other) errors.push(`${where}: imports from src/apps/${other} — apps may not import from other apps`);
    }
  }
  return errors;
}

/** Rule (c): declared ⇔ implemented actions. */
export function checkActionParity(slug: string, declared: string[], implemented: string[]): string[] {
  const errors: string[] = [];
  for (const a of declared) if (!implemented.includes(a)) errors.push(`${slug}: action "${a}" declared in manifest but not implemented`);
  for (const a of implemented) if (!declared.includes(a)) errors.push(`${slug}: action "${a}" implemented but not declared in manifest (no role → would be unreachable)`);
  return errors;
}

export function importSpecifiers(content: string): string[] {
  return [...stripComments(content).matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]).filter(Boolean);
}

/** Returns the other app's slug if `spec` (from file `rel` inside app `slug`) resolves into a different app folder. */
export function otherAppImport(slug: string, rel: string, spec: string): string | null {
  let target: string | null = null;
  const alias = spec.match(/^@\/apps\/([^/]+)/);
  if (alias) target = alias[1];
  else if (spec.startsWith(".")) {
    const resolved = path.posix.normalize(path.posix.join("apps", slug, path.posix.dirname(rel), spec));
    const m = resolved.match(/^apps\/([^/]+)/);
    if (m) target = m[1];
    else if (!resolved.startsWith("apps/")) target = null;
  }
  return target && target !== slug ? target : null;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}
