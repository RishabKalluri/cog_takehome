/**
 * pnpm new-app <slug> "<Display Name>" [--owner team] [--entity singular-noun]
 *
 * Scaffolds a working CRUD app under src/apps/<slug>, registers it, and prints next steps.
 */
import path from "node:path";
import { scaffoldApp } from "./lib/scaffold";

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split("=", 2);
      flags[k] = inline ?? argv[++i] ?? "";
    } else positional.push(a);
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [slug, name] = positional;
if (!slug || !name) {
  console.error('Usage: pnpm new-app <slug> "<Display Name>" [--owner team] [--entity singular-noun]');
  process.exit(2);
}

try {
  const res = scaffoldApp(process.cwd(), { slug, name, owner: flags.owner, entity: flags.entity });
  const rel = path.relative(process.cwd(), res.appDir);
  console.log(`Created ${rel}/`);
  for (const f of res.files) console.log(`  ${f}`);
  console.log(`Registered in ${path.relative(process.cwd(), res.registryPath)} and ${path.relative(process.cwd(), res.dbSchemaPath)}`);
  console.log(`
Next steps:
  1. Edit ${rel}/manifest.ts — replace the placeholder groups with real directory groups.
  2. pnpm db:generate      # new migration under drizzle/ (commit it)
  3. pnpm db:reset         # reseed the local database so the new table exists
  4. pnpm check && pnpm lint
  5. pnpm dev → http://localhost:3000/apps/${slug}
`);
} catch (err) {
  console.error(`new-app: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
