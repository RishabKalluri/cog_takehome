---
name: new-internal-app
description: Turn a short spec ("a <thing> tracker for <team>, with actions X/Y/Z") into a new app in this internal-apps platform, from `pnpm new-app` scaffold to a reviewable PR. Use whenever asked to add, build or generate an app under src/apps/.
---

# Creating a new internal app

## When to use
The request is "build/add/generate an app" for this repo (a Power Apps replacement: each app is a folder under `src/apps/<slug>/`, the platform supplies login, roles, audit log, versions). Not for changes to `src/platform/` — those are separate PRs.

## What you get for free
`pnpm new-app` writes a working one-entity CRUD app (table + `create`/`update`/`archive` actions + list page + seed + tests), registers it, and the platform does the rest: nav entry, role check on open, audit row for every action, version badge. Your job is to turn the generic entity into the one in the spec.

## Steps
1. **Read the contract**: `AGENTS.md`, then the README section "Anatomy of an app" and `docs/DECISIONS.md`. Skim `src/apps/example-notes/` (~120 lines).
2. **Branch** off latest `main`: `git checkout -b devin/$(date +%s)-<slug>`.
3. **Scaffold**: `pnpm new-app <slug> "<Display Name>" --owner <team> --entity <singular-noun>` (slug kebab-case). It creates `manifest.ts, schema.ts, actions.ts, page.tsx, seed.ts, index.ts, actions.test.ts`, appends one line to `src/platform/registry.ts` and one to `src/db/schema.ts`. Refuses if the slug exists.
4. **Manifest first** (`manifest.ts`): set `description`; replace placeholder groups with real directory groups from `src/platform/auth/users.ts` (e.g. `kyc-reviewers`, `support`, `engineering`, `auditors`); add every action the spec needs with the role that may call it. Roles must exist before actions reference them. Prefer adding a group to an existing mock user over adding users.
5. **Schema** (`schema.ts`): rename/extend columns for the spec's entity. Keep `id`, `created_by`, `created_at`, `updated_at`. Table name stays `<slug>_<plural>`. Then `pnpm db:generate` and **commit the new file under `drizzle/`**.
6. **Actions** (`actions.ts`): one `action(zodSchema, handler)` per manifest action. Handler gets `{ db, user, app, requestId }` and returns `{ before, after, entityId, message }`. Throw `ActionError(msg, "conflict" | "not_found" | "invalid")` for business-rule failures — never return silently, never `console.log` instead.
7. **Page** (`page.tsx`): server component, receives `{ user, path, searchParams }`. Read with `getDb().select()…`; render every mutation with `<ActionForm app action input>` or `<ActionButton …>`; hide controls with `can(user, manifest, "action")` but remember the gateway is the real check. Use primitives from `@/platform/ui/primitives` (PageHeader, Card, Table/Td, Badge, Select, TextInput, Callout, EmptyState). Must look right at 400px wide.
8. **Seed** (`seed.ts`): 3–6 realistic rows using mock user ids (`u-priya`, `u-marcus`, …).
9. **Tests** (`actions.test.ts`): keep the generated ones, add one per business rule (happy path, denied role, conflict). Pattern: `process.env.DB_PATH = ":memory:"; resetDbForTests();` in `beforeAll`, then `invokeAs(user, slug, action, input)` and inspect `listAudit(...)`.
10. **Reset + verify**: `pnpm db:reset` (seeds only run on an empty DB), `pnpm check` (typecheck + validate + vitest), `pnpm lint`, `pnpm build`. All must be green with no warnings you introduced.
11. **Look at it**: `pnpm dev`, open `/apps/<slug>` as a user with the editor role and as one without (user switcher top-right). Take 2–3 screenshots (desktop + narrow).
12. **README**: add a Roadmap row with the PR number, append a row to `docs/DECISIONS.md` for any tradeoff, and add a short paragraph for the app under "Apps" (3–5 lines: who can do what, the state machine, anything not built). Do not reorder or reformat existing rows; keep it concise.
13. **PR**: plain-English summary (reader does not know Power Apps internals), "demo in 5 clicks" with which mock user to pick, platform changes (ideally only the two one-line registrations), tradeoffs, screenshots.

## Platform rules (from AGENTS.md, restated)
- Every mutation is a manifest-declared action with a role, invoked only through the gateway (`invokeAs`). No API routes, no server actions of your own.
- Apps never import from other apps and never modify `src/platform/`. `pnpm validate` and ESLint enforce both.
- Pages and components (any `.tsx`) never write to the DB; `.insert/.update/.delete` belong in `actions.ts`, `seed.ts` or `.ts` helpers that actions call. `pnpm validate` enforces this.
- Leave `kind: "app"` in the manifest. `kind: "platform"` is only for operational surfaces owned by the platform team (audit log, deployments, flags); it changes how the shell lists the app and exempts it from the kill switch.
- Only `actions.ts`, `seed.ts`, `schema.ts` and `.tsx` server components (reads only) may import `getDb` from `@/platform/db/client`; `import type { Db }` is fine anywhere. Test files are exempt from these rules.
- After any `schema.ts` change: `pnpm db:generate`, commit `drizzle/`.
- Before pushing: `pnpm check` and `pnpm lint` must pass; CI also runs `pnpm build`.

## Pitfalls
- Writing to the DB from a page "because it's simpler" — it bypasses RBAC and the audit log; validate fails the build.
- Forgetting `before`/`after` in a handler: the audit row then says nothing useful. Fetch the row before mutating, return the row after.
- Adding an action to `actions.ts` before declaring it in `manifest.ts` (no role → unreachable; validate fails). Add roles → actions → handlers, in that order.
- Not running `pnpm db:reset` after adding an app: `db:setup` only seeds an empty DB, so the new table has no rows and the page looks broken.
- Forgetting to commit the new `drizzle/*.sql` + `drizzle/meta/*` files: CI's in-memory tests fail with "no such table".
- Editing `src/platform/registry.ts` by hand in a way that reorders entries — other PRs touch that line; keep your entry last.
- Placeholder groups (`<slug>-editors`) left in the manifest: only Priya (platform admin) will see the app.
