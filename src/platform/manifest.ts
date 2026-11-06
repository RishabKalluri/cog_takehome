import { z } from "zod";

/**
 * The manifest is the one part of an app the platform must "understand".
 * Everything the platform does for free (permissions, audit, kill switch,
 * version display) is driven by this declaration.
 */
export const RoleSchema = z.object({
  description: z.string(),
  /** Directory groups that grant this role. Locally these are the mock
   *  directory's groups; in production they are Entra ID security groups. */
  groups: z.array(z.string()).min(1),
});

export const ActionSchema = z.object({
  description: z.string(),
  /** Role required to invoke the action. Enforced by the gateway, never only in UI. */
  role: z.string(),
});

export const ManifestSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be kebab-case"),
    name: z.string().min(1),
    description: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver"),
    owner: z.string().min(1),
    /** `app` = a business app a team owns. `platform` = an operational surface
     *  (audit log, deployments, feature flags) built on the same contract but
     *  shown separately in the shell and exempt from the kill switch. */
    kind: z.enum(["app", "platform"]).default("app"),
    roles: z.record(z.string(), RoleSchema),
    /** Minimum role needed to open the app at all. */
    viewRole: z.string(),
    actions: z.record(z.string(), ActionSchema),
    /** Named data sources the app reads/writes. Informational in the POC;
     *  the connector layer would hand out scoped clients keyed by these names. */
    dataSources: z.array(z.string()).default([]),
  })
  .superRefine((m, ctx) => {
    if (!m.roles[m.viewRole]) {
      ctx.addIssue({ code: "custom", path: ["viewRole"], message: `viewRole "${m.viewRole}" is not declared in roles` });
    }
    for (const [name, a] of Object.entries(m.actions)) {
      if (!m.roles[a.role]) {
        ctx.addIssue({ code: "custom", path: ["actions", name, "role"], message: `role "${a.role}" is not declared in roles` });
      }
    }
  });

export type ManifestInput = z.input<typeof ManifestSchema>;
export type AppManifest = z.output<typeof ManifestSchema>;

export function defineManifest<const M extends ManifestInput>(m: M): M & AppManifest {
  return ManifestSchema.parse(m) as M & AppManifest;
}
