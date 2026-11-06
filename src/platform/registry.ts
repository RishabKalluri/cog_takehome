import type { ReactNode } from "react";
import type { AppManifest } from "./manifest";
import type { ActionImpl } from "./actions/define";
import type { User } from "./auth/users";
import type { Db } from "./db/client";
import exampleNotes from "@/apps/example-notes";
import auditLogApp from "@/apps/audit-log";
import deploymentsApp from "@/apps/deployments";
import featureFlags from "@/apps/feature-flags";

export type AppPageProps = {
  user: User;
  /** Sub-path under /apps/<slug>/..., so apps can have their own routes. */
  path: string[];
  searchParams: Record<string, string | string[] | undefined>;
};

export type AppDefinition = {
  manifest: AppManifest;
  actions: Record<string, ActionImpl>;
  Page: (props: AppPageProps) => Promise<ReactNode> | ReactNode;
  seed?: (db: Db) => void;
};

/** Every app ships here. `pnpm validate` fails if a folder under src/apps is missing. */
export const apps: AppDefinition[] = [
  exampleNotes,
  auditLogApp,
  deploymentsApp,
  featureFlags,
];

export function getApp(slug: string): AppDefinition | undefined {
  return apps.find((a) => a.manifest.slug === slug);
}
