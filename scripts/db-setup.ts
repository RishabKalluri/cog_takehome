/** Creates the SQLite file, applies migrations and seeds demo data (idempotent). */
import { sql } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { deployments } from "@/platform/db/schema";
import { apps } from "@/platform/registry";
import { buildInfo } from "@/platform/build-info";

const db = getDb();
const alreadySeeded = db.select().from(deployments).limit(1).all().length > 0;
if (alreadySeeded) {
  console.log("Database already seeded; nothing to do. Use `pnpm db:reset` to start over.");
  process.exit(0);
}

for (const app of apps) {
  app.seed?.(db);
  const now = Date.now();
  db.insert(deployments)
    .values([
      { appSlug: app.manifest.slug, environment: "prod", version: app.manifest.version, gitSha: buildInfo.gitSha, deployedAt: new Date(now - 3 * 86400000).toISOString(), deployedBy: "ci", notes: "seed" },
      { appSlug: app.manifest.slug, environment: "staging", version: app.manifest.version, gitSha: buildInfo.gitSha, deployedAt: new Date(now - 86400000).toISOString(), deployedBy: "ci", notes: "seed" },
      { appSlug: app.manifest.slug, environment: "dev", version: app.manifest.version, gitSha: buildInfo.gitSha, deployedAt: new Date(now).toISOString(), deployedBy: "ci", notes: "seed" },
    ])
    .run();
  console.log(`seeded ${app.manifest.slug}`);
}
db.run(sql`VACUUM`);
console.log("done");
