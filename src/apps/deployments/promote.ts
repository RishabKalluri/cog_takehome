import { and, desc, eq } from "drizzle-orm";
import { ActionError } from "@/platform/actions/define";
import { buildInfo } from "@/platform/build-info";
import type { Db } from "@/platform/db/client";
import { deployments } from "@/platform/db/schema";
import { getApp } from "@/platform/registry";
import type { Environment } from "./versions";

export type Deployment = typeof deployments.$inferSelect;

export function latestDeployment(db: Db, appSlug: string, environment: Environment): Deployment | undefined {
  return db
    .select()
    .from(deployments)
    .where(and(eq(deployments.appSlug, appSlug), eq(deployments.environment, environment)))
    .orderBy(desc(deployments.deployedAt), desc(deployments.id))
    .get();
}

/**
 * Records that the app's *current* manifest version (at this build's SHA) is now live in `environment`.
 * Shared by the `promote` action and `pnpm promote`. It is a record, not a deploy: nothing is shipped.
 */
export function recordPromotion(db: Db, input: { appSlug: string; environment: Environment; notes?: string; deployedBy: string }) {
  const app = getApp(input.appSlug);
  if (!app) throw new ActionError(`No app with slug "${input.appSlug}" is installed`, "not_found");
  const version = app.manifest.version;
  const gitSha = buildInfo.gitSha;

  const before = latestDeployment(db, input.appSlug, input.environment);
  if (before && before.version === version && before.gitSha === gitSha) {
    throw new ActionError(`${input.appSlug} ${version} (${gitSha}) is already recorded in ${input.environment}`, "conflict");
  }

  const after = db
    .insert(deployments)
    .values({
      appSlug: input.appSlug,
      environment: input.environment,
      version,
      gitSha,
      deployedAt: new Date().toISOString(),
      deployedBy: input.deployedBy,
      notes: input.notes?.trim() || null,
    })
    .returning()
    .get();
  return { before, after };
}
