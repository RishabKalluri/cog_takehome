/**
 * Library behind `pnpm new-app`. Pure-ish: everything is relative to `root`
 * so tests can run it into a temp directory.
 */
import fs from "node:fs";
import path from "node:path";

export type ScaffoldOptions = {
  slug: string;
  name: string;
  owner?: string;
  entity?: string;
};

export type ScaffoldResult = {
  appDir: string;
  files: string[];
  registryPath: string;
  dbSchemaPath: string;
};

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const WORD_RE = /^[a-z][a-z0-9-]*$/;

export function toPascal(s: string) {
  return s.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}
export function toCamel(s: string) {
  const p = toPascal(s);
  return p[0].toLowerCase() + p.slice(1);
}
export function toSnake(s: string) {
  return s.replace(/-/g, "_");
}
export function pluralize(noun: string) {
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}
function titleCase(s: string) {
  return s.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function scaffoldApp(root: string, opts: ScaffoldOptions): ScaffoldResult {
  const slug = opts.slug.trim();
  const entity = (opts.entity ?? "item").trim().toLowerCase();
  const owner = (opts.owner ?? "platform-team").trim();
  const name = opts.name.trim();

  if (!SLUG_RE.test(slug)) throw new Error(`slug "${slug}" must be kebab-case (lowercase letters, digits, hyphens)`);
  if (!WORD_RE.test(entity)) throw new Error(`entity "${entity}" must be a lowercase singular noun (kebab-case allowed)`);
  if (!name) throw new Error("display name must not be empty");
  if (!owner) throw new Error("owner must not be empty");

  const appDir = path.join(root, "src", "apps", slug);
  const registryPath = path.join(root, "src", "platform", "registry.ts");
  const dbSchemaPath = path.join(root, "src", "db", "schema.ts");

  if (fs.existsSync(appDir)) throw new Error(`src/apps/${slug} already exists; refusing to overwrite`);
  const registrySrc = fs.readFileSync(registryPath, "utf8");
  if (registrySrc.includes(`@/apps/${slug}"`)) throw new Error(`"${slug}" is already registered in src/platform/registry.ts`);

  const vars: TemplateVars = {
    slug,
    name,
    owner,
    entity,
    Entity: toPascal(entity),
    entityTitle: titleCase(entity),
    plural: pluralize(entity),
    pluralTitle: titleCase(pluralize(entity)),
    table: toCamel(pluralize(entity)),
    tableName: `${toSnake(slug)}_${toSnake(pluralize(entity))}`,
    importIdent: toCamel(slug),
  };

  const files = {
    "manifest.ts": manifestTemplate(vars),
    "schema.ts": schemaTemplate(vars),
    "actions.ts": actionsTemplate(vars),
    "page.tsx": pageTemplate(vars),
    "seed.ts": seedTemplate(vars),
    "index.ts": indexTemplate(),
    "actions.test.ts": testTemplate(vars),
  };

  fs.mkdirSync(appDir, { recursive: true });
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(appDir, file), content);

  fs.writeFileSync(registryPath, addToRegistry(registrySrc, slug, vars.importIdent));
  fs.writeFileSync(dbSchemaPath, addToDbSchema(fs.readFileSync(dbSchemaPath, "utf8"), slug));

  return { appDir, files: Object.keys(files), registryPath, dbSchemaPath };
}

