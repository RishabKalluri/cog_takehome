# Working in this repo

- Read `README.md` first; the "Anatomy of an app" and "Decision log" sections are the contract.
- Building a new app? Follow the skill in `.devin/skills/new-internal-app/SKILL.md` and start from `pnpm new-app <slug> "<Name>" --owner <team> --entity <noun>` — it scaffolds a working CRUD app and registers it.
- Apps live in `src/apps/<slug>/` and never import from each other or modify `src/platform/` (platform changes are separate PRs).
- Every mutation is a manifest-declared action with a role; UI uses `<ActionForm>`/`<ActionButton>`; never write to the DB from a page (`pnpm validate` fails on `.insert/.update/.delete` in any `.tsx` file, on live DB-client imports outside `actions.ts`/`seed.ts`/`schema.ts`/`page.tsx`, and on cross-app imports).
- After changing any `schema.ts`: `pnpm db:generate`, commit the new file in `drizzle/`.
- Before pushing: `pnpm check` (typecheck + validate + tests) and `pnpm lint`.
- Update the README's roadmap table and decision log when you change behaviour or make a tradeoff.
