/** Creates the SQLite file, applies migrations and seeds demo data (idempotent). */
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { auditLog, deployments } from "@/platform/db/schema";
import { apps } from "@/platform/registry";
import { buildInfo } from "@/platform/build-info";
import { invokeAs } from "@/platform/actions/gateway";
import { users, type User } from "@/platform/auth/users";
import { fakeSha, previousVersion } from "@/apps/deployments/versions";

const db = getDb();
const alreadySeeded = db.select().from(deployments).limit(1).all().length > 0;
if (alreadySeeded) {
  console.log("Database already seeded; nothing to do. Use `pnpm db:reset` to start over.");
  process.exit(0);
}

const DAY = 86400000;
const now = Date.now();
const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

for (const app of apps) {
  app.seed?.(db);
  const slug = app.manifest.slug;
  const current = app.manifest.version;
  const prev = previousVersion(current);
  const prev2 = previousVersion(prev);
  const sha = (v: string) => fakeSha(`${slug}@${v}`);
  // History: two older releases rolled through every environment; the current release is
  // in dev and staging but prod is still on the previous one (so "behind" has something to show).
  db.insert(deployments)
    .values([
      { appSlug: slug, environment: "dev", version: prev2, gitSha: sha(prev2), deployedAt: at(30), deployedBy: "ci", notes: "seed" },
      { appSlug: slug, environment: "staging", version: prev2, gitSha: sha(prev2), deployedAt: at(28), deployedBy: "ci", notes: "seed" },
      { appSlug: slug, environment: "prod", version: prev2, gitSha: sha(prev2), deployedAt: at(25), deployedBy: "Sam Chen", notes: "seed · release train 41" },
      { appSlug: slug, environment: "dev", version: prev, gitSha: sha(prev), deployedAt: at(14), deployedBy: "ci", notes: "seed" },
      { appSlug: slug, environment: "staging", version: prev, gitSha: sha(prev), deployedAt: at(12), deployedBy: "ci", notes: "seed" },
      { appSlug: slug, environment: "prod", version: prev, gitSha: sha(prev), deployedAt: at(10), deployedBy: "Sam Chen", notes: "seed · release train 42" },
      { appSlug: slug, environment: "dev", version: current, gitSha: buildInfo.gitSha, deployedAt: at(3), deployedBy: "ci", notes: "seed" },
      { appSlug: slug, environment: "staging", version: current, gitSha: buildInfo.gitSha, deployedAt: at(1), deployedBy: "ci", notes: "seed" },
    ])
    .run();
  console.log(`seeded ${slug}`);
}

// Sample audit trail, produced through the real gateway so every row is genuine
// (RBAC, validation and business rules all ran). Rows are then back-dated and
// their request ids prefixed `seed-` so they are distinguishable from live traffic.
async function seedAudit() {
  if (db.select().from(auditLog).limit(1).all().length > 0) return;
  const u = (id: string) => users.find((x) => x.id === id)!;
  const script: [User, string, string, unknown, number][] = [
    [u("u-sam"), "example-notes", "postNote", { body: "Deploy freeze lifted; normal release trains resume Monday." }, 6],
    [u("u-omar"), "example-notes", "postNote", { body: "Support rota for next week is in the shared calendar." }, 6],
    [u("u-lena"), "example-notes", "postNote", { body: "Auditors should not be able to post this." }, 5.5],
    [u("u-omar"), "example-notes", "postNote", { body: "   " }, 5],
    [u("u-sam"), "example-notes", "postNote", { body: "Reminder: bump the manifest version when you change an app." }, 4.5],
    [u("u-priya"), "example-notes", "deleteNote", { id: 999999 }, 4],
    [u("u-marcus"), "example-notes", "postNote", { body: "KYC reviewers can read but not post." }, 3.5],
    [u("u-omar"), "example-notes", "deleteNote", { id: 3 }, 3],
    [u("u-sam"), "deployments", "promote", { appSlug: "example-notes", environment: "qa" }, 2.5],
    [u("u-lena"), "deployments", "promote", { appSlug: "example-notes", environment: "prod" }, 2],
    [u("u-sam"), "deployments", "promote", { appSlug: "example-notes", environment: "staging", notes: "redeploy" }, 1.5],
    [u("u-omar"), "deployments", "promote", { appSlug: "example-notes", environment: "prod" }, 1],
    [u("u-sam"), "example-notes", "postNote", { body: "Audit Log and Deployments apps are live for auditors and engineering." }, 0.5],
    [u("u-priya"), "example-notes", "postNote", { body: "Welcome aboard, everyone. Try the user switcher." }, 0.2],
    [u("u-dana"), "example-notes", "deleteNote", { id: 1 }, 0.1],
  ];
  for (const [user, app, action, input, daysAgo] of script) {
    const res = await invokeAs(user, app, action, input);
    db.update(auditLog).set({ ts: at(daysAgo), requestId: `seed-${res.requestId}` }).where(eq(auditLog.requestId, res.requestId)).run();
  }
  console.log(`seeded ${script.length} audit rows via the gateway`);
}

seedAudit().then(() => {
  db.run(sql`VACUUM`);
  console.log("done");
});
