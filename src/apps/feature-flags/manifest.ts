import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "feature-flags",
  name: "Feature Flags",
  description: "Turn features on and off without a deploy. Also holds the per-app kill switches (app:<slug>:enabled).",
  version: "1.0.0",
  owner: "platform-team",
  kind: "platform",
  roles: {
    viewer: { description: "Can see flags and their state", groups: ["engineering", "support", "platform-admins"] },
    "flag-admin": { description: "Can create, toggle, roll out and delete flags", groups: ["engineering"] },
  },
  viewRole: "viewer",
  actions: {
    createFlag: { description: "Create a flag", role: "flag-admin" },
    toggleFlag: { description: "Turn a flag on or off", role: "flag-admin" },
    setRollout: { description: "Set the rollout percentage", role: "flag-admin" },
    deleteFlag: { description: "Delete a flag", role: "flag-admin" },
  },
  dataSources: ["platform-db"],
});