/** Adds `import X from "@/apps/<slug>";` after the last app import and appends X to the `apps` array. */
export function addToRegistry(src: string, slug: string, ident: string): string {
  const importLine = `import ${ident} from "@/apps/${slug}";`;
  const importRe = /^import .* from "@\/apps\/[^"]+";\s*$/gm;
  let lastImportEnd = -1;
  for (const m of src.matchAll(importRe)) lastImportEnd = m.index + m[0].length;
  if (lastImportEnd === -1) {
    const anyImport = /^import .*;\s*$/gm;
    for (const m of src.matchAll(anyImport)) lastImportEnd = m.index + m[0].length;
  }
  if (lastImportEnd === -1) throw new Error("registry.ts: could not find an import to insert after");
  let out = src.slice(0, lastImportEnd).trimEnd() + "\n" + importLine + src.slice(lastImportEnd);

  const start = out.indexOf("export const apps: AppDefinition[] = [");
  if (start === -1) throw new Error("registry.ts: could not find `export const apps: AppDefinition[] = [`");
  const open = out.indexOf("[", start + "export const apps: AppDefinition[] = ".length);
  const close = out.indexOf("]", open);
  if (close === -1) throw new Error("registry.ts: unterminated apps array");
  const inner = out.slice(open + 1, close);
  const multiline = inner.includes("\n");
  const items = inner.split(",").map((s) => s.trim()).filter(Boolean);
  items.push(ident);
  const rebuilt = multiline ? `\n${items.map((i) => `  ${i},`).join("\n")}\n` : items.join(", ");
  out = out.slice(0, open + 1) + rebuilt + out.slice(close);
  return out;
}

export function addToDbSchema(src: string, slug: string): string {
  const line = `export * from "@/apps/${slug}/schema";`;
  if (src.includes(line)) return src;
  return src.trimEnd() + "\n" + line + "\n";
}

type TemplateVars = {
  slug: string;
  name: string;
  owner: string;
  entity: string;
  Entity: string;
  entityTitle: string;
  plural: string;
  pluralTitle: string;
  table: string;
  tableName: string;
  importIdent: string;
};

function manifestTemplate(v: TemplateVars) {
  return `import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "${v.slug}",
  name: "${v.name}",
  description: "Tracks ${v.plural}. Generated by \`pnpm new-app\`; replace this description.",
  version: "0.1.0",
  owner: "${v.owner}",
  kind: "app", // "platform" is reserved for operational surfaces (audit log, deployments, flags)
  roles: {
    // TODO: replace the placeholder groups with real directory groups (see src/platform/auth/users.ts for the mock directory).
    viewer: { description: "Can view ${v.plural}", groups: ["${v.slug}-viewers", "${v.slug}-editors"] },
    editor: { description: "Can create, update and archive ${v.plural}", groups: ["${v.slug}-editors"] },
  },
  viewRole: "viewer",
  actions: {
    create: { description: "Create a ${v.entityTitle.toLowerCase()}", role: "editor" },
    update: { description: "Update a ${v.entityTitle.toLowerCase()}", role: "editor" },
    archive: { description: "Archive a ${v.entityTitle.toLowerCase()}", role: "editor" },
  },
  dataSources: ["platform-db"],
});
`;
}

function schemaTemplate(v: TemplateVars) {
  return `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const ${v.Entity.toUpperCase()}_STATUSES = ["open", "in_progress", "closed", "archived"] as const;
export type ${v.Entity}Status = (typeof ${v.Entity.toUpperCase()}_STATUSES)[number];

export const ${v.table} = sqliteTable("${v.tableName}", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  status: text("status", { enum: ${v.Entity.toUpperCase()}_STATUSES }).notNull().default("open"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
`;
}

