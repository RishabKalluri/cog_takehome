/**
 * `pnpm promote <app-slug> <dev|staging|prod> [notes]`
 * Records (does not perform) a promotion of the app's current manifest version to an environment,
 * exactly like the Deployments app's `promote` action, credited to `cli:$USER`, and audited.
 */
import { randomUUID } from "node:crypto";
import { ActionError } from "@/platform/actions/define";
import { recordAudit } from "@/platform/audit/log";
import { buildInfo } from "@/platform/build-info";
import { getDb } from "@/platform/db/client";
import { manifest } from "@/apps/deployments/manifest";
import { recordPromotion } from "@/apps/deployments/promote";
import { ENVIRONMENTS, type Environment } from "@/apps/deployments/versions";

const [appSlug, environment, ...rest] = process.argv.slice(2);
const notes = rest.join(" ") || undefined;
if (!appSlug || !ENVIRONMENTS.includes(environment as Environment)) {
  console.error(`usage: pnpm promote <app-slug> <${ENVIRONMENTS.join("|")}> [notes]`);
  process.exit(2);
}

const actor = `cli:${process.env.USER ?? process.env.USERNAME ?? "unknown"}`;
const started = Date.now();
const input = { appSlug, environment, notes };
const base = {
  ts: new Date().toISOString(),
  requestId: `cli-${randomUUID()}`,
  actorId: actor,
  actorName: actor,
  actorEmail: "",
  appSlug: manifest.slug,
  appVersion: manifest.version,
  action: "promote",
  input: JSON.stringify(input),
  gitSha: buildInfo.gitSha,
  environment: buildInfo.environment,
};

try {
  const { before, after } = recordPromotion(getDb(), { appSlug, environment: environment as Environment, notes, deployedBy: actor });
  recordAudit({ ...base, status: "success", entityId: `${appSlug}:${environment}`, before: before ? JSON.stringify(before) : null, after: JSON.stringify(after), durationMs: Date.now() - started });
  console.log(`recorded ${after.appSlug} ${after.version} (${after.gitSha}) as live in ${after.environment}, by ${actor}`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  recordAudit({ ...base, status: "failed", error: msg, durationMs: Date.now() - started });
  console.error(err instanceof ActionError ? msg : err);
  process.exit(1);
}
