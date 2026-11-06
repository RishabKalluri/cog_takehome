import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "deployments",
  name: "Deployments",
  description: "Which version of each app is recorded as live in dev, staging and prod, and the history behind it.",
  version: "1.0.0",
  owner: "platform-team",
  roles: {
    viewer: { description: "Can see what is deployed where", groups: ["engineering", "auditors", "platform-admins"] },
    releaser: { description: "Can record a promotion of an app to an environment", groups: ["engineering"] },
  },
  viewRole: "viewer",
  actions: {
    promote: { description: "Record that the current version of an app was promoted to an environment", role: "releaser" },
  },
  dataSources: ["platform-db"],
});