function actionsTemplate(v: TemplateVars) {
  const S = `${v.Entity.toUpperCase()}_STATUSES`;
  return `import { z } from "zod";
import { eq } from "drizzle-orm";
import { action, ActionError, defineActions } from "@/platform/actions/define";
import { manifest } from "./manifest";
import { ${S}, ${v.table} } from "./schema";

const idSchema = z.object({ id: z.coerce.number().int() });
const title = z.string().trim().min(1, "Title is required").max(200);
const notes = z.string().trim().max(2000);

export const actions = defineActions(manifest, {
  create: action(z.object({ title, notes: notes.optional() }), ({ db, user }, input) => {
    const now = new Date().toISOString();
    const row = db
      .insert(${v.table})
      .values({ title: input.title, notes: input.notes || null, status: "open", createdBy: user.id, createdAt: now, updatedAt: now })
      .returning()
      .get();
    return { entityId: String(row.id), after: row, message: "${v.entityTitle} created." };
  }),

  update: action(
    idSchema.extend({ title: title.optional(), status: z.enum(${S}).optional(), notes: notes.optional() }),
    ({ db }, input) => {
      const before = db.select().from(${v.table}).where(eq(${v.table}.id, input.id)).get();
      if (!before) throw new ActionError("${v.entityTitle} not found", "not_found");
      if (before.status === "archived") throw new ActionError("Archived ${v.plural} cannot be edited", "conflict");
      const after = db
        .update(${v.table})
        .set({
          title: input.title ?? before.title,
          status: input.status ?? before.status,
          notes: input.notes === undefined ? before.notes : input.notes || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(${v.table}.id, input.id))
        .returning()
        .get();
      return { entityId: String(input.id), before, after, message: "${v.entityTitle} updated." };
    },
  ),

  archive: action(idSchema, ({ db }, input) => {
    const before = db.select().from(${v.table}).where(eq(${v.table}.id, input.id)).get();
    if (!before) throw new ActionError("${v.entityTitle} not found", "not_found");
    if (before.status === "archived") throw new ActionError("Already archived", "conflict");
    const after = db
      .update(${v.table})
      .set({ status: "archived", updatedAt: new Date().toISOString() })
      .where(eq(${v.table}.id, input.id))
      .returning()
      .get();
    return { entityId: String(input.id), before, after, message: "${v.entityTitle} archived." };
  }),
});
`;
}

function pageTemplate(v: TemplateVars) {
  const S = `${v.Entity.toUpperCase()}_STATUSES`;
  return `import { desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/platform/db/client";
import { can } from "@/platform/authz/rbac";
import type { AppPageProps } from "@/platform/registry";
import { ActionButton, ActionForm } from "@/platform/ui/action-form";
import { Badge, Card, EmptyState, PageHeader, Select, SubmitButton, Table, Td, TextArea, TextInput } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { ${S}, ${v.table}, type ${v.Entity}Status } from "./schema";

const statusTone: Record<${v.Entity}Status, "neutral" | "green" | "amber" | "blue"> = {
  open: "blue",
  in_progress: "amber",
  closed: "green",
  archived: "neutral",
};

/** Read-only server component. All writes go through <ActionForm>/<ActionButton> -> gateway. */
export default async function Page({ user, searchParams }: AppPageProps) {
  const showArchived = searchParams.show === "archived";
  const rows = getDb()
    .select()
    .from(${v.table})
    .where(showArchived ? eq(${v.table}.status, "archived") : ne(${v.table}.status, "archived"))
    .orderBy(desc(${v.table}.updatedAt))
    .all();
  const canEdit = can(user, manifest, "create");

  return (
    <>
      <PageHeader
        title={manifest.name}
        description={manifest.description}
        actions={
          <Link href={showArchived ? "?" : "?show=archived"} className="text-sm text-zinc-600 underline">
            {showArchived ? "Show active" : "Show archived"}
          </Link>
        }
      />
      {canEdit && !showArchived && (
        <Card title="New ${v.entityTitle.toLowerCase()}">
          <ActionForm app={manifest.slug} action="create" className="space-y-3">
            <TextInput name="title" placeholder="Title" required maxLength={200} />
            <TextArea name="notes" placeholder="Notes (optional)" rows={2} maxLength={2000} />
            <SubmitButton>Create</SubmitButton>
          </ActionForm>
        </Card>
      )}
      <Card title={\`\${showArchived ? "Archived" : "Active"} ${v.plural} (\${rows.length})\`}>
        {rows.length === 0 ? (
          <EmptyState>No {showArchived ? "archived" : "active"} ${v.plural}.</EmptyState>
        ) : (
          <Table headers={["Title", "Status", "Notes", "Updated", ...(canEdit && !showArchived ? ["Actions"] : [])]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium">{row.title}</Td>
                <Td>
                  <Badge tone={statusTone[row.status]}>{row.status.replace("_", " ")}</Badge>
                </Td>
                <Td className="max-w-xs break-words text-zinc-600">{row.notes ?? "—"}</Td>
                <Td className="whitespace-nowrap text-zinc-500">{new Date(row.updatedAt).toLocaleString()}</Td>
                {canEdit && !showArchived && (
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionForm app={manifest.slug} action="update" input={{ id: row.id }} className="flex items-center gap-2">
                        <Select name="status" defaultValue={row.status} aria-label="Status">
                          {${S}.filter((s) => s !== "archived").map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton variant="secondary">Save</SubmitButton>
                      </ActionForm>
                      <ActionButton app={manifest.slug} action="archive" input={{ id: row.id }} label="Archive" variant="danger" confirm="Archive this ${v.entityTitle.toLowerCase()}?" />
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
`;
}

