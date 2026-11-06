import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "audit-log",
  name: "Audit Log",
  description: "Every action taken in every app, including denied and failed attempts. Read-only.",
  version: "1.0.0",
  owner: "platform-team",
  kind: "platform",
  roles: {
    viewer: { description: "Can browse the audit trail of all apps", groups: ["auditors", "platform-admins"] },
  },
  viewRole: "viewer",
  actions: {},
  dataSources: ["platform-db"],
});