function seedTemplate(v: TemplateVars) {
  return `import type { Db } from "@/platform/db/client";
import { ${v.table} } from "./schema";

export function seed(db: Db) {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  db.insert(${v.table})
    .values([
      { title: "First ${v.entityTitle.toLowerCase()}", status: "open", notes: "Generated seed row — replace with realistic demo data.", createdBy: "u-priya", createdAt: iso(3 * 86400000), updatedAt: iso(3 * 86400000) },
      { title: "Second ${v.entityTitle.toLowerCase()}", status: "in_progress", notes: null, createdBy: "u-priya", createdAt: iso(86400000), updatedAt: iso(3600000) },
      { title: "Closed ${v.entityTitle.toLowerCase()}", status: "closed", notes: "Done last week.", createdBy: "u-priya", createdAt: iso(10 * 86400000), updatedAt: iso(7 * 86400000) },
    ])
    .run();
}
`;
}

function indexTemplate() {
  return `import type { AppDefinition } from "@/platform/registry";
import { manifest } from "./manifest";
import { actions } from "./actions";
import Page from "./page";
import { seed } from "./seed";

export default { manifest, actions, Page, seed } satisfies AppDefinition;
`;
}

function testTemplate(v: TemplateVars) {
  return `import { beforeAll, describe, expect, it } from "vitest";
import { invokeAs } from "@/platform/actions/gateway";
import { listAudit } from "@/platform/audit/log";
import { resetDbForTests } from "@/platform/db/client";
import { users, type User } from "@/platform/auth/users";
import { manifest } from "./manifest";

const admin = users.find((u) => u.id === "u-priya")!;
const editor: User = { id: "t-editor", name: "Test Editor", email: "editor@test", title: "test", groups: ["${v.slug}-editors"] };
const viewer: User = { id: "t-viewer", name: "Test Viewer", email: "viewer@test", title: "test", groups: ["${v.slug}-viewers"] };

beforeAll(() => {
  process.env.DB_PATH = ":memory:";
  resetDbForTests();
});

describe("${v.slug} actions", () => {
  it("lets editors create, update and archive a ${v.entityTitle.toLowerCase()}", async () => {
    const created = await invokeAs(editor, manifest.slug, "create", { title: "Test", notes: "n" });
    expect(created.ok).toBe(true);
    const id = listAudit({ appSlug: manifest.slug, status: "success" })[0].entityId!;

    const updated = await invokeAs(editor, manifest.slug, "update", { id, status: "in_progress" });
    expect(updated.ok).toBe(true);
    const upd = listAudit({ appSlug: manifest.slug, status: "success" })[0];
    expect(JSON.parse(upd.before!)).toMatchObject({ status: "open" });
    expect(JSON.parse(upd.after!)).toMatchObject({ status: "in_progress" });

    const archived = await invokeAs(admin, manifest.slug, "archive", { id });
    expect(archived.ok).toBe(true);

    const again = await invokeAs(editor, manifest.slug, "archive", { id });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe("failed");
  });

  it("denies viewers and records the denial", async () => {
    const res = await invokeAs(viewer, manifest.slug, "create", { title: "nope" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("denied");
    expect(listAudit({ appSlug: manifest.slug, status: "denied" })[0].actorId).toBe(viewer.id);
  });

  it("rejects invalid input", async () => {
    const res = await invokeAs(editor, manifest.slug, "create", { title: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("invalid");
  });
});
`;
}
